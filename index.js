const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();

// --- 🔑 کلیلەکان لێرە دابنێ ---
const TELEGRAM_TOKEN = '8766617760:AAEyzwg8aNki-bW_L7D161NdJkoVKM9CeDg
';
const GEMINI_API_KEY = 'AIzaSyDjkJxufjKtDo0KlePnjLSnas-uvdoBvTI';
const NEWS_API_KEY = 'df402b67d7044b64a0ff1d0e359d048f';

// --- 🤖 ڕێکخستنی بۆت و AI ---
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- 💾 داتابەیس ---
const db = new sqlite3.Database('./news_database.db');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (chatId TEXT PRIMARY KEY, lang TEXT DEFAULT 'Kurdish', category TEXT DEFAULT 'technology')`);
    db.run(`CREATE TABLE IF NOT EXISTS last_news (category TEXT PRIMARY KEY, title TEXT)`);
});

// ڕێگری لە کوژانەوە بەهۆی هەڵەی ئینتەرنێت
process.on('uncaughtException', (err) => console.error('Error:', err.message));

// --- 🔘 مینۆ و دوگمەکان ---
const settingsMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "وەرزش ⚽", callback_data: 'cat_sports' }, { text: "تەکنەلۆژیا 💻", callback_data: 'cat_technology' }],
            [{ text: "کوردی ☀️", callback_data: 'lang_Kurdish' }, { text: "English 🇬🇧", callback_data: 'lang_English' }]
        ]
    }
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id.toString();
    db.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId], () => {
        bot.sendMessage(chatId, "بەخێربێیت! بۆتەکە بە شێوەی خۆکار هەواڵت بە وێنە و وەرگێڕانەوە بۆ دەنێرێت.\n\nسێتینگ لێرە بگۆڕە:", settingsMenu);
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id.toString();
    if (query.data.startsWith('cat_')) {
        db.run(`UPDATE users SET category = ? WHERE chatId = ?`, [query.data.replace('cat_', ''), chatId]);
        bot.answerCallbackQuery(query.id, { text: "جۆر گۆڕدرا!" });
    } else if (query.data.startsWith('lang_')) {
        db.run(`UPDATE users SET lang = ? WHERE chatId = ?`, [query.data.replace('lang_', ''), chatId]);
        bot.answerCallbackQuery(query.id, { text: "زمان گۆڕدرا!" });
    }
});

// --- 📡 مەکینەی هەواڵ ---
async function broadcastNews() {
    console.log("پشکنینی هەواڵ...");
    db.all(`SELECT DISTINCT category FROM users`, [], async (err, categories) => {
        if (err || !categories) return;

        for (const row of categories) {
            const category = row.category;
            try {
                const url = `https://newsapi.org/v2/top-headlines?category=${category}&language=en&pageSize=1&apiKey=${NEWS_API_KEY}`;
                const res = await axios.get(url);
                const article = res.data.articles[0];

                if (!article) continue;

                // پشکنینی دووبارەبوونەوە
                const isDuplicate = await new Promise(res => {
                    db.get(`SELECT title FROM last_news WHERE category = ?`, [category], (err, row) => {
                        res(row && row.title === article.title);
                    });
                });

                if (isDuplicate) continue;

                let translationCache = {};

                db.all(`SELECT * FROM users WHERE category = ?`, [category], async (err, users) => {
                    for (const user of users) {
                        if (!translationCache[user.lang]) {
                            const prompt = `Summary this news to ${user.lang} for Telegram: ${article.title}. ${article.description}`;
                            const result = await model.generateContent(prompt);
                            translationCache[user.lang] = result.response.text();
                        }

                        const text = `🔥 **هەواڵی نوێی ${category}**\n\n${translationCache[user.lang]}`;
                        if (article.urlToImage) {
                            bot.sendPhoto(user.chatId, article.urlToImage, { caption: text, parse_mode: 'Markdown' });
                        } else {
                            bot.sendMessage(user.chatId, text, { parse_mode: 'Markdown' });
                        }
                    }
                });

                db.run(`INSERT OR REPLACE INTO last_news (category, title) VALUES (?, ?)`, [category, article.title]);

            } catch (e) { console.error("Error in loop:", e.message); }
        }
    });
}

// ناردنی هەواڵ هەموو ٣٠ خولەک جارێک
cron.schedule('*/30 * * * *', broadcastNews);

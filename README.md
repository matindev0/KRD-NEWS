# KRD-NEWS

https://mega.nz/file/eMdhWCKY#Rq0biAeNoPtvokNkSGHtTUPX8VQGr3cJXlRmNaIkxgg


# نوێکردنەوەی تێرموکس
pkg update && pkg upgrade

# دامەزراندنی پێداویستییەکان
pkg install nodejs-lts sqlite -y

# دروستکردنی فۆڵدەری پڕۆژە
mkdir news-bot
cd news-bot

# دامەزراندنی پاکێجە پێویستەکان
npm install node-telegram-bot-api @google/generative-ai axios node-cron sqlite3 pm2


pm2 start index.js --name "news-bot"


termux-wake-lock



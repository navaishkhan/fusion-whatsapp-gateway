const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;

let clientReady = false;
let client = null;

async function startClient() {
    console.log('Resolving Chromium executable path...');
    const executablePath = await chromium.executablePath();
    console.log(`Using Chromium at: ${executablePath}`);

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './whatsapp_session' }),
        puppeteer: {
            headless: chromium.headless,
            executablePath,
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--single-process'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('==================================================================');
        console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP APP (LINKED DEVICES):');
        console.log('==================================================================');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        clientReady = true;
        console.log('✅ WhatsApp client connected and ready!');
    });

    client.on('auth_failure', (msg) => {
        clientReady = false;
        console.error('Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        clientReady = false;
        console.log('WhatsApp disconnected:', reason);
    });

    await client.initialize();
}

// Health check route
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        whatsapp: clientReady ? 'connected' : 'waiting_for_qr_scan',
        message: clientReady
            ? 'WhatsApp Gateway is online and ready.'
            : 'Gateway started. Scan QR code in the server logs.'
    });
});

// API Route to send message
app.post('/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing parameters: "to" and "message" are required.' });
    }

    if (!clientReady) {
        return res.status(503).json({ error: 'WhatsApp not connected yet. Please scan the QR code from server logs.' });
    }

    try {
        let cleanNumber = to.replace(/[^0-9]/g, '');
        if (!cleanNumber.startsWith('92')) {
            cleanNumber = `92${cleanNumber.replace(/^0/, '')}`;
        }
        const jid = `${cleanNumber}@c.us`;

        const info = await client.sendMessage(jid, message);
        res.json({ success: true, messageId: info.id.id });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ error: 'Failed to send message: ' + err.message });
    }
});

// Start the Express server first, then initialize WhatsApp client
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Gateway running on port ${PORT}`);
    startClient().catch(err => {
        console.error('Failed to start WhatsApp client:', err);
    });
});

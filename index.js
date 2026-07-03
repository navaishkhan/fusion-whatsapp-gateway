const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;

// Initialize WhatsApp Client with Local Session Authentication
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp_session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Generate QR Code in terminal for scanning
client.on('qr', (qr) => {
    console.log('==================================================================');
    console.log('👉 SCAN THIS QR CODE WITH YOUR WHATSAPP APP (LINKED DEVICES) TO LOG IN:');
    console.log('==================================================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp client is fully connected and ready to send messages!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp was disconnected:', reason);
});

// API Route to send message
app.post('/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing parameters: \"to\" and \"message\" are required.' });
    }

    try {
        // Format phone number to WhatsApp JID format: e.g. "923001234567@c.us"
        let cleanNumber = to.replace(/[^0-9]/g, '');
        if (!cleanNumber.endsWith('@c.us')) {
            cleanNumber = `${cleanNumber}@c.us`;
        }

        const info = await client.sendMessage(cleanNumber, message);
        res.json({ success: true, messageId: info.id.id });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ error: 'Failed to send message: ' + err.message });
    }
});

client.initialize();

app.listen(PORT, () => {
    console.log(`🚀 Free WhatsApp API Gateway running on port ${PORT}`);
    console.log(`👉 Send POST requests to /send with JSON: { \"to\": \"923001234567\", \"message\": \"Hello\" }`);
});

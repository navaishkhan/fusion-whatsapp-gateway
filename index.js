const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const chromium = require('@sparticuz/chromium');
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ ERROR: MONGO_URI environment variable is not set!');
    console.error('   Set it in Render → Environment → MONGO_URI');
    process.exit(1);
}

let clientReady = false;
let latestQR = null;
let client = null;

// ─── QR Code Web Page ───────────────────────────────────────────────────────
app.get('/qr', async (req, res) => {
    if (clientReady) {
        return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>WhatsApp Gateway — Fusion College</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f1923 0%, #1a2e1a 100%);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(37,211,102,0.3);
      border-radius: 20px;
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      backdrop-filter: blur(12px);
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #25d366; font-size: 24px; margin-bottom: 8px; }
    p { color: #aaa; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>WhatsApp Connected!</h1>
    <p>Your Fusion College LMS is now linked and ready to send messages.</p>
  </div>
</body>
</html>`);
    }

    if (!latestQR) {
        return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="refresh" content="5"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>WhatsApp Gateway — Loading</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f1923 0%, #1a2e1a 100%);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(37,211,102,0.2);
      border-radius: 20px;
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(37,211,102,0.2);
      border-top-color: #25d366;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { color: #25d366; font-size: 20px; margin-bottom: 8px; }
    p { color: #aaa; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Starting WhatsApp...</h1>
    <p>Please wait. This page will refresh automatically when the QR code is ready.<br/><br/>This may take up to 2 minutes on first start.</p>
  </div>
</body>
</html>`);
    }

    const qrImageDataUrl = await QRCode.toDataURL(latestQR, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
    });

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="refresh" content="30"/>
  <title>WhatsApp Gateway — Scan QR</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f1923 0%, #1a2e1a 100%);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(37,211,102,0.3);
      border-radius: 24px;
      padding: 40px 36px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .logo { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 24px; }
    .logo-icon { width: 40px; height: 40px; background: #25d366; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 22px; height: 22px; fill: white; }
    .logo-text { color: white; font-size: 18px; font-weight: 700; }
    .logo-text span { color: #25d366; }
    h1 { color: #ffffff; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 28px; }
    .qr-wrapper { background: white; border-radius: 16px; padding: 16px; display: inline-block; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .qr-wrapper img { display: block; border-radius: 4px; }
    .steps { text-align: left; background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.15); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
    .steps h3 { color: #25d366; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .step { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
    .step-num { background: #25d366; color: #000; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .step-text { color: #ccc; font-size: 13px; line-height: 1.4; }
    .refresh-note { color: #555; font-size: 11px; }
    .dot { display: inline-block; width: 6px; height: 6px; background: #25d366; border-radius: 50%; margin-right: 6px; animation: blink 1.5s ease-in-out infinite; }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </div>
      <div class="logo-text">Fusion <span>Gateway</span></div>
    </div>
    <h1>Scan to Connect</h1>
    <p class="subtitle">Link your WhatsApp to Fusion College LMS</p>
    <div class="qr-wrapper">
      <img src="${qrImageDataUrl}" width="280" height="280" alt="WhatsApp QR Code"/>
    </div>
    <div class="steps">
      <h3>How to scan</h3>
      <div class="step"><div class="step-num">1</div><div class="step-text">Open WhatsApp on your phone</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Tap <strong style="color:#fff">Menu (⋮)</strong> → <strong style="color:#fff">Linked Devices</strong></div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Tap <strong style="color:#fff">Link a Device</strong> and scan this QR</div></div>
    </div>
    <p class="refresh-note"><span class="dot"></span>Page auto-refreshes every 30 seconds</p>
  </div>
</body>
</html>`);
});

// ─── Status / Health Check ───────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        whatsapp: clientReady ? 'connected' : 'waiting_for_qr_scan',
        qr_page: '/qr',
        message: clientReady
            ? 'WhatsApp Gateway is online and ready.'
            : 'Gateway started. Visit /qr to scan the QR code.'
    });
});

// ─── Send Message API ────────────────────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing "to" and "message" parameters.' });
    }

    if (!clientReady) {
        return res.status(503).json({ error: 'WhatsApp not connected yet. Visit /qr to scan the QR code.' });
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

// ─── Boot ────────────────────────────────────────────────────────────────────
async function startClient() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected — session will persist across restarts.');

    const store = new MongoStore({ mongoose });

    console.log('Resolving Chromium executable path...');
    const executablePath = await chromium.executablePath();
    console.log(`Using Chromium at: ${executablePath}`);

    client = new Client({
        authStrategy: new RemoteAuth({
            store,
            backupSyncIntervalMs: 300000 // save session every 5 minutes
        }),
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
        latestQR = qr;
        clientReady = false;
        console.log('New QR generated — visit /qr in your browser to scan it.');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        clientReady = true;
        latestQR = null;
        console.log('✅ WhatsApp client connected and ready!');
    });

    client.on('remote_session_saved', () => {
        console.log('✅ Session saved to MongoDB — will survive restarts.');
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

app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Gateway running on port ${PORT}`);
    console.log(`👉 Visit /qr to scan the WhatsApp QR code`);
    startClient().catch(err => console.error('Failed to start WhatsApp client:', err));
});

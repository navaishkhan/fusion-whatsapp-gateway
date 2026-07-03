const express = require('express');
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const pino = require('pino');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI environment variable is not set!');
    process.exit(1);
}

// ─── MongoDB Auth State ──────────────────────────────────────────────────────
const AuthSchema = new mongoose.Schema({ _id: String, value: mongoose.Schema.Types.Mixed });
let AuthModel;

async function useMongoAuthState() {
    if (!AuthModel) AuthModel = mongoose.model('BaileysAuth', AuthSchema);

    const get = async (id) => {
        const doc = await AuthModel.findById(id).lean();
        return doc ? JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver) : null;
    };
    const set = async (id, value) => {
        await AuthModel.findByIdAndUpdate(
            id,
            { value: JSON.parse(JSON.stringify(value, BufferJSON.replacer)) },
            { upsert: true }
        );
    };
    const del = async (id) => { await AuthModel.findByIdAndDelete(id); };

    let creds = await get('creds');
    if (!creds) {
        creds = initAuthCreds();
        await set('creds', creds);
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await get(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            tasks.push(value ? set(`${category}-${id}`, value) : del(`${category}-${id}`));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => { await set('creds', creds); }
    };
}

// ─── State ───────────────────────────────────────────────────────────────────
let sock = null;
let clientReady = false;
let latestQR = null;
let isConnecting = false;

// ─── Connect WhatsApp ─────────────────────────────────────────────────────────
async function connectToWhatsApp() {
    if (isConnecting) return;
    isConnecting = true;

    const { state, saveCreds } = await useMongoAuthState();
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}`);

    const logger = pino({ level: 'silent' }); // suppress noisy logs

    sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: ['Fusion College LMS', 'Chrome', '10.0.0'],
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            latestQR = qr;
            clientReady = false;
            console.log('QR code generated — visit /qr in your browser to scan it.');
        }

        if (connection === 'close') {
            clientReady = false;
            latestQR = null;
            isConnecting = false;
            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode
                : null;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log('Logged out. Please restart the server and scan QR again.');
                // Clear auth state so fresh QR is shown on next start
                await AuthModel?.deleteMany({});
            }
        }

        if (connection === 'open') {
            clientReady = true;
            latestQR = null;
            isConnecting = false;
            console.log('✅ WhatsApp connected and ready!');
        }
    });
}

// ─── QR Page ─────────────────────────────────────────────────────────────────
app.get('/qr', async (req, res) => {
    const html = (body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>WhatsApp Gateway — Fusion College</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0f1923,#1a2e1a);min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:rgba(255,255,255,.05);border:1px solid rgba(37,211,102,.3);border-radius:24px;padding:40px 36px;text-align:center;max-width:420px;width:90%;backdrop-filter:blur(12px);box-shadow:0 20px 60px rgba(0,0,0,.4)}
    h1{color:#fff;font-size:22px;font-weight:700;margin-bottom:6px}
    .sub{color:#888;font-size:13px;margin-bottom:24px}
    .qr-box{background:#fff;border-radius:16px;padding:16px;display:inline-block;margin-bottom:24px}
    .steps{text-align:left;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.15);border-radius:12px;padding:16px 20px;margin-bottom:20px}
    .steps h3{color:#25d366;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
    .step{display:flex;gap:10px;margin-bottom:8px;align-items:flex-start}
    .num{background:#25d366;color:#000;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .txt{color:#ccc;font-size:13px;line-height:1.4}
    .note{color:#555;font-size:11px}
    .dot{display:inline-block;width:6px;height:6px;background:#25d366;border-radius:50%;margin-right:6px;animation:blink 1.5s ease-in-out infinite}
    .spinner{width:48px;height:48px;border:4px solid rgba(37,211,102,.2);border-top-color:#25d366;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
    .green{color:#25d366;font-size:24px}
    .icon{font-size:60px;margin-bottom:12px}
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;

    if (clientReady) {
        return res.send(html(`
            <div class="icon">✅</div>
            <h1 class="green">WhatsApp Connected!</h1>
            <p class="sub">Fusion College LMS is linked and ready to send messages.</p>
        `));
    }

    if (!latestQR) {
        return res.send(html(`
            <meta http-equiv="refresh" content="4"/>
            <div class="spinner"></div>
            <h1>Starting Gateway...</h1>
            <p class="sub">Please wait, this takes a few seconds.<br/>Page auto-refreshes.</p>
        `).replace('<meta charset="UTF-8"/>', '<meta charset="UTF-8"/>\n  <meta http-equiv="refresh" content="4"/>'));
    }

    const qrImageDataUrl = await QRCode.toDataURL(latestQR, { width: 280, margin: 2 });

    res.send(html(`
        <h1>Scan to Connect</h1>
        <p class="sub">Link WhatsApp to Fusion College LMS</p>
        <div class="qr-box"><img src="${qrImageDataUrl}" width="280" height="280"/></div>
        <div class="steps">
            <h3>How to scan</h3>
            <div class="step"><div class="num">1</div><div class="txt">Open WhatsApp on your phone</div></div>
            <div class="step"><div class="num">2</div><div class="txt">Tap <strong style="color:#fff">Menu (⋮)</strong> → <strong style="color:#fff">Linked Devices</strong></div></div>
            <div class="step"><div class="num">3</div><div class="txt">Tap <strong style="color:#fff">Link a Device</strong> and scan this QR</div></div>
        </div>
        <p class="note"><span class="dot"></span>Page auto-refreshes every 30 seconds</p>
        <meta http-equiv="refresh" content="30"/>
    `));
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        engine: 'baileys',
        whatsapp: clientReady ? 'connected' : 'waiting_for_qr',
        qr_page: '/qr'
    });
});

// ─── Send Message API ─────────────────────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing "to" and "message" parameters.' });
    }

    if (!clientReady || !sock) {
        return res.status(503).json({ error: 'WhatsApp not connected. Visit /qr to scan the QR code.' });
    }

    try {
        let cleanNumber = to.replace(/[^0-9]/g, '');
        if (!cleanNumber.startsWith('92')) {
            cleanNumber = `92${cleanNumber.replace(/^0/, '')}`;
        }
        const jid = `${cleanNumber}@s.whatsapp.net`;

        await sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ error: 'Failed to send: ' + err.message });
    }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected.');
    await connectToWhatsApp();
}

app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Gateway (Baileys) running on port ${PORT}`);
    console.log(`👉 Visit /qr to scan QR code`);
    boot().catch(err => console.error('Boot error:', err));
});

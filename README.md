# Free WhatsApp Web API Gateway 🚀

A lightweight self-hosted API gateway using `whatsapp-web.js` that lets you send unlimited free WhatsApp messages using your own WhatsApp account (via scanning a QR code once).

Perfect for integrating SMS / notification alerts into LMS portals or websites.

---

## 🛠️ Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the API server**:
   ```bash
   npm start
   ```

3. **Scan the QR Code**:
   A QR code will generate directly in your terminal. Open WhatsApp on your phone, go to **Linked Devices**, select **Link a Device**, and scan this QR code.

4. **Send test message via Curl**:
   ```bash
   curl -X POST http://localhost:3001/send \
     -H "Content-Type: application/json" \
     -d '{"to": "923001234567", "message": "Hello World!"}'
   ```

---

## ☁️ Deploy 24/7 on Render.com

1. Create a free account on [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Link your GitHub repository where this project is uploaded.
4. Use the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Once deployed, open the **Logs** tab in Render to see the terminal output and scan the QR code using your phone's WhatsApp Linked Devices.
6. Copy the provided Render URL (e.g., `https://my-whatsapp-gateway.onrender.com`) and paste it into the **WhatsApp Settings** panel of your LMS portal.

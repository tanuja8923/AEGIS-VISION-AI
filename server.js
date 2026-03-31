require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ====================== GEMINI ======================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ====================== TWILIO ======================
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const TWILIO_PHONE = process.env.TWILIO_PHONE;
const ADMIN_PHONE = process.env.ADMIN_PHONE;  

let guardianData = null;

// ====================== ROUTES ======================

app.post('/api/setup-guardian', (req, res) => {
    guardianData = req.body;
    console.log("✅ Guardian Registered:", guardianData);
    res.json({ success: true });
});

// 🔥 ENHANCED AI VISION 
app.post('/api/analyze', async (req, res) => {
    try {
        const { image, command } = req.body;
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite"
        });

        const prompt = `You are Awaaz AI – ek pyara aur bahut helpful assistant specially banaya gaya hai visually impaired (andhe ya kam dikhta hai) logon ke liye India mein.

User ne Hindi mein poocha hai: "${command}"

Image ko dhyan se dekho aur simple, clear Hindi mein jawab do.

Hamesha yeh karo:
1. Sabse pehle batao: "Aapke saamne yeh hai..." – poori scene describe karo.
2. Saari important cheezein list karo (khana, dawai, packet, bottle, rasta, log, obstacle, color etc.).
3. Agar koi khana, dawai, product, packet hai: expiry date, MFD, batch number, brand naam padho aur saaf-saaf batao safe hai ya nahi.
4. Safety advice do (obstacle, rasta, dawai mat lo etc.).
5. Agar color, distance, ya koi specific cheez poochi ho toh uspe focus karo.

Jawab friendly, short lekin poora ho. Jaise aap personally blind person se baat kar rahe ho.`;

        const imageParts = [{
            inlineData: { 
                data: image.split(",")[1], 
                mimeType: "image/jpeg" 
            }
        }];

        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();

        res.json({ text: responseText });
    } catch (error) {
        console.error("Gemini Error:", error.message);
        res.status(500).json({ text: "Abhi thodi technical problem hai. Thodi der baad try kijiye." });
    }
});

// ======================EMERGENCY (SMS) ======================
app.post('/api/emergency', async (req, res) => {
    console.log('\n🚨 EMERGENCY ALERT TRIGGERED 🚨');
    const { location } = req.body;

    if (!location || !location.lat) {
        console.warn('⚠️ Location data missing');
        return res.status(400).json({ error: 'Location nahi mili.' });
    }

    const mapLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;

    const smsBody = `🚨 AEGIS EMERGENCY ALERT!\n\n` +
        `👤 Guardian: ${guardianData?.name || 'AEGIS User'}\n` +
        `📍 Address: ${guardianData?.address || 'N/A'}\n` +
        `📍 Live Location: ${mapLink}\n\n` +
        `Turant call karo! Netrahin user ko madad chahiye.`;

    const results = [];

    // Guardian ko SMS
    if (guardianData?.phone) {
        try {
            const msg = await twilioClient.messages.create({
                body: smsBody,
                from: TWILIO_PHONE,
                to: guardianData.phone
            });
            console.log('✅ Guardian SMS sent:', msg.sid);
            results.push({ to: 'guardian', sid: msg.sid });
        } catch (e) {
            console.error('❌ Guardian SMS failed:', e.message);
        }
    }

    // Admin ko SMS
    if (ADMIN_PHONE) {
        try {
            const adminMsg = await twilioClient.messages.create({
                body: `🚨 AEGIS Alert!\n📍 ${mapLink}`,
                from: TWILIO_PHONE,
                to: ADMIN_PHONE
            });
            console.log('✅ Admin SMS sent:', adminMsg.sid);
            results.push({ to: 'admin', sid: adminMsg.sid });
        } catch (e) {
            console.error('❌ Admin SMS failed:', e.message);
        }
    }

    res.json({ success: true, smsSent: results.length, map: mapLink });
});

// ====================== NEW APIS (visually impaired ke liye) ======================
app.get('/api/current-time', (req, res) => {
    const now = new Date();
    const timeStr = now.toLocaleString('hi-IN', { 
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true 
    });
    const text = `Namaste! Aaj ka din aur samay hai: ${timeStr}. Kya aur kuch jaanna hai?`;
    res.json({ text });
});

app.get('/api/currency-rates', async (req, res) => {
    try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json');
        const data = await response.json();
        const rates = data.inr;
        let text = `Current currency rates (1 Rupaye ke hisaab se):\n`;
        text += `USD: ${parseFloat(rates.USD || 0).toFixed(4)}\n`;
        text += `EUR: ${parseFloat(rates.EUR || 0).toFixed(4)}\n`;
        text += `GBP: ${parseFloat(rates.GBP || 0).toFixed(4)}\n`;
        text += `AED: ${parseFloat(rates.AED || 0).toFixed(4)}\n`;
        text += `JPY: ${parseFloat(rates.JPY || 0).toFixed(2)}\n\nYeh live rates hain. Aur convert karna hai toh bataiye!`;
        res.json({ text });
    } catch (err) {
        res.json({ text: "Currency rates abhi nahi mil sake. Internet check kijiye." });
    }
});

app.get('/api/news', async (req, res) => {
    try {
        const rssUrl = encodeURIComponent('https://news.google.com/rss?hl=hi-IN&gl=IN&ceid=IN:hi');
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        let text = `Aaj ki top 3 news India se:\n`;
        for (let i = 0; i < 3 && data.items && data.items[i]; i++) {
            text += `${i+1}. ${data.items[i].title}\n`;
        }
        text += `\nAur details ke liye AI se poochhiye.`;
        res.json({ text });
    } catch (err) {
        res.json({ text: "News abhi nahi mil saki. Internet check kijiye ya AI se general news poochhiye." });
    }
});

// ====================== SERVER START ======================
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 AEGIS Server running on http://localhost:${PORT}`);
    console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ LOADED' : '❌ MISSING'}`);
    console.log(`📱 Twilio SID: ${process.env.TWILIO_SID ? '✅ LOADED' : '❌ MISSING'}`);
    console.log(`👤 Admin Phone: ${ADMIN_PHONE || 'Not set'}`);
});
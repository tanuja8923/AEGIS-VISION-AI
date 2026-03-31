const output = document.getElementById('output');
const status = document.getElementById('status');

window.onload = () => {
    if (localStorage.getItem('registered')) showApp();
};

function register() {
    const data = { 
        name: document.getElementById('gName').value.trim(), 
        phone: document.getElementById('gPhone').value.trim(),
        email: document.getElementById('gEmail').value.trim(),
        address: document.getElementById('gAddress').value.trim()
    };
    if (!data.name || !data.phone || !data.email) return alert("Fill all guardian details!");
    
    fetch('/api/setup-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(() => {
        localStorage.setItem('registered', 'true');
        showApp();
    });
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    initCam();
    speak("Namaste! AEGIS activated hai. AEGIS ka matlab hai Aiding Every Glimpse Into Sight. Main aapki aankhein hoon. Har cheez aapko sunaaunga. Camera on hai. Ab tap karke bolo – time, news, currency, emergency ya koi bhi sawal.");
}

function resetApp() {
    localStorage.removeItem('registered');
    location.reload();
}

async function initCam() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('webcam').srcObject = stream;
}

function speak(t) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = 1.05;
    u.lang = "hi-IN";
    window.speechSynthesis.speak(u);
    output.innerText = t;
}

// ==================== NEW VOICE COMMANDS ====================
async function getCurrentTime() {
    try {
        const res = await fetch('/api/current-time');
        const data = await res.json();
        speak(data.text);
    } catch(e) { speak("Time nahi mil saka. Internet check kijiye."); }
}

async function getLatestNews() {
    try {
        const res = await fetch('/api/news');
        const data = await res.json();
        speak(data.text);
    } catch(e) { speak("News abhi nahi mil saki. Baad mein try kijiye."); }
}

async function getCurrencyRates() {
    try {
        const res = await fetch('/api/currency-rates');
        const data = await res.json();
        speak(data.text);
    } catch(e) { speak("Currency rates nahi mil sake. Internet check kijiye."); }
}

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.onstart = () => { 
    document.body.classList.add('is-listening'); 
    status.innerText = "Listening..."; 
    navigator.vibrate(50); 
};
recognition.onend = () => document.body.classList.remove('is-listening');

recognition.onresult = async (e) => {
    const cmd = e.results[0][0].transcript.toLowerCase();
    status.innerText = `Thinking...`;
    
    // NEW SPECIAL COMMANDS (visually impaired ke liye super easy)
    if (cmd.includes('time') || cmd.includes('samay') || cmd.includes('date') || cmd.includes('tarikh') || (cmd.includes('aaj') && (cmd.includes('kya') || cmd.includes('hai')))) {
        getCurrentTime();
    } 
    else if (cmd.includes('news') || cmd.includes('samachar') || cmd.includes('khabar') || cmd.includes('headlines')) {
        getLatestNews();
    } 
    else if (cmd.includes('currency') || cmd.includes('rate') || cmd.includes('dollar') || cmd.includes('rupee') || cmd.includes('exchange') || cmd.includes('paise')) {
        getCurrencyRates();
    } 
    else if (cmd.includes('help') || cmd.includes('emergency') || cmd.includes('madad') || cmd.includes('bachao') || cmd.includes('bachaao') || cmd.includes('help me')) {
        triggerEmergency();
    } 
    else {
        processAI(cmd);
    }
};

async function processAI(cmd) {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    canvas.getContext('2d').drawImage(document.getElementById('webcam'), 0, 0);
    const img = canvas.toDataURL('image/jpeg');

    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: img, command: cmd })
        });
        const data = await res.json();
        speak(data.text);
    } catch (err) {
        speak("Connection error. Server check kijiye.");
    }
}

function triggerEmergency() {
    speak("Emergency alert guardian ko bhej diya gaya hai. Unka phone baj raha hai.");
    navigator.vibrate([500, 100, 500]);
    navigator.geolocation.getCurrentPosition(pos => {
        fetch('/api/emergency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } })
        });
        document.getElementById('sos-tag').style.display = 'inline';
    });
}

function startVoice() { 
    if (localStorage.getItem('registered')) recognition.start(); 
}
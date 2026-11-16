// Listener Insights (server part): how is this FM-DX server used?
// Every 10 seconds it looks at who is connected and what the tuner is on, and adds up
// per day: unique visitors, listening time per hour and per frequency, countries,
// session lengths and the busiest moment. No IP addresses are stored: visitors are
// counted with a salted fingerprint that is only kept for the current day.
//
// Data: plugins_configs/insights.json (last 120 days)
// Admin endpoint: GET /insights/data?days=7|30|90
// Optional weekly Telegram summary (Monday 09:00) if ~/.fmdx-telegram or ~/.scanguard-telegram exists.
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const router = require('../../server/endpoints');
const storage = require('../../server/storage');
const dataHandler = require('../../server/datahandler');
const { logInfo } = require('../../server/console');

const DATA = path.join(__dirname, '../../plugins_configs/insights.json');
const STEP = 10;                                   // seconds between samples
const KEEP_DAYS = 120;
let db = { salt: crypto.randomBytes(16).toString('hex'), days: {}, today: { date: '', seen: [] }, lastWeekly: '', label: '' };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA, 'utf8')) }; } catch (_) { /* first run */ }

const sessions = new Map();                        // ws -> { start }
let seen = new Set(db.today.seen || []);
let dirty = false;

const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isInternal = ip => !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
const hash = ip => crypto.createHash('sha256').update(db.salt + ip).digest('hex').slice(0, 16);
const country = loc => { const m = String(loc || '').match(/,\s*([A-Z]{2})$/) || String(loc || '').match(/^([A-Z]{2})$/); return m ? m[1] : '??'; };

function day(key) {
    return db.days[key] || (db.days[key] = { visitors: 0, peak: 0, listenSec: 0, sessions: 0, durations: [0, 0, 0, 0, 0], hours: Array(24).fill(0), freqs: {}, countries: {} });
}

function endSession(s, now) {
    const min = (now - s.start) / 60000;
    const d = day(dateKey(new Date(s.start)));
    d.sessions++;
    d.durations[min < 1 ? 0 : min < 5 ? 1 : min < 15 ? 2 : min < 60 ? 3 : 4]++;
}

function sample() {
    const now = new Date();
    const key = dateKey(now);
    if (db.today.date !== key) { seen = new Set(); db.today = { date: key, seen: [] }; }
    const d = day(key);
    const users = (storage.connectedUsers || []).filter(u => !isInternal(u.ip));
    const live = new Set();
    for (const u of users) {
        live.add(u.instance);
        if (!sessions.has(u.instance)) sessions.set(u.instance, { start: Number(u.time) || now.getTime() });
        const h = hash(u.ip);
        if (!seen.has(h)) {
            seen.add(h);
            d.visitors++;
            const cc = country(u.location);
            d.countries[cc] = (d.countries[cc] || 0) + 1;
        }
    }
    for (const [ws, s] of sessions) if (!live.has(ws)) { endSession(s, now.getTime()); sessions.delete(ws); }
    const n = users.length;
    if (n > d.peak) d.peak = n;
    if (n > 0) {
        d.listenSec += n * STEP;
        d.hours[now.getHours()] += n * STEP;
        const t = dataHandler.dataToSend || {};
        const f = Number(t.freq);
        if (isFinite(f)) {
            const fk = f.toFixed(1);
            const e = d.freqs[fk] || (d.freqs[fk] = { sec: 0, name: '' });
            e.sec += n * STEP;
            const name = (t.txInfo && t.txInfo.tx) || String(t.ps || '').trim();
            if (name && !name.includes('?')) e.name = name;
        }
    }
    db.today.seen = [...seen];
    dirty = true;
}

function save() {
    if (!dirty) return;
    const keys = Object.keys(db.days).sort();
    while (keys.length > KEEP_DAYS) delete db.days[keys.shift()];
    try {
        fs.mkdirSync(path.dirname(DATA), { recursive: true });
        fs.writeFileSync(DATA + '.tmp', JSON.stringify(db));
        fs.renameSync(DATA + '.tmp', DATA);
        dirty = false;
    } catch (_) { /* try again */ }
}

function summary(days) {
    const now = new Date();
    const keys = [];
    for (let i = days - 1; i >= 0; i--) keys.push(dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
    const out = { days, visitors: 0, listenHours: 0, sessions: 0, peak: 0, peakDay: '', durations: [0, 0, 0, 0, 0],
        hours: Array(24).fill(0), weekdays: Array(7).fill(0), daily: [], stations: [], countries: [] };
    const freqs = {}, countries = {};
    for (const k of keys) {
        const d = db.days[k];
        out.daily.push({ date: k, visitors: d ? d.visitors : 0, hours: d ? Math.round(d.listenSec / 360) / 10 : 0 });
        if (!d) continue;
        out.visitors += d.visitors;
        out.listenHours += d.listenSec / 3600;
        out.sessions += d.sessions;
        if (d.peak > out.peak) { out.peak = d.peak; out.peakDay = k; }
        d.durations.forEach((v, i) => { out.durations[i] += v; });
        d.hours.forEach((v, i) => { out.hours[i] += v / 3600; });
        out.weekdays[(new Date(k + 'T12:00:00').getDay() + 6) % 7] += d.listenSec / 3600;
        for (const [f, e] of Object.entries(d.freqs)) { const x = freqs[f] || (freqs[f] = { sec: 0, name: '' }); x.sec += e.sec; if (e.name) x.name = e.name; }
        for (const [c, v] of Object.entries(d.countries)) countries[c] = (countries[c] || 0) + v;
    }
    out.listenHours = Math.round(out.listenHours * 10) / 10;
    out.hours = out.hours.map(v => Math.round(v * 10) / 10);
    out.weekdays = out.weekdays.map(v => Math.round(v * 10) / 10);
    out.stations = Object.entries(freqs).map(([f, e]) => ({ freq: Number(f), name: e.name, hours: Math.round(e.sec / 360) / 10 }))
        .sort((a, b) => b.hours - a.hours).slice(0, 15);
    out.countries = Object.entries(countries).map(([cc, v]) => ({ cc, visitors: v })).sort((a, b) => b.visitors - a.visitors).slice(0, 15);
    out.listenersNow = (storage.connectedUsers || []).filter(u => !isInternal(u.ip)).length;
    out.since = Object.keys(db.days).sort()[0] || dateKey(now);
    return out;
}

function admin(req, res, next) {
    if (req.session && req.session.isAdminAuthenticated) return next();
    res.status(403).json({ error: 'admin login required' });
}
router.get('/insights/data', admin, (req, res) => res.json(summary(Math.min(120, Math.max(1, Number(req.query.days) || 7)))));

// Weekly Telegram summary, Monday 09:00
function telegramCreds() {
    for (const f of ['.fmdx-telegram', '.scanguard-telegram']) {
        try {
            const c = fs.readFileSync(path.join(process.env.HOME || '/home/konvlachos', f), 'utf8');
            const token = (c.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m) || [])[1], chat = (c.match(/^TELEGRAM_CHAT_ID=(.*)$/m) || [])[1];
            if (token && chat) return { token: token.trim().replace(/^"|"$/g, ''), chat: chat.trim().replace(/^"|"$/g, '') };
        } catch (_) { /* next */ }
    }
    return null;
}
function weekly() {
    const now = new Date();
    if (now.getDay() !== 1 || now.getHours() !== 9 || db.lastWeekly === dateKey(now)) return;
    const creds = telegramCreds();
    db.lastWeekly = dateKey(now); dirty = true;
    if (!creds) return;
    const s = summary(7);
    let name = '';
    try { name = require('../../server/server_config').serverConfig.identification.tunerName; } catch (_) { /* ignore */ }
    const busiest = s.hours.indexOf(Math.max(...s.hours));
    const text = `📊 ${name || 'FM-DX'} – last 7 days\n` +
        `Visitors: ${s.visitors} · Listening: ${s.listenHours} h · Most at once: ${s.peak}\n` +
        `Busiest hour: ${String(busiest).padStart(2, '0')}:00–${String(busiest + 1).padStart(2, '0')}:00\n` +
        (s.stations.length ? 'Top stations: ' + s.stations.slice(0, 3).map(x => `${x.freq.toFixed(1)}${x.name ? ' ' + x.name : ''} (${x.hours} h)`).join(', ') + '\n' : '') +
        (s.countries.length ? 'Countries: ' + s.countries.slice(0, 5).map(c => `${c.cc} ${c.visitors}`).join(', ') : '');
    const body = JSON.stringify({ chat_id: creds.chat, text });
    const req = https.request({ host: 'api.telegram.org', path: `/bot${creds.token}/sendMessage`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 });
    req.on('error', () => {}); req.on('timeout', () => req.destroy()); req.end(body);
}

setInterval(sample, STEP * 1000).unref();
setInterval(() => { weekly(); save(); }, 60 * 1000).unref();
logInfo(`[Listener Insights] active, ${Object.keys(db.days).length} days of data`);

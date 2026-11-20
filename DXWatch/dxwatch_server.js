// DX Watch (server part): watch THIS receiver's own live RDS decodes and alert when a station you
// care about is received. Targets can be a PI code, a frequency, or "any new station I've never heard".
// When a match is received for a few seconds it is logged as a "catch" and sent to a Discord webhook
// and/or Telegram, and shown on the page. Read-only: it never commands the tuner.
//
// Only an admin manages the watchlist and channels; the catches can be shown to listeners too.
// Data: plugins_configs/dxwatch.json
// Public: GET /dxwatch/recent (only if "show catches to listeners" is on)
// Admin:  GET /dxwatch/admin , POST /dxwatch/targets , POST /dxwatch/settings , POST /dxwatch/test
const fs = require('fs');
const path = require('path');
const https = require('https');
const router = require('../../server/endpoints');
const dataHandler = require('../../server/datahandler');
const { logInfo, logWarn } = require('../../server/console');

const DATA = path.join(__dirname, '../../plugins_configs/dxwatch.json');
const HOLD_MS = 4000;            // a station must stay decoded this long to count (like Station Log)
const SEEN_CAP = 5000;           // remember this many PIs for the "any new station" target
const CATCH_CAP = 100;           // keep this many recent catches

const DEFAULTS = { enabled: true, cooldownMinutes: 30, publicCatches: true, discordWebhook: '', telegram: { token: '', chat: '' } };
let db = { settings: { ...DEFAULTS }, targets: [], catches: [], seenPis: {} };
try { const j = JSON.parse(fs.readFileSync(DATA, 'utf8')); db = { ...db, ...j, settings: { ...DEFAULTS, ...(j.settings || {}) } }; } catch (_) { /* first run */ }

let current = null;              // { key, since, fired }
const lastAlert = new Map();     // alert key -> ts (cooldown)
let dirty = false;

function save() { try { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA + '.tmp', JSON.stringify(db)); fs.renameSync(DATA + '.tmp', DATA); dirty = false; } catch (_) { /* next time */ } }
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const normPi = s => String(s || '').replace(/\?/g, '').toUpperCase();
const tunerName = () => { try { return require('../../server/server_config').serverConfig.identification.tunerName || 'FM-DX'; } catch (_) { return 'FM-DX'; } };

// ---- Telegram creds: plugin settings first, then the shared ~/.fmdx-telegram file ----
function telegramCreds() {
    if (db.settings.telegram && db.settings.telegram.token && db.settings.telegram.chat) return { token: db.settings.telegram.token, chat: db.settings.telegram.chat };
    for (const f of ['.fmdx-telegram', '.scanguard-telegram']) {
        try { const c = fs.readFileSync(path.join(process.env.HOME || '/home/konvlachos', f), 'utf8');
            const token = (c.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m) || [])[1], chat = (c.match(/^TELEGRAM_CHAT_ID=(.*)$/m) || [])[1];
            if (token && chat) return { token: token.trim().replace(/^"|"$/g, ''), chat: chat.trim().replace(/^"|"$/g, '') };
        } catch (_) { /* next */ }
    }
    return null;
}
function postJson(urlStr, body) {
    try {
        const u = new URL(urlStr); const data = JSON.stringify(body);
        const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', port: u.port || 443,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 10000 });
        req.on('error', () => {}); req.on('timeout', () => req.destroy()); req.end(data);
    } catch (_) { /* bad URL */ }
}
function sendDiscord(text) { if (db.settings.discordWebhook) postJson(db.settings.discordWebhook, { content: text, allowed_mentions: { parse: [] } }); }
function sendTelegram(text) { const c = telegramCreds(); if (c) postJson(`https://api.telegram.org/bot${c.token}/sendMessage`, { chat_id: c.chat, text }); }

function alertText(info, label) {
    const who = info.name || ('PI ' + info.pi);
    return `📻 ${tunerName()} — DX Watch${label ? ' [' + label + ']' : ''}\n` +
        `${who} on ${info.freq.toFixed(1)} MHz (PI ${info.pi}${info.ps ? ', ' + info.ps : ''})` +
        `${info.city ? ', ' + info.city : ''}${info.itu ? ' ' + info.itu : ''}${info.dist ? ', ' + info.dist + ' km' : ''}` +
        `${info.sig != null ? ', ' + info.sig + ' dBf' : ''}`;
}

function matches(t, info, isNew) {
    if (!t.enabled) return false;
    if (t.type === 'any-new') return isNew;
    if (t.type === 'pi') return info.pi === normPi(t.value);
    if (t.type === 'freq') return info.freq.toFixed(1) === Number(t.value).toFixed(1);
    return false;
}

function fire(info) {
    const isNew = !db.seenPis[info.pi];
    let any = false;
    for (const t of db.targets) {
        if (!matches(t, info, isNew)) continue;
        const key = t.id + '|' + info.freq.toFixed(1) + '|' + info.pi;
        const now = Date.now();
        if (lastAlert.has(key) && now - lastAlert.get(key) < db.settings.cooldownMinutes * 60000) continue;
        lastAlert.set(key, now);
        any = true;
        const text = alertText(info, t.label || '');
        sendDiscord(text); sendTelegram(text);
        logInfo(`[DX Watch] ${text.replace(/\n/g, ' ')}`);
    }
    if (any) {
        db.catches.unshift({ ...info, ts: Date.now() });
        if (db.catches.length > CATCH_CAP) db.catches.length = CATCH_CAP;
        dirty = true;
    }
    // remember the PI for the "any new station" target
    db.seenPis[info.pi] = Date.now();
    const pis = Object.keys(db.seenPis);
    if (pis.length > SEEN_CAP) { pis.sort((a, b) => db.seenPis[a] - db.seenPis[b]); while (Object.keys(db.seenPis).length > SEEN_CAP) delete db.seenPis[pis.shift()]; }
    dirty = true;
}

function sample() {
    if (!db.settings.enabled) return;
    const d = dataHandler.dataToSend || {};
    const pi = normPi(d.pi); const freq = Number(d.freq);
    if (!pi || pi.length < 4 || !isFinite(freq)) { current = null; return; }
    const key = freq.toFixed(1) + '|' + pi;
    const now = Date.now();
    if (!current || current.key !== key) { current = { key, since: now, fired: false }; return; }
    if (current.fired || now - current.since < HOLD_MS) return;
    current.fired = true;
    const tx = d.txInfo || {};
    const sig = Number(d.sig);
    fire({ freq, pi, ps: clean(d.ps).includes('?') ? '' : clean(d.ps), name: clean(tx.tx), city: clean(tx.city),
        itu: clean(tx.itu), dist: clean(tx.dist), sig: isFinite(sig) ? Math.round(sig * 10) / 10 : null });
}

function admin(req, res, next) { if (req.session && req.session.isAdminAuthenticated) return next(); res.status(403).json({ error: 'admin login required' }); }
const maskUrl = u => { if (!u) return ''; return u.length > 24 ? u.slice(0, 20) + '…' + u.slice(-6) : '…'; };

router.get('/dxwatch/admin', admin, (req, res) => res.json({
    settings: { ...db.settings, discordWebhook: maskUrl(db.settings.discordWebhook), discordSet: !!db.settings.discordWebhook,
        telegram: { set: !!(db.settings.telegram && db.settings.telegram.token) } },
    telegramAvailable: !!telegramCreds(), targets: db.targets, catches: db.catches.slice(0, 50)
}));

router.post('/dxwatch/settings', admin, (req, res) => {
    const q = req.query;
    if (q.enabled !== undefined) db.settings.enabled = q.enabled === 'true';
    if (q.publicCatches !== undefined) db.settings.publicCatches = q.publicCatches === 'true';
    if (q.cooldownMinutes !== undefined) db.settings.cooldownMinutes = Math.min(1440, Math.max(0, Number(q.cooldownMinutes) || 30));
    if (q.discordWebhook !== undefined) db.settings.discordWebhook = String(q.discordWebhook).trim();   // empty clears it
    if (q.telegramToken !== undefined) db.settings.telegram.token = String(q.telegramToken).trim();
    if (q.telegramChat !== undefined) db.settings.telegram.chat = String(q.telegramChat).trim();
    save();
    res.json({ ok: true });
});

router.post('/dxwatch/targets', admin, (req, res) => {
    const q = req.query;
    if (q.action === 'add') {
        const type = ['pi', 'freq', 'any-new'].includes(q.type) ? q.type : null;
        if (!type) return res.status(400).json({ error: 'bad target type' });
        if (type !== 'any-new' && !clean(q.value)) return res.status(400).json({ error: 'a value is required' });
        if (type === 'any-new' && db.targets.some(t => t.type === 'any-new')) return res.status(409).json({ error: 'an "any new station" target already exists' });
        const value = type === 'pi' ? normPi(q.value) : type === 'freq' ? Number(q.value).toFixed(1) : '';
        if (type === 'freq' && !isFinite(Number(value))) return res.status(400).json({ error: 'bad frequency' });
        db.targets.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, value, label: clean(q.label).slice(0, 40), enabled: true });
    } else if (q.action === 'remove') { db.targets = db.targets.filter(t => t.id !== q.id); }
    else if (q.action === 'toggle') { const t = db.targets.find(t => t.id === q.id); if (t) t.enabled = !t.enabled; }
    else if (q.action === 'clearcatches') { db.catches = []; }
    else return res.status(400).json({ error: 'bad action' });
    save();
    res.json({ targets: db.targets });
});

router.post('/dxwatch/test', admin, (req, res) => {
    const text = `📻 ${tunerName()} — DX Watch test alert. If you can read this, your channel is set up correctly.`;
    sendDiscord(text); sendTelegram(text);
    res.json({ sentDiscord: !!db.settings.discordWebhook, sentTelegram: !!telegramCreds() });
});

// Public (only if enabled): the recent catches, for the on-page toast / feed.
router.get('/dxwatch/recent', (req, res) => {
    if (!db.settings.publicCatches) return res.status(404).json({ error: 'not public' });
    res.set('Cache-Control', 'no-store').json(db.catches.slice(0, 20).map(c => ({ freq: c.freq, pi: c.pi, ps: c.ps, name: c.name, city: c.city, itu: c.itu, dist: c.dist, sig: c.sig, ts: c.ts })));
});

setInterval(sample, 1000).unref();
setInterval(() => { if (dirty) save(); }, 30000).unref();
logInfo(`[DX Watch] active, ${db.targets.length} target(s), ${db.settings.enabled ? 'on' : 'off'}`);
module.exports = { _test: { matches, normPi, fire, sample, _db: () => db } };

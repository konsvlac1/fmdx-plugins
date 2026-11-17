// Chat Filter (server part): checks every chat message BEFORE it is saved or shown to anyone.
//   - bad words (Greek, Greeklish, English + your own words): the message is not sent
//     (or, in "hide" mode, the word is sent as ***); only the sender sees a short note
//   - the same message again within 5 minutes is not sent (trolls, spam)
//   - after a few blocked messages the sender is muted for a while
// Admins are never filtered.
//
// Needs the small "plugin chat filter" hook in server/chat.js (install.js adds it).
// Settings: plugins_configs/chatfilter.json   Log: plugins_configs/chatfilter-log.json
const fs = require('fs');
const path = require('path');
const router = require('../../server/endpoints');
const { logInfo } = require('../../server/console');
const words = require('./words');

const CONF = path.join(__dirname, '../../plugins_configs/chatfilter.json');
const LOG = path.join(__dirname, '../../plugins_configs/chatfilter-log.json');
const CHAT_JS = path.join(__dirname, '../../server/chat.js');
const DEFAULTS = {
    enabled: true, mode: 'block', useBuiltin: true, words: [], checkNicknames: true, blockRepeats: true,
    muteAfter: 3, muteMinutes: 10,
    notice: 'Your message was not sent: please keep the chat friendly. / Το μήνυμα δεν στάλθηκε: παρακαλούμε, ευγένεια στο chat.',
    muted: {}
};
let conf = { ...DEFAULTS };
try { conf = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONF, 'utf8')) }; } catch (_) { saveConf(); }
function saveConf() { try { fs.mkdirSync(path.dirname(CONF), { recursive: true }); fs.writeFileSync(CONF, JSON.stringify(conf, null, 2)); } catch (_) { /* ignore */ } }

let log = [];
try { log = JSON.parse(fs.readFileSync(LOG, 'utf8')); if (!Array.isArray(log)) log = []; } catch (_) { log = []; }
let logTimer = null;
function saveLog() {
    clearTimeout(logTimer);
    logTimer = setTimeout(() => { try { fs.writeFileSync(LOG, JSON.stringify(log.slice(-300))); } catch (_) { /* ignore */ } }, 3000);
}

let compiled = [];
const rebuild = () => { compiled = words.compile([...(conf.useBuiltin ? words.BUILTIN : []), ...conf.words]); };
rebuild();

const stats = { since: Date.now(), checked: 0, blocked: 0, hidden: 0, repeats: 0, mutes: 0 };
const strikes = new Map();   // ip -> [times]
const recent = new Map();    // ip -> [{ text, t }]

const clean = ip => String(ip || '').trim().replace(/^::ffff:/, '');
const isLocal = ip => !ip || ip === '127.0.0.1' || ip === '::1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
// Visitor address: right-most public address in X-Forwarded-For (our proxies are local)
function visitorIp(req) {
    const chain = [...String(req.headers['x-forwarded-for'] || '').split(',').map(clean).filter(Boolean), clean(req.socket && req.socket.remoteAddress)].filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i--) if (!isLocal(chain[i])) return chain[i];
    return chain[chain.length - 1] || '';
}
const decode = s => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

function notify(ws, text) {
    try { ws.send(JSON.stringify({ nickname: '🛡️ Chat Filter', message: text, time: stamp(), id: -1 })); } catch (_) { /* ignore */ }
}
function addLog(e) { log.push({ t: Date.now(), ...e }); if (log.length > 300) log.splice(0, log.length - 300); saveLog(); }
function mutedFor(ip) {
    const until = conf.muted[ip] && conf.muted[ip].until;
    if (!until) return 0;
    if (until <= Date.now()) { delete conf.muted[ip]; saveConf(); return 0; }
    return until - Date.now();
}
function mute(ip, minutes, nickname, reason) {
    conf.muted[ip] = { until: Date.now() + minutes * 60000, nickname: nickname || '', reason: reason || '' };
    stats.mutes++;
    saveConf();
}
function strike(ip, nickname) {
    if (!conf.muteAfter) return false;
    const now = Date.now(), list = (strikes.get(ip) || []).filter(t => now - t < 30 * 60000);
    list.push(now);
    strikes.set(ip, list);
    if (list.length >= conf.muteAfter) { strikes.delete(ip); mute(ip, conf.muteMinutes, nickname, 'automatic'); return true; }
    return false;
}

function filter({ ws, request, message, isAdmin }) {
    if (!conf.enabled || isAdmin) return true;
    stats.checked++;
    const ip = visitorIp(request), nickname = decode(message.nickname), text = String(message.message || '');
    const left = mutedFor(ip);
    if (left) {
        addLog({ ip, nickname, message: text, reason: 'muted' });
        notify(ws, `You are muted in the chat for ${Math.ceil(left / 60000)} more minute(s). / Είστε σε σίγαση για ${Math.ceil(left / 60000)} λεπτά ακόμα.`);
        return false;
    }
    const found = [...words.check(text, compiled).found, ...(conf.checkNicknames ? words.check(nickname, compiled).found : [])];
    if (found.length) {
        if (conf.mode === 'hide' && !(conf.checkNicknames && words.check(nickname, compiled).found.length)) {
            message.message = words.check(text, compiled).masked;
            stats.hidden++;
            addLog({ ip, nickname, message: text, reason: 'hidden', words: found.map(f => f.word) });
            return true;
        }
        stats.blocked++;
        const muted = strike(ip, nickname);
        addLog({ ip, nickname, message: text, reason: 'bad word', words: found.map(f => f.word), muted });
        notify(ws, muted ? `${conf.notice} (Muted for ${conf.muteMinutes} min.)` : conf.notice);
        return false;
    }
    if (conf.blockRepeats) {
        const now = Date.now(), key = text.trim().toLowerCase().replace(/\s+/g, ' ');
        const list = (recent.get(ip) || []).filter(r => now - r.t < 5 * 60000);
        if (key.length > 2 && list.some(r => r.text === key)) {
            stats.repeats++;
            const muted = strike(ip, nickname);
            addLog({ ip, nickname, message: text, reason: 'repeat', muted });
            notify(ws, 'You already sent this message. / Το μήνυμα έχει ήδη σταλεί.' + (muted ? ` (Muted for ${conf.muteMinutes} min.)` : ''));
            return false;
        }
        list.push({ text: key, t: now });
        recent.set(ip, list.slice(-10));
    }
    return true;
}

global.fmdxChatFilters = global.fmdxChatFilters || [];
global.fmdxChatFilters.push(filter);

setInterval(() => {     // forget old repeat/strike memory
    const now = Date.now();
    for (const [ip, l] of recent) if (!l.some(r => now - r.t < 5 * 60000)) recent.delete(ip);
    for (const [ip, l] of strikes) if (!l.some(t => now - t < 30 * 60000)) strikes.delete(ip);
}, 10 * 60000).unref();

function hookInstalled() { try { return fs.readFileSync(CHAT_JS, 'utf8').includes('fmdxChatFilters'); } catch (_) { return false; } }
function admin(req, res, next) {
    if (req.session && req.session.isAdminAuthenticated) return next();
    res.status(403).json({ error: 'admin login required' });
}
const body = req => (req.body && typeof req.body === 'object' ? req.body : {});
function adminData() {
    const now = Date.now();
    const muted = Object.entries(conf.muted).filter(([, m]) => m.until > now)
        .map(([ip, m]) => ({ ip, nickname: m.nickname, reason: m.reason, minutesLeft: Math.ceil((m.until - now) / 60000) }));
    const { muted: _m, ...settings } = conf;
    return { settings, builtin: words.BUILTIN, stats, muted, log: log.slice(-100).reverse(), hookInstalled: hookInstalled() };
}

router.get('/chatfilter/admin', admin, (req, res) => res.json(adminData()));
router.post('/chatfilter/settings', admin, (req, res) => {
    const b = body(req);
    if (typeof b.enabled === 'boolean') conf.enabled = b.enabled;
    if (b.mode === 'block' || b.mode === 'hide') conf.mode = b.mode;
    for (const k of ['useBuiltin', 'checkNicknames', 'blockRepeats']) if (typeof b[k] === 'boolean') conf[k] = b[k];
    if (b.muteAfter !== undefined) conf.muteAfter = Math.min(20, Math.max(0, Math.round(Number(b.muteAfter)) || 0));
    if (b.muteMinutes !== undefined) conf.muteMinutes = Math.min(10080, Math.max(1, Math.round(Number(b.muteMinutes)) || DEFAULTS.muteMinutes));
    if (typeof b.notice === 'string') conf.notice = b.notice.trim().slice(0, 300) || DEFAULTS.notice;
    if (Array.isArray(b.words)) conf.words = [...new Set(b.words.map(w => String(w).trim().slice(0, 60)).filter(Boolean))].slice(0, 2000);
    saveConf();
    rebuild();
    res.json(adminData());
});
router.post('/chatfilter/test', admin, (req, res) => {
    const r = words.check(String(body(req).text || '').slice(0, 500), compiled);
    res.json({ blocked: r.found.length > 0, found: r.found, masked: r.masked });
});
router.post('/chatfilter/mute', admin, (req, res) => {
    const b = body(req), ip = clean(b.ip);
    if (!ip) return res.status(400).json({ error: 'no address' });
    mute(ip, Math.min(10080, Math.max(1, Number(b.minutes) || 60)), String(b.nickname || '').slice(0, 40), 'by admin');
    res.json(adminData());
});
router.post('/chatfilter/unmute', admin, (req, res) => {
    delete conf.muted[clean(body(req).ip)];
    strikes.delete(clean(body(req).ip));
    saveConf();
    res.json(adminData());
});
router.post('/chatfilter/clearlog', admin, (req, res) => { log = []; saveLog(); res.json(adminData()); });

logInfo(`[Chat Filter] ${conf.enabled ? 'on' : 'off'} (${conf.mode}), ${compiled.length} words${hookInstalled() ? '' : ' - WARNING: the chat hook is missing in server/chat.js, run install.js'}`);
module.exports = { _test: { filter, setConf: c => { conf = { ...conf, ...c }; rebuild(); }, reset: () => { strikes.clear(); recent.clear(); conf.muted = {}; log = []; } } };

// Fair Tuner Sharing (server part): when several listeners are connected, the listener
// who tunes "has" the tuner for a short turn; tune commands from the others wait until
// that turn is over, and they see a friendly message with a countdown.
//
// Needs the small "plugin command filter" hook in server/index.js (install.js adds it).
// Settings: plugins_configs/fairshare.json
// Public endpoint: GET /fairshare/status   Admin: GET /fairshare/admin, POST /fairshare/settings
const fs = require('fs');
const path = require('path');
const router = require('../../server/endpoints');
const storage = require('../../server/storage');
const { logInfo } = require('../../server/console');

const CONF = path.join(__dirname, '../../plugins_configs/fairshare.json');
const DEFAULTS = { enabled: true, turnSeconds: 120, maxTurnMinutes: 10, minListeners: 2 };
let conf = { ...DEFAULTS };
try { conf = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONF, 'utf8')) }; } catch (_) { saveConf(); }
function saveConf() { try { fs.mkdirSync(path.dirname(CONF), { recursive: true }); fs.writeFileSync(CONF, JSON.stringify(conf, null, 2)); } catch (_) { /* ignore */ } }

let holder = null;                 // { ip, since, last }
const waiting = new Map();         // ip -> last time a tune was held back
const stats = { since: Date.now(), turns: 0, heldBack: 0 };

const clean = ip => String(ip || '').trim().replace(/^::ffff:/, '');
const isLocal = ip => !ip || ip === '127.0.0.1' || ip === '::1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
// Visitor address: right-most public address in X-Forwarded-For (our proxies are local)
function visitorIp(req) {
    const chain = [...String(req.headers['x-forwarded-for'] || '').split(',').map(clean).filter(Boolean), clean(req.socket && req.socket.remoteAddress)].filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i--) if (!isLocal(chain[i])) return chain[i];
    return chain[chain.length - 1] || '';
}
const listeners = () => (storage.connectedUsers || []).filter(u => clean(u.ip) !== '127.0.0.1' && clean(u.ip) !== '::1');
const connected = ip => listeners().some(u => clean(u.ip) === ip);

function turnLeft(now) {
    if (!holder) return 0;
    const byIdle = holder.last + conf.turnSeconds * 1000 - now;
    const byMax = holder.since + conf.maxTurnMinutes * 60000 - now;
    return Math.max(0, Math.min(byIdle, byMax));
}

function filter({ request, command, isAdmin }) {
    if (!conf.enabled || !/^[TZ]/.test(command)) return true;
    const ip = visitorIp(request);
    if (isAdmin || isLocal(ip)) return true;                      // admin and own network: always
    const now = Date.now();
    if (holder && !connected(holder.ip)) holder = null;           // holder left
    if (listeners().length < conf.minListeners) { holder = { ip, since: holder && holder.ip === ip ? holder.since : now, last: now }; return true; }
    if (!holder || holder.ip === ip || turnLeft(now) === 0) {
        if (!holder || holder.ip !== ip) { holder = { ip, since: now, last: now }; stats.turns++; }
        else holder.last = now;
        waiting.delete(ip);
        return true;
    }
    waiting.set(ip, now);
    stats.heldBack++;
    return false;                                                 // someone else's turn
}

global.fmdxCommandFilters = global.fmdxCommandFilters || [];
global.fmdxCommandFilters.push(filter);

router.get('/fairshare/status', (req, res) => {
    const ip = visitorIp(req), now = Date.now();
    if (holder && !connected(holder.ip)) holder = null;
    const n = listeners().length;
    const active = conf.enabled && n >= conf.minListeners && !!holder && turnLeft(now) > 0;
    let you = 'free';
    if (active && holder.ip === ip) you = [...waiting.entries()].some(([w, t]) => w !== ip && now - t < 60000) ? 'holder-waited' : 'holder';
    else if (active) you = 'wait';
    res.set('Cache-Control', 'no-store').json({ enabled: conf.enabled, you, secondsLeft: active ? Math.ceil(turnLeft(now) / 1000) : 0 });
});

function admin(req, res, next) {
    if (req.session && req.session.isAdminAuthenticated) return next();
    res.status(403).json({ error: 'admin login required' });
}

// The one line Fair Tuner Sharing needs in server/index.js (missing when the plugin was copied by hand)
const INDEX_JS = path.join(__dirname, '../../server/index.js');
const fairHook = require('./hook');
const hookInstalled = () => { try { return fairHook.status(INDEX_JS) === 'ok'; } catch (_) { return false; } };
let hookAddedNow = false;   // added by the button: works after the next restart
// Changes to FM-DX itself only from this server's own page (no forged requests from other sites)
function ownPage(req) {
    try { return [req.headers['x-forwarded-host'], req.headers.host].filter(Boolean).map(h => String(h).split(',')[0].trim().toLowerCase()).includes(new URL(req.headers.origin || req.headers.referer).host.toLowerCase()); } catch (_) { return false; }
}

router.get('/fairshare/admin', admin, (req, res) => res.json({ settings: conf, stats, hookInstalled: hookInstalled(), hookAddedNow, listeners: listeners().length,
    turnNow: holder && turnLeft(Date.now()) > 0 ? { secondsLeft: Math.ceil(turnLeft(Date.now()) / 1000) } : null }));
router.post('/fairshare/settings', admin, (req, res) => {
    const q = req.query;
    if (q.enabled !== undefined) conf.enabled = q.enabled === 'true';
    if (q.turnSeconds !== undefined) conf.turnSeconds = Math.min(1800, Math.max(30, Number(q.turnSeconds) || DEFAULTS.turnSeconds));
    if (q.maxTurnMinutes !== undefined) conf.maxTurnMinutes = Math.min(120, Math.max(2, Number(q.maxTurnMinutes) || DEFAULTS.maxTurnMinutes));
    if (q.minListeners !== undefined) conf.minListeners = Math.min(1000, Math.max(2, Number(q.minListeners) || DEFAULTS.minListeners));
    saveConf();
    res.json({ settings: conf });
});

// "Fix it now" in the Setup tab: adds the line to server/index.js (same as install.js)
router.post('/fairshare/installhook', admin, (req, res) => {
    if (!ownPage(req)) return res.status(403).json({ error: 'This must come from the server\'s own Setup page.' });
    let r;
    try { r = fairHook.install(INDEX_JS); } catch (e) { return res.status(500).json({ error: 'Could not change server/index.js: ' + e.message }); }
    if (r === 'unknown') return res.status(409).json({ error: 'server/index.js looks different (Fair Tuner Sharing is made for FM-DX 1.4.x), so it was not changed.' });
    hookAddedNow = true;
    logInfo(`[Fair Tuner Sharing] tuner line ${r} in server/index.js from the Setup page; restart FM-DX to start sharing`);
    res.json({ ok: true });
});

logInfo(`[Fair Tuner Sharing] active: ${conf.enabled ? 'on' : 'off'}, turn ${conf.turnSeconds} s (max ${conf.maxTurnMinutes} min) when ${conf.minListeners}+ listeners${hookInstalled() ? '' : ' - WARNING: the tuner line is missing in server/index.js: press "Fix it now" in Setup → Fair Tuner Sharing (or run install.js), then restart'}`);
module.exports = { _test: { filter, setConf: c => { conf = { ...conf, ...c }; }, reset: () => { holder = null; waiting.clear(); } } };

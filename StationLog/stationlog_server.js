// Station Log (server part): logs every station the tuner receives, automatically.
// A station is logged when the same frequency + RDS PI code is received for a few
// seconds (listeners tuning around, presets, the Scanner plugin all count).
//
// Data: plugins_configs/stationlog.json (kept by the plugin, saved every 30 seconds)
// Admin endpoints:  GET /stationlog/list, GET /stationlog/csv, POST /stationlog/delete?key=..
// Public endpoint (only when "publicList" is true): GET /stationlog/public
const fs = require('fs');
const path = require('path');
const router = require('../../server/endpoints');
const dataHandler = require('../../server/datahandler');
const { logInfo } = require('../../server/console');

const DATA = path.join(__dirname, '../../plugins_configs/stationlog.json');
const MIN_SECONDS = 5;          // same frequency + PI for this long = a reception
let db = { settings: { publicList: false }, stations: {} };
let current = null;             // { key, since, freq, pi }
let dirty = false;

try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA, 'utf8')) }; } catch (_) { /* first run */ }

function save() {
    if (!dirty) return;
    try {
        fs.mkdirSync(path.dirname(DATA), { recursive: true });
        fs.writeFileSync(DATA + '.tmp', JSON.stringify(db));
        fs.renameSync(DATA + '.tmp', DATA);
        dirty = false;
    } catch (_) { /* try again next minute */ }
}

function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function sample() {
    const d = dataHandler.dataToSend;
    const pi = String(d.pi || '').replace(/\?/g, '').toUpperCase();
    const freq = Number(d.freq);
    if (!pi || pi.length < 4 || !isFinite(freq)) { current = null; return; }
    const key = freq.toFixed(1) + '|' + pi;
    const now = Date.now();
    if (!current || current.key !== key) { current = { key, since: now }; return; }
    if (now - current.since < MIN_SECONDS * 1000) return;

    const tx = d.txInfo || {};
    let s = db.stations[key];
    if (!s) {
        s = db.stations[key] = { freq: Number(freq.toFixed(1)), pi, ps: '', psCounts: {}, name: '', city: '', itu: '',
            erp: '', dist: '', bestSig: -999, firstHeard: now, lastHeard: now, seconds: 0, times: 0 };
        s.times = 1;
        logInfo(`[Station Log] new station: ${freq.toFixed(1)} MHz, PI ${pi}${tx.tx ? ', ' + clean(tx.tx) : ''}`);
    } else if (now - s.lastHeard > 10 * 60 * 1000) {
        s.times++;
    }
    s.lastHeard = now;
    s.seconds++;
    const sig = Number(d.sig);
    if (isFinite(sig) && sig > s.bestSig) s.bestSig = Math.round(sig * 10) / 10;
    const ps = clean(d.ps);
    if (ps && !ps.includes('?') && ps.length >= 2) {
        s.psCounts[ps] = (s.psCounts[ps] || 0) + 1;
        s.ps = Object.entries(s.psCounts).sort((a, b) => b[1] - a[1])[0][0];
        if (Object.keys(s.psCounts).length > 12) {             // keep the most common texts only
            s.psCounts = Object.fromEntries(Object.entries(s.psCounts).sort((a, b) => b[1] - a[1]).slice(0, 8));
        }
    }
    if (tx.tx) { s.name = clean(tx.tx); s.city = clean(tx.city); s.itu = clean(tx.itu); s.erp = clean(tx.erp); s.dist = clean(tx.dist); }
    dirty = true;
}

function list() {
    return Object.entries(db.stations).map(([key, s]) => ({ key, freq: s.freq, pi: s.pi, ps: s.ps, name: s.name, city: s.city,
        itu: s.itu, erp: s.erp, dist: s.dist, bestSig: s.bestSig, firstHeard: s.firstHeard, lastHeard: s.lastHeard,
        minutes: Math.round(s.seconds / 60), times: s.times })).sort((a, b) => a.freq - b.freq);
}

function admin(req, res, next) {
    if (req.session && req.session.isAdminAuthenticated) return next();
    res.status(403).json({ error: 'admin login required' });
}

router.get('/stationlog/list', admin, (req, res) => res.json({ settings: db.settings, stations: list() }));
router.get('/stationlog/public', (req, res) => {
    if (!db.settings.publicList) return res.status(404).json({ error: 'not public' });
    res.json(list().map(({ freq, pi, ps, name, city, itu, dist, bestSig, lastHeard }) => ({ freq, pi, ps, name, city, itu, dist, bestSig, lastHeard })));
});
router.get('/stationlog/csv', admin, (req, res) => {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Frequency MHz', 'PI', 'PS', 'Station', 'City', 'Country', 'ERP kW', 'Distance km', 'Best signal dBf', 'First heard', 'Last heard', 'Minutes heard']]
        .concat(list().map(s => [s.freq.toFixed(1), s.pi, s.ps, s.name, s.city, s.itu, s.erp, s.dist, s.bestSig,
            new Date(s.firstHeard).toISOString(), new Date(s.lastHeard).toISOString(), s.minutes]));
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="station-log.csv"')
        .send('﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'));
});
router.post('/stationlog/settings', admin, (req, res) => {
    if (typeof req.query.publicList !== 'undefined') db.settings.publicList = req.query.publicList === 'true';
    dirty = true; save();
    res.json({ settings: db.settings });
});
router.post('/stationlog/delete', admin, (req, res) => {
    const had = delete db.stations[String(req.query.key || '')];
    dirty = true; save();
    res.json({ deleted: had });
});

setInterval(sample, 1000).unref();
setInterval(save, 30 * 1000).unref();      // saved every 30 s (a restart loses at most 30 s)
logInfo(`[Station Log] active, ${Object.keys(db.stations).length} stations in the log`);

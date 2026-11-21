// Antenna Advisor (server part): for tuners with two or more antennas, compares them on the
// CURRENT frequency and tells you which one receives best. It briefly switches each antenna,
// measures signal, RDS decoding, stereo and PS errors, then restores the antenna you were on.
//
// Only an admin can start a comparison (it flickers everyone's audio for a few seconds). The
// result is public (read-only) so listeners can see the recommended antenna. On a tuner with a
// single antenna the plugin stays dormant.
//
// Needs the tuner's own antenna list and the privileged command path (server/plugins_api), both
// present in FM-DX 1.4.x. Data: plugins_configs/antennaadvisor.json (last result per frequency).
// Public:  GET /antennaadvisor/status
// Admin:   GET /antennaadvisor/admin , POST /antennaadvisor/run
const fs = require('fs');
const path = require('path');
const router = require('../../server/endpoints');
const dataHandler = require('../../server/datahandler');
const storage = require('../../server/storage');
const { logInfo, logWarn } = require('../../server/console');
const api = (() => { try { return require('../../server/plugins_api'); } catch (_) { return null; } })();

const DATA = path.join(__dirname, '../../plugins_configs/antennaadvisor.json');
const SETTLE_MS = 1500;          // let the AGC settle after a switch
const STEP_MS = 200;             // sample period
const KEEP = 300;                // remember results for this many frequencies
const DEPTHS = { quick: 2000, standard: 3000, thorough: 5000 };   // how long to measure each antenna
const SCAN_SETTLE_MS = 700;      // wait after tuning before reading the signal (longer = no stale reading from the previous channel)

let db = { settings: { depth: 'standard', scanThreshold: 30 }, results: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA, 'utf8')) }; } catch (_) { /* first run */ }
if (!DEPTHS[db.settings.depth]) db.settings.depth = 'standard';
if (!(Number(db.settings.scanThreshold) >= 0)) db.settings.scanThreshold = 30;
let running = false;
// Progress of a full-band scan (admin starts it, the page polls it).
let scan = { active: false, cancel: false, done: 0, total: 0, found: 0, current: null, startedAt: 0 };
const sampleMs = () => DEPTHS[db.settings.depth] || DEPTHS.standard;
const perAntennaSeconds = () => Math.round((SETTLE_MS + sampleMs()) / 100) / 10;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = ip => String(ip || '').trim().replace(/^::ffff:/, '');
const listeners = () => (storage.connectedUsers || []).filter(u => clean(u.ip) !== '127.0.0.1' && clean(u.ip) !== '::1').length;

function save() {
    const keys = Object.keys(db.results);
    if (keys.length > KEEP) { keys.sort((a, b) => (db.results[a].ts || 0) - (db.results[b].ts || 0)); while (Object.keys(db.results).length > KEEP) delete db.results[keys.shift()]; }
    try { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA + '.tmp', JSON.stringify(db)); fs.renameSync(DATA + '.tmp', DATA); } catch (_) { /* next time */ }
}

// The tuner's enabled antennas, as [{ z, name }] (z is the Z<n> switch index). Empty if the
// tuner has antenna switching off or this FM-DX build does not expose the config.
function antennas() {
    const cfg = (api && api.getServerConfig && api.getServerConfig()) || {};
    const a = cfg.antennas;
    if (!a || a.enabled === false) return [];
    const out = [];
    for (let i = 1; i <= 4; i++) { const e = a['ant' + i]; if (e && e.enabled) out.push({ z: i - 1, name: String(e.name || ('Antenna ' + i)).trim() || ('Antenna ' + i) }); }
    return out;
}
const applicable = () => antennas().length >= 2;
const hasCommandApi = () => !!(api && typeof api.sendPrivilegedCommand === 'function');
const currentAntZ = () => { const v = parseInt(String((dataHandler.dataToSend || {}).ant), 10); return isFinite(v) ? v : 0; };
const curFreq = () => { const f = Number((dataHandler.dataToSend || {}).freq); return isFinite(f) ? f : null; };
const freqKey = f => (f == null ? '' : Number(f).toFixed(1));
const sendZ = z => api.sendPrivilegedCommand('Z' + z, true);
const tuneTo = mhz => api.sendPrivilegedCommand('T' + Math.round(Number(mhz) * 1000), true);

// The frequency range to sweep for a full-band scan: the tuner's own limits if sane, else the FM band.
function bandRange() {
    const w = ((api && api.getServerConfig && api.getServerConfig()) || {}).webserver || {};
    let lo = Number(w.tuningLowerLimit), hi = Number(w.tuningUpperLimit);
    if (!isFinite(lo) || !isFinite(hi) || lo >= hi || lo < 40 || hi > 140) { lo = 87.5; hi = 108.0; }
    return { lo, hi, step: 0.1 };
}

// Switch to antenna z, let it settle, then sample the live data for `ms` (default: the depth setting).
async function measure(z, ms) {
    await sendZ(z);
    await sleep(SETTLE_MS);
    const sigs = [], psErr = [];
    let rds = 0, stereo = 0, n = 0;
    const end = Date.now() + (ms || sampleMs());
    while (Date.now() < end) {
        const d = dataHandler.dataToSend || {};
        const s = Number(d.sig); if (isFinite(s)) sigs.push(s);
        const pe = Number(d.ps_errors); if (isFinite(pe)) psErr.push(pe);
        if (d.pi && String(d.pi).replace(/\?/g, '').length >= 4) rds++;
        if (d.st === true || Number(d.st) === 1) stereo++;
        n++;
        await sleep(STEP_MS);
    }
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const r1 = x => x == null ? null : Math.round(x * 10) / 10;
    return { z, sigAvg: r1(avg(sigs)), sigTop: sigs.length ? r1(Math.max(...sigs)) : null,
        psErrAvg: r1(avg(psErr)), rdsRatio: n ? rds / n : 0, stereoRatio: n ? stereo / n : 0, samples: n };
}

// Winner: strongest average signal; ties within 0.8 dB broken by RDS decoding, then stereo, then fewer PS errors.
function pickWinner(res) {
    const pool = res.slice().sort((a, b) => {
        const ds = (b.sigAvg == null ? -999 : b.sigAvg) - (a.sigAvg == null ? -999 : a.sigAvg);
        if (Math.abs(ds) >= 0.8) return ds;
        if ((b.rdsRatio || 0) !== (a.rdsRatio || 0)) return (b.rdsRatio || 0) - (a.rdsRatio || 0);
        if ((b.stereoRatio || 0) !== (a.stereoRatio || 0)) return (b.stereoRatio || 0) - (a.stereoRatio || 0);
        return (a.psErrAvg == null ? 999 : a.psErrAvg) - (b.psErrAvg == null ? 999 : b.psErrAvg);
    });
    return pool.length ? pool[0].z : null;
}

// Save a comparison for a frequency: keep the latest measurement, and keep a small tally
// (how many times tested, and how often each antenna won) so repeat tests show a stable winner.
function record(freq, results, winnerZ, note) {
    const key = freqKey(freq);
    const prev = db.results[key] || {};
    const wins = { ...(prev.wins || {}) };
    if (winnerZ != null) wins[winnerZ] = (wins[winnerZ] || 0) + 1;
    const rec = { freq, ts: Date.now(), listeners: listeners(), antennas: results, winnerZ,
        note: note || '', tested: (prev.tested || 0) + 1, wins };
    db.results[key] = rec; save();
    return rec;
}

function admin(req, res, next) {
    if (req.session && req.session.isAdminAuthenticated) return next();
    res.status(403).json({ error: 'admin login required' });
}

// Public: the last comparison for a frequency (default: the current one), plus whether the plugin applies here.
router.get('/antennaadvisor/status', (req, res) => {
    const ants = antennas();
    const f = req.query.freq != null ? Number(req.query.freq) : curFreq();
    const rec = db.results[freqKey(f)] || null;
    const nameOf = z => { const a = ants.find(x => x.z === z); return a ? a.name : ('Antenna ' + (z + 1)); };
    res.set('Cache-Control', 'no-store').json({
        applicable: applicable(), antennas: ants, currentZ: currentAntZ(), running,
        freq: f, best: rec ? { z: rec.winnerZ, name: nameOf(rec.winnerZ), ts: rec.ts } : null
    });
});

router.get('/antennaadvisor/admin', admin, (req, res) => {
    res.json({ applicable: applicable(), hasCommandApi: hasCommandApi(), antennas: antennas(), currentZ: currentAntZ(), currentFreq: curFreq(),
        running, scan, band: bandRange(), listeners: listeners(), settings: db.settings, depths: Object.keys(DEPTHS),
        perAntennaSeconds: perAntennaSeconds(), totalSeconds: Math.round(perAntennaSeconds() * Math.max(2, antennas().length) * 10) / 10,
        current: db.results[freqKey(curFreq())] || null, results: db.results });
});

// Live progress of a full-band scan (the Setup page polls this).
router.get('/antennaadvisor/scan/status', admin, (req, res) => res.set('Cache-Control', 'no-store').json(scan));

router.post('/antennaadvisor/settings', admin, (req, res) => {
    if (DEPTHS[req.query.depth]) db.settings.depth = req.query.depth;
    if (req.query.scanThreshold != null) { const t = Number(req.query.scanThreshold); if (isFinite(t)) db.settings.scanThreshold = Math.max(0, Math.min(80, t)); }
    save();
    res.json({ settings: db.settings, perAntennaSeconds: perAntennaSeconds() });
});

// Admin only: forget saved comparisons. ?freq=98.3 removes one; no freq clears all.
router.post('/antennaadvisor/clear', admin, (req, res) => {
    if (req.query.freq != null) { const k = freqKey(Number(req.query.freq)); const had = !!db.results[k]; delete db.results[k]; save(); return res.json({ cleared: had ? 1 : 0 }); }
    const n = Object.keys(db.results).length; db.results = {}; save();
    res.json({ cleared: n });
});

// Admin only: stop a running full-band scan.
router.post('/antennaadvisor/scan/cancel', admin, (req, res) => { if (scan.active) scan.cancel = true; res.json({ ok: true }); });

// Admin only: run a comparison on the current frequency. Switches each antenna, measures, restores.
router.post('/antennaadvisor/run', admin, async (req, res) => {
    const ants = antennas();
    if (ants.length < 2) return res.status(409).json({ error: 'This tuner has fewer than two antennas, so there is nothing to compare.' });
    if (!hasCommandApi()) return res.status(501).json({ error: 'This FM-DX build does not expose the plugin command API, so the antenna cannot be switched.' });
    if (running) return res.status(409).json({ error: 'A comparison is already running.' });
    const freq = curFreq();
    if (freq == null) return res.status(409).json({ error: 'No frequency is tuned right now.' });

    running = true;
    const original = currentAntZ();
    logInfo(`[Antenna Advisor] comparing ${ants.length} antennas on ${freq.toFixed(1)} MHz (${listeners()} listening)`);
    try {
        const results = [];
        for (const a of ants) results.push({ name: a.name, ...(await measure(a.z)) });
        await sendZ(original);                                   // always put the antenna back
        const winnerZ = pickWinner(results);
        results.forEach(r => { r.winner = r.z === winnerZ; });
        const changed = curFreq() != null && Math.abs(curFreq() - freq) > 0.05;
        const rec = record(freq, results, winnerZ, changed ? 'the frequency changed during the test, so the result may be unreliable' : '');
        logInfo(`[Antenna Advisor] winner on ${freq.toFixed(1)} MHz: ${(results.find(r => r.winner) || {}).name || '?'}`);
        res.json(rec);
    } catch (e) {
        try { await sendZ(original); } catch (_) { /* best effort */ }
        logWarn(`[Antenna Advisor] comparison failed: ${e.message}`);
        res.status(500).json({ error: 'Comparison failed: ' + e.message });
    } finally { running = false; }
});

// Quickly read the current signal (average over ~600 ms) to decide if a station is present.
async function signalHere() {
    await sleep(SCAN_SETTLE_MS);                                 // let the tuner settle on the new frequency
    const sigs = [];
    const end = Date.now() + 600;
    while (Date.now() < end) { const s = Number((dataHandler.dataToSend || {}).sig); if (isFinite(s)) sigs.push(s); await sleep(STEP_MS); }
    return sigs.length ? sigs.reduce((a, b) => a + b, 0) / sigs.length : null;
}

// Admin only: sweep the band and compare antennas wherever a signal is found (quick depth).
// Starts in the background and answers right away; the page polls /antennaadvisor/scan/status.
router.post('/antennaadvisor/scan', admin, async (req, res) => {
    const ants = antennas();
    if (ants.length < 2) return res.status(409).json({ error: 'This tuner has fewer than two antennas, so there is nothing to compare.' });
    if (!hasCommandApi()) return res.status(501).json({ error: 'This FM-DX build does not expose the plugin command API, so the antenna cannot be switched.' });
    if (running || scan.active) return res.status(409).json({ error: 'A comparison or scan is already running.' });

    const { lo, hi, step } = bandRange();
    const threshold = Number(db.settings.scanThreshold);
    const total = Math.round((hi - lo) / step) + 1;
    const originalFreq = curFreq();
    const originalAnt = currentAntZ();
    running = true;
    scan = { active: true, cancel: false, done: 0, total, found: 0, current: null, startedAt: Date.now() };
    logInfo(`[Antenna Advisor] full-band scan ${lo.toFixed(1)}-${hi.toFixed(1)} MHz, ${total} channels, signal ≥ ${threshold} dBf (${listeners()} listening)`);
    res.json({ started: true, total, band: { lo, hi }, threshold });

    (async () => {
        try {
            for (let i = 0; i < total; i++) {
                if (scan.cancel) break;
                const f = Math.round((lo + i * step) * 10) / 10;
                scan.current = f; scan.done = i;
                await tuneTo(f);
                await sendZ(originalAnt);          // always probe on the same reference antenna, so detection is consistent
                const sig = await signalHere();
                if (sig != null && sig >= threshold) {
                    const results = [];
                    for (const a of ants) results.push({ name: a.name, ...(await measure(a.z, DEPTHS.quick)) });
                    const winnerZ = pickWinner(results);
                    results.forEach(r => { r.winner = r.z === winnerZ; });
                    record(f, results, winnerZ, 'full-band scan (quick)');
                    scan.found++;
                }
            }
            scan.done = scan.cancel ? scan.done : total;
        } catch (e) {
            logWarn(`[Antenna Advisor] scan failed: ${e.message}`);
        } finally {
            try { await sendZ(originalAnt); } catch (_) { /* best effort */ }
            try { if (originalFreq != null) await tuneTo(originalFreq); } catch (_) { /* best effort */ }
            logInfo(`[Antenna Advisor] full-band scan ${scan.cancel ? 'cancelled' : 'finished'}: ${scan.found} station(s) compared`);
            scan.active = false; scan.current = null; running = false;
        }
    })();
});

logInfo(`[Antenna Advisor] ${applicable() ? 'active, ' + antennas().length + ' antennas' + (hasCommandApi() ? '' : ' - but this FM-DX build has no plugin command API, so it cannot switch') : 'idle: this tuner has a single antenna'}`);
module.exports = { _test: { antennas, pickWinner, measure, applicable, record, bandRange, getDb: () => db, setDb: d => { db = d; } } };

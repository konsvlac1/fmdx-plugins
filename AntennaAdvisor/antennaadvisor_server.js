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

let db = { settings: { depth: 'standard' }, results: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA, 'utf8')) }; } catch (_) { /* first run */ }
if (!DEPTHS[db.settings.depth]) db.settings.depth = 'standard';
let running = false;
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

// Switch to antenna z, let it settle, then sample the live data for SAMPLE_MS.
async function measure(z) {
    await sendZ(z);
    await sleep(SETTLE_MS);
    const sigs = [], psErr = [];
    let rds = 0, stereo = 0, n = 0;
    const end = Date.now() + sampleMs();
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
    res.json({ applicable: applicable(), hasCommandApi: hasCommandApi(), antennas: antennas(), currentZ: currentAntZ(),
        running, listeners: listeners(), settings: db.settings, depths: Object.keys(DEPTHS),
        perAntennaSeconds: perAntennaSeconds(), totalSeconds: Math.round(perAntennaSeconds() * Math.max(2, antennas().length) * 10) / 10,
        current: db.results[freqKey(curFreq())] || null, results: db.results });
});

router.post('/antennaadvisor/settings', admin, (req, res) => {
    if (DEPTHS[req.query.depth]) { db.settings.depth = req.query.depth; save(); }
    res.json({ settings: db.settings, perAntennaSeconds: perAntennaSeconds() });
});

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
        const rec = { freq, ts: Date.now(), listeners: listeners(), antennas: results, winnerZ,
            note: changed ? 'the frequency changed during the test, so the result may be unreliable' : '' };
        db.results[freqKey(freq)] = rec; save();
        logInfo(`[Antenna Advisor] winner on ${freq.toFixed(1)} MHz: ${(results.find(r => r.winner) || {}).name || '?'}`);
        res.json(rec);
    } catch (e) {
        try { await sendZ(original); } catch (_) { /* best effort */ }
        logWarn(`[Antenna Advisor] comparison failed: ${e.message}`);
        res.status(500).json({ error: 'Comparison failed: ' + e.message });
    } finally { running = false; }
});

logInfo(`[Antenna Advisor] ${applicable() ? 'active, ' + antennas().length + ' antennas' + (hasCommandApi() ? '' : ' - but this FM-DX build has no plugin command API, so it cannot switch') : 'idle: this tuner has a single antenna'}`);
module.exports = { _test: { antennas, pickWinner, measure, applicable } };

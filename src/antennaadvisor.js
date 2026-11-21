// Antenna Advisor (page part):
//   - main page: a small read-only pill with the recommended antenna for the current frequency
//   - Setup page: an "Antenna Advisor" tab where an admin runs a comparison and sees the results
(function () {
    'use strict';
    const esc = window.fmdxEsc, api = window.fmdxApi;
    function addStyle() {
        if (document.getElementById('aa-style')) return;
        const st = document.createElement('style');
        st.id = 'aa-style';
        st.textContent = '.aa-num{width:58px;padding:3px 6px;margin:0 4px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit}' +
            '.aa-link{background:none!important;border:none!important;padding:2px 6px!important;margin:0 0 0 6px!important;font-size:12px!important;opacity:.75;cursor:pointer;width:auto!important;min-width:0!important;color:inherit}' +
            '.aa-link:hover{opacity:1}.aa-scan{margin:4px 0}';
        document.head.appendChild(st);
    }
    const ago = t => { if (!t) return ''; const s = Math.round((Date.now() - t) / 1000); if (s < 60) return 'just now'; const m = Math.round(s / 60); if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; return Math.round(h / 24) + ' d ago'; };

    // ---------- main page: read-only "best antenna here" pill ----------
    function mainPage() {
        if (document.getElementById('plugins-tab')) return;          // not on the Setup page
        const pill = document.createElement('div');
        pill.id = 'aa-pill';
        pill.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99997;max-width:72vw;padding:7px 12px;border-radius:12px;' +
            'background:var(--color-2,#333);color:var(--color-text,#fff);border:1px solid var(--color-4,#888);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px;display:none';
        document.body.appendChild(pill);
        async function poll() {
            try {
                const s = await fetch('/antennaadvisor/status', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json());
                if (s && s.applicable && s.best && s.best.name) { pill.innerHTML = `📡 Best antenna here: <b>${esc(s.best.name)}</b>`; pill.style.display = ''; }
                else pill.style.display = 'none';
            } catch (_) { /* ignore */ }
        }
        poll();
        setInterval(() => { if (!document.hidden) poll(); }, 10000);
    }

    // ---------- Setup page (admin) ----------
    const fmtFreq = f => (f == null ? null : Number(f).toFixed(1) + ' MHz');
    function resultTable(rec, freq) {
        if (!rec || !rec.antennas) return `<div class="kv-empty">No comparison yet on <b>${freq ? esc(freq) : 'this frequency'}</b>. Press “Compare now”.</div>`;
        const rows = rec.antennas.map(r => `<tr${r.winner ? ' style="color:#8d8;font-weight:700"' : ''}>
            <td>${r.winner ? '🏆 ' : ''}${esc(r.name)}</td>
            <td>${r.sigAvg == null ? '–' : r.sigAvg + ' dBf'}</td>
            <td>${r.sigTop == null ? '–' : r.sigTop}</td>
            <td>${Math.round((r.rdsRatio || 0) * 100)}%</td>
            <td>${Math.round((r.stereoRatio || 0) * 100)}%</td>
            <td>${r.psErrAvg == null ? '–' : r.psErrAvg}</td></tr>`).join('');
        return `<p class="kv-sub">${rec.freq ? Number(rec.freq).toFixed(1) + ' MHz' : ''} · ${ago(rec.ts)}${rec.listeners ? ' · ' + rec.listeners + ' listening' : ''}${rec.note ? ` · <span style="color:#fc6">${esc(rec.note)}</span>` : ''}</p>
            <table><tr><th>Antenna</th><th>Avg signal</th><th>Peak</th><th>RDS</th><th>Stereo</th><th>PS err</th></tr>${rows}</table>`;
    }

    // "Antenna A — 7/8": how often the winner won here, out of how many tests.
    function tally(r) {
        if (!r || !r.tested || r.tested < 2) return '';
        const w = (r.antennas || []).find(x => x.winner) || {};
        const wins = (r.wins && r.winnerZ != null) ? (r.wins[r.winnerZ] || 0) : 0;
        return wins ? `${esc(w.name || '')} ${wins}/${r.tested}` : `${r.tested} tests`;
    }

    function scanBlock(a) {
        const s = a.scan || {};
        if (s.active) {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return `<div class="aa-scan"><p class="kv-sub">⏳ Scanning <b>${s.current != null ? Number(s.current).toFixed(1) + ' MHz' : '…'}</b> — ${s.done}/${s.total} channels (${pct}%), <b>${s.found}</b> station(s) compared so far.</p>
                <button data-act="cancelscan">■ Cancel scan</button></div>`;
        }
        return `<div class="aa-scan"><div class="kv-sub">Full-band scan compares your antennas on <b>every station with signal</b> from ${Number(a.band.lo).toFixed(1)} to ${Number(a.band.hi).toFixed(1)} MHz (quick), building a best-antenna map. It takes over the tuner for a few minutes — <b>nobody can listen while it runs</b>.</div>
            <div style="margin-top:6px">Signal threshold <input class="aa-num" data-thr type="number" min="0" max="80" step="1" value="${esc(a.settings.scanThreshold)}"> dBf
            <button data-act="scan">▶ Full-band scan</button></div></div>`;
    }

    async function load(box) {
        let a;
        try { a = await api('GET', '/antennaadvisor/admin'); } catch (e) { box.innerHTML = `<div class="kv-empty">Could not load Antenna Advisor (${esc(e.message)}).</div>`; return; }
        if (!a.applicable) { box.innerHTML = `<p class="kv-sub">This tuner has a single antenna, so the Antenna Advisor isn’t needed here. It becomes active automatically on tuners with two or more antennas.</p>`; return; }
        if (!a.hasCommandApi) { box.innerHTML = `<p style="color:#f66">This FM-DX build does not expose the plugin command interface, so the antenna cannot be switched. Antenna Advisor needs FM-DX 1.4.x.</p>`; return; }
        const depthBtns = a.depths.map(d => `<button data-depth="${d}" class="${d === a.settings.depth ? 'kv-on' : ''}">${d.charAt(0).toUpperCase() + d.slice(1)}</button>`).join('');
        const antList = a.antennas.map(x => `${esc(x.name)}${x.z === a.currentZ ? ' <small style="color:#8d8">(now)</small>' : ''}`).join(' · ');
        const recs = Object.values(a.results || {}).sort((x, y) => (y.ts || 0) - (x.ts || 0));
        box.innerHTML = `
            <p class="kv-sub">Compares your antennas on the frequency you are tuned to <b>right now</b> and tells you which one receives best
              (signal, RDS decoding, stereo and PS errors), then puts the antenna back. Only you (admin) can run it; listeners can see the result.</p>
            <h3>Antennas</h3><div class="kv-sub">${antList}</div>
            <h3>How thorough</h3><div>${depthBtns}</div>
            <div class="kv-sub">Measures each antenna for about <b>${a.perAntennaSeconds}s</b> — roughly <b>${a.totalSeconds}s</b> total for ${a.antennas.length} antennas.</div>
            ${a.listeners ? `<p style="color:#fc6">⚠️ ${a.listeners} listener(s) connected — a comparison briefly flickers their audio while it switches antennas.</p>` : ''}
            <div style="margin-top:8px">${a.currentFreq != null ? `Tuned now: <b>${esc(fmtFreq(a.currentFreq))}</b> · ` : ''}<button data-act="run">▶ Compare now${a.currentFreq != null ? ' (' + esc(fmtFreq(a.currentFreq)) + ')' : ''}</button></div>
            <h3>Result</h3><div class="aa-result">${resultTable(a.current, fmtFreq(a.currentFreq))}</div>
            <h3>Full-band scan</h3>${scanBlock(a)}
            ${recs.length ? `<h3>Recent comparisons <button class="aa-link" data-act="clearall">Clear all</button></h3>
                <table><tr><th>Frequency</th><th>Best antenna</th><th>Consistency</th><th>When</th><th></th></tr>${
                recs.slice(0, 40).map(r => { const w = (r.antennas || []).find(x => x.winner) || {}; return `<tr><td>${Number(r.freq).toFixed(1)} MHz</td><td>${esc(w.name || '–')}</td><td class="kv-sub">${tally(r)}</td><td>${ago(r.ts)}</td><td><button class="aa-link" data-clear="${esc(Number(r.freq).toFixed(1))}" title="Delete">🗑</button></td></tr>`; }).join('')}</table>` : ''}`;
        if ((a.scan || {}).active) pollScan(box);
    }

    let polling = false;
    async function pollScan(box) {
        if (polling) return; polling = true;
        try {
            while (true) {
                await new Promise(r => setTimeout(r, 1500));
                let s; try { s = await api('GET', '/antennaadvisor/scan/status'); } catch (_) { break; }
                if (!s || !s.active) break;
                const el = box.querySelector('.aa-scan .kv-sub');
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                if (el) el.innerHTML = `⏳ Scanning <b>${s.current != null ? Number(s.current).toFixed(1) + ' MHz' : '…'}</b> — ${s.done}/${s.total} channels (${pct}%), <b>${s.found}</b> station(s) compared so far.`;
            }
        } finally { polling = false; load(box); }
    }

    function setupPage() {
        let wired = false;
        window.fmdxSetupTab({ id: 'antennaadvisor', title: 'Antenna Advisor', icon: 'fa-tower-broadcast', onShow: box => {
            if (!wired) {
                wired = true;
                box.addEventListener('click', async e => {
                    const b = e.target.closest('button[data-depth], button[data-act], button[data-clear]');
                    if (!b) return;
                    e.preventDefault();
                    if (b.dataset.depth) {
                        try { await api('POST', '/antennaadvisor/settings?depth=' + encodeURIComponent(b.dataset.depth)); load(box); } catch (err) { alert('Antenna Advisor: ' + err.message); }
                        return;
                    }
                    if (b.dataset.clear != null) {
                        if (!confirm(`Delete the saved comparison for ${b.dataset.clear} MHz?`)) return;
                        try { await api('POST', '/antennaadvisor/clear?freq=' + encodeURIComponent(b.dataset.clear)); load(box); } catch (err) { alert('Antenna Advisor: ' + err.message); }
                        return;
                    }
                    if (b.dataset.act === 'clearall') {
                        if (!confirm('Delete ALL saved antenna comparisons? This cannot be undone.')) return;
                        try { await api('POST', '/antennaadvisor/clear'); load(box); } catch (err) { alert('Antenna Advisor: ' + err.message); }
                        return;
                    }
                    if (b.dataset.act === 'cancelscan') {
                        try { await api('POST', '/antennaadvisor/scan/cancel'); } catch (err) { alert('Antenna Advisor: ' + err.message); }
                        b.disabled = true; b.textContent = 'Cancelling…';
                        return;
                    }
                    if (b.dataset.act === 'scan') {
                        const thr = box.querySelector('input[data-thr]');
                        let a; try { a = await api('GET', '/antennaadvisor/admin'); } catch (_) { a = {}; }
                        if (!confirm(`A full-band scan takes over the tuner for a few minutes — nobody can listen while it runs${a.listeners ? ` (${a.listeners} listening now)` : ''}. Start it?`)) return;
                        try {
                            if (thr && thr.value !== '') await api('POST', '/antennaadvisor/settings?scanThreshold=' + encodeURIComponent(thr.value));
                            await api('POST', '/antennaadvisor/scan');
                            load(box);
                        } catch (err) { alert('Antenna Advisor: ' + err.message); }
                        return;
                    }
                    if (b.dataset.act === 'run') {
                        let a; try { a = await api('GET', '/antennaadvisor/admin'); } catch (_) { a = {}; }
                        if (a.listeners && !confirm(`${a.listeners} listener(s) are connected. A comparison will briefly flicker their audio (~${a.totalSeconds || ''}s). Run it now?`)) return;
                        const area = box.querySelector('.aa-result');
                        b.disabled = true; const label = b.textContent; b.textContent = 'Comparing… (~' + (a.totalSeconds || '') + 's)';
                        if (area) area.innerHTML = '<div class="kv-sub">Comparing antennas… the audio will flicker for a few seconds. Please wait.</div>';
                        try { const rec = await api('POST', '/antennaadvisor/run'); if (area) area.innerHTML = resultTable(rec); }
                        catch (err) { if (area) area.innerHTML = `<div class="kv-empty">Comparison failed: ${esc(err.message)}</div>`; }
                        finally { b.disabled = false; b.textContent = label; load(box); }
                    }
                });
            }
            load(box);
        } });
    }

    function start() { addStyle(); setupPage(); mainPage(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

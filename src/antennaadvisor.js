// Antenna Advisor (page part):
//   - main page: a small read-only pill with the recommended antenna for the current frequency
//   - Setup page: an "Antenna Advisor" tab where an admin runs a comparison and sees the results
(function () {
    'use strict';
    const esc = window.fmdxEsc, api = window.fmdxApi;
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
    function resultTable(rec) {
        if (!rec || !rec.antennas) return '<div class="kv-empty">No comparison yet on this frequency. Press “Compare now”.</div>';
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

    async function load(box) {
        let a;
        try { a = await api('GET', '/antennaadvisor/admin'); } catch (e) { box.innerHTML = `<div class="kv-empty">Could not load Antenna Advisor (${esc(e.message)}).</div>`; return; }
        if (!a.applicable) { box.innerHTML = `<p class="kv-sub">This tuner has a single antenna, so the Antenna Advisor isn’t needed here. It becomes active automatically on tuners with two or more antennas.</p>`; return; }
        if (!a.hasCommandApi) { box.innerHTML = `<p style="color:#f66">This FM-DX build does not expose the plugin command interface, so the antenna cannot be switched. Antenna Advisor needs FM-DX 1.4.x.</p>`; return; }
        const depthBtns = a.depths.map(d => `<button data-depth="${d}" class="${d === a.settings.depth ? 'kv-on' : ''}">${d.charAt(0).toUpperCase() + d.slice(1)}</button>`).join('');
        const antList = a.antennas.map(x => `${esc(x.name)}${x.z === a.currentZ ? ' <small style="color:#8d8">(now)</small>' : ''}`).join(' · ');
        box.innerHTML = `
            <p class="kv-sub">Compares your antennas on the frequency you are tuned to <b>right now</b> and tells you which one receives best
              (signal, RDS decoding, stereo and PS errors), then puts the antenna back. Only you (admin) can run it; listeners can see the result.</p>
            <h3>Antennas</h3><div class="kv-sub">${antList}</div>
            <h3>How thorough</h3><div>${depthBtns}</div>
            <div class="kv-sub">Measures each antenna for about <b>${a.perAntennaSeconds}s</b> — roughly <b>${a.totalSeconds}s</b> total for ${a.antennas.length} antennas.</div>
            ${a.listeners ? `<p style="color:#fc6">⚠️ ${a.listeners} listener(s) connected — a comparison briefly flickers their audio while it switches antennas.</p>` : ''}
            <div style="margin-top:8px"><button data-act="run">▶ Compare now (current frequency)</button></div>
            <h3>Result</h3><div class="aa-result">${resultTable(a.current)}</div>
            ${Object.keys(a.results || {}).length ? `<h3>Recent comparisons</h3><table><tr><th>Frequency</th><th>Best antenna</th><th>When</th></tr>${
                Object.values(a.results).sort((x, y) => (y.ts || 0) - (x.ts || 0)).slice(0, 20).map(r => { const w = (r.antennas || []).find(x => x.winner) || {}; return `<tr><td>${Number(r.freq).toFixed(1)} MHz</td><td>${esc(w.name || '–')}</td><td>${ago(r.ts)}</td></tr>`; }).join('')}</table>` : ''}`;
    }

    function setupPage() {
        let wired = false;
        window.fmdxSetupTab({ id: 'antennaadvisor', title: 'Antenna Advisor', icon: 'fa-tower-broadcast', onShow: box => {
            if (!wired) {
                wired = true;
                box.addEventListener('click', async e => {
                    const b = e.target.closest('button[data-depth], button[data-act]');
                    if (!b) return;
                    e.preventDefault();
                    if (b.dataset.depth) {
                        try { await api('POST', '/antennaadvisor/settings?depth=' + encodeURIComponent(b.dataset.depth)); load(box); } catch (err) { alert('Antenna Advisor: ' + err.message); }
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

    function start() { setupPage(); mainPage(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

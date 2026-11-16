// Listener Insights (page part): a "Listener Insights" tab in Setup.
(function () {
    'use strict';
    const esc = window.fmdxEsc, api = window.fmdxApi;
    let range = 7;
    const DUR = ['under 1 min', '1–5 min', '5–15 min', '15–60 min', 'over 1 hour'];
    const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const flag = cc => /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0))) : '🌐';

    function bars(values, labels, unit) {
        const max = Math.max(...values, 0.0001);
        return `<div class="kv-bars">${values.map((v, i) => `<div class="kv-bar" style="height:${Math.max(2, v / max * 100)}%" title="${esc(labels[i])}: ${v} ${unit}"></div>`).join('')}</div>
            <div class="kv-axis">${labels.map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
    }
    function hbars(rows, label, value, unit) {
        const max = Math.max(...rows.map(value), 0.0001);
        return `<table>${rows.map(r => `<tr><td style="width:40%">${label(r)}</td><td style="width:45%"><div class="kv-hbar" style="width:${Math.max(2, value(r) / max * 100)}%"></div></td><td>${value(r)} ${unit}</td></tr>`).join('')}</table>`;
    }

    async function load(box) {
        let s;
        try { s = await api('GET', '/insights/data?days=' + range); } catch (e) { box.innerHTML = `<div class="kv-empty">Could not load Listener Insights (${esc(e.message)}).</div>`; return; }
        const avg = s.sessions ? Math.round(s.listenHours * 60 / s.sessions) : 0;
        const dayLabels = s.daily.map((d, i) => (s.daily.length <= 14 || i % Math.ceil(s.daily.length / 14) === 0) ? d.date.slice(8) + '/' + d.date.slice(5, 7) : '');
        box.innerHTML = `<p class="kv-sub">How this server is used. Counted every 10 seconds; no IP addresses are stored.
              Collecting since ${esc(s.since)}.</p>
            <div>${[7, 30, 90].map(n => `<button data-range="${n}" class="${n === range ? 'kv-on' : ''}">Last ${n} days</button>`).join('')}</div>
            <div class="kv-cards">
              <div class="kv-card"><b>${s.listenersNow}</b>listening now</div>
              <div class="kv-card"><b>${s.visitors}</b>visitors</div>
              <div class="kv-card"><b>${s.listenHours}</b>hours listened</div>
              <div class="kv-card"><b>${s.peak}</b>most at once${s.peakDay ? ' (' + esc(s.peakDay.slice(8) + '/' + s.peakDay.slice(5, 7)) + ')' : ''}</div>
              <div class="kv-card"><b>${avg}</b>minutes per visit</div>
            </div>
            <h3>Visitors per day</h3>${bars(s.daily.map(d => d.visitors), dayLabels, 'visitors')}
            <h3>Busiest hours (listening hours)</h3>${bars(s.hours, s.hours.map((_, i) => i % 3 === 0 ? String(i).padStart(2, '0') : ''), 'h')}
            <h3>Busiest days of the week</h3>${bars(s.weekdays, WD, 'h')}
            <h3>Most listened stations</h3>${s.stations.length ? hbars(s.stations, r => `<b>${r.freq.toFixed(1)}</b> ${esc(r.name)}`, r => r.hours, 'h') : '<div class="kv-empty">No listening yet.</div>'}
            <h3>Countries</h3>${s.countries.length ? hbars(s.countries, r => `${flag(r.cc)} ${esc(r.cc)}`, r => r.visitors, 'visitors') : '<div class="kv-empty">No visitors yet.</div>'}
            <h3>How long people stay</h3>${s.sessions ? hbars(s.durations.map((v, i) => ({ v, i })), r => DUR[r.i], r => r.v, 'visits') : '<div class="kv-empty">No finished visits yet.</div>'}`;
    }

    function start() {
        let wired = false;
        window.fmdxSetupTab({ id: 'kv-insights', title: 'Listener Insights', icon: 'fa-chart-column', onShow: box => {
            if (!wired) {
                wired = true;
                box.addEventListener('click', e => { const b = e.target.closest('button[data-range]'); if (b) { e.preventDefault(); range = Number(b.dataset.range); load(box); } });
            }
            load(box);
        } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

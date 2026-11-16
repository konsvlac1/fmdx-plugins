// Shared by the konvlachos plugins: adds a tab to the FM-DX Setup page (/setup),
// just before "User management", and shows it like the Setup page's own tabs.
// Usage: fmdxSetupTab({ id, title, icon, onShow(box) }) -> box element or null
window.fmdxSetupTab = window.fmdxSetupTab || function ({ id, title, icon, onShow }) {
    const nav = document.querySelector('ul.nav[role="tablist"]');
    if (!nav || !document.getElementById('plugins-tab') || document.getElementById(id)) return null;
    const before = nav.querySelector('li[data-panel="users"]');
    const li = document.createElement('li');
    li.setAttribute('role', 'tab');
    li.setAttribute('data-panel', id);
    li.setAttribute('tabindex', '0');
    li.innerHTML = `<a href="#" role="tab" tabindex="-1" aria-controls="${id}"><i class="fa-solid fa-fw ${icon}"></i> ${title}</a>`;
    nav.insertBefore(li, before || null);
    const tab = document.createElement('div');
    tab.className = 'panel-full m-0 tab-content no-bg';
    tab.id = id;
    tab.setAttribute('role', 'tabpanel');
    tab.style.display = 'none';
    tab.innerHTML = `<h2>${title}</h2><div class="panel-100 p-bottom-20"><div class="kv-box"></div></div>`;
    document.getElementById('plugins-tab').parentNode.appendChild(tab);
    const box = tab.querySelector('.kv-box');
    const show = () => {
        nav.querySelectorAll('li').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        li.classList.add('active'); li.setAttribute('aria-selected', 'true');
        history.replaceState(null, '', '#' + id);
        document.querySelectorAll('.tab-content').forEach(x => { x.style.display = 'none'; });
        tab.style.display = '';
        onShow(box);
    };
    li.addEventListener('click', e => { e.preventDefault(); show(); });
    li.addEventListener('keydown', e => { if (e.key === 'Enter') show(); });
    window.addEventListener('hashchange', () => { if (location.hash === '#' + id) show(); });
    if (location.hash === '#' + id) {
        let n = 0;
        const t = setInterval(() => { if (!tab.offsetParent) show(); else if (++n > 3) clearInterval(t); }, 300);
        setTimeout(() => clearInterval(t), 5000);
    }
    if (!document.getElementById('kv-style')) {
        const st = document.createElement('style');
        st.id = 'kv-style';
        st.textContent = `
.kv-box { text-align: left; font-size: 14px; max-width: 980px; margin: 0 auto; }
.kv-box h3 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: .8; }
.kv-box .kv-sub { opacity: .75; margin: 0 0 12px; }
.kv-box table { width: 100%; border-collapse: collapse; font-size: 13px; }
.kv-box th { text-align: left; font-weight: 600; opacity: .8; padding: 6px; cursor: pointer; white-space: nowrap; }
.kv-box td { padding: 5px 6px; border-top: 1px solid rgba(255,255,255,.1); vertical-align: top; }
.kv-box button { width: auto !important; height: auto !important; min-width: 0 !important; margin: 0 6px 6px 0 !important;
  padding: 7px 14px !important; border-radius: 10px !important; cursor: pointer; font-size: 13px !important;
  background: var(--color-2, #333) !important; color: var(--color-text, #fff) !important; border: 1px solid transparent !important; }
.kv-box button.kv-on { background: var(--color-4, #5a5) !important; color: var(--color-main, #000) !important; font-weight: 700; }
.kv-box input[type=search] { width: 260px; max-width: 100%; padding: 7px 12px; border-radius: 10px; border: 0; margin: 0 8px 8px 0; }
.kv-box .kv-cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 6px; }
.kv-box .kv-card { background: rgba(255,255,255,.06); border-radius: 12px; padding: 10px 14px; min-width: 120px; }
.kv-box .kv-card b { display: block; font-size: 22px; }
.kv-box .kv-bars { display: flex; align-items: flex-end; gap: 3px; height: 110px; padding-top: 6px; }
.kv-box .kv-bar { flex: 1; background: var(--color-4, #5a5); border-radius: 3px 3px 0 0; min-height: 2px; position: relative; }
.kv-box .kv-axis { display: flex; gap: 3px; font-size: 10px; opacity: .7; }
.kv-box .kv-axis span { flex: 1; text-align: center; }
.kv-box .kv-hbar { height: 8px; background: var(--color-4, #5a5); border-radius: 4px; }
.kv-box .kv-empty { opacity: .6; }`;
        document.head.appendChild(st);
    }
    return box;
};
window.fmdxEsc = window.fmdxEsc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
window.fmdxApi = window.fmdxApi || (async (method, url) => {
    const r = await fetch(url, { method, credentials: 'same-origin' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return r.json();
});
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

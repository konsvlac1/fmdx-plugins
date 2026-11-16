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
    let filled = false;
    const show = () => {
        filled = true;
        nav.querySelectorAll('li').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        li.classList.add('active'); li.setAttribute('aria-selected', 'true');
        history.replaceState(null, '', '#' + id);
        document.querySelectorAll('.tab-content').forEach(x => { x.style.display = 'none'; });
        tab.style.display = 'block';            // the Setup stylesheet hides tabs by default
        onShow(box);
    };
    li.addEventListener('click', e => { e.preventDefault(); show(); });
    li.addEventListener('keydown', e => { if (e.key === 'Enter') show(); });
    window.addEventListener('hashchange', () => { if (location.hash === '#' + id) show(); });
    // Direct link (/setup#id): the Setup page shows its own first tab while it starts, which
    // can take a while with many plugins, so keep selecting ours until the page has settled.
    if (location.hash === '#' + id) {
        let n = 0;
        // (the Setup page may make our tab visible itself without filling it, so fill it once in any case)
        const t = setInterval(() => { if (!tab.offsetParent || !filled) show(); else if (++n > 6) clearInterval(t); }, 300);
        setTimeout(() => clearInterval(t), 20000);
        window.addEventListener('load', () => setTimeout(() => { if (location.hash === '#' + id && !tab.offsetParent) show(); }, 300));
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
// Station Log (page part): a "Station Log" tab in Setup with every station the tuner received.
(function () {
    'use strict';
    const esc = window.fmdxEsc, api = window.fmdxApi;
    let data = null, sortKey = 'freq', sortDir = 1, filter = '';
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };

    function table(box) {
        const q = filter.toLowerCase();
        const rows = data.stations.filter(s => !q || [s.freq.toFixed(1), s.pi, s.ps, s.name, s.city, s.itu].join(' ').toLowerCase().includes(q))
            .sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0) * sortDir);
        const th = (k, label) => `<th data-sort="${k}">${label}${sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
        box.querySelector('.kv-table').innerHTML = rows.length ? `<table>
            <tr>${th('freq', 'MHz')}${th('ps', 'PS')}${th('name', 'Station')}${th('city', 'Place')}${th('dist', 'km')}${th('bestSig', 'Best dBf')}${th('lastHeard', 'Last heard')}${th('minutes', 'Minutes')}<th></th></tr>
            ${rows.map(s => `<tr><td><b>${s.freq.toFixed(1)}</b></td><td>${esc(s.ps)}<br><span style="opacity:.6">${esc(s.pi)}</span></td>
              <td>${esc(s.name)}</td><td>${esc(s.city)}${s.itu ? ' [' + esc(s.itu) + ']' : ''}</td><td>${esc(s.dist)}</td>
              <td>${s.bestSig > -999 ? s.bestSig.toFixed(1) : ''}</td><td>${esc(ago(s.lastHeard))}</td><td>${s.minutes}</td>
              <td><button data-del="${esc(s.key)}" title="Remove from the log">✕</button></td></tr>`).join('')}</table>`
            : '<div class="kv-empty">No stations yet. They appear here as soon as the tuner receives a station with RDS for a few seconds.</div>';
    }

    async function load(box) {
        try { data = await api('GET', '/stationlog/list'); } catch (e) { box.innerHTML = `<div class="kv-empty">Could not load the Station Log (${esc(e.message)}).</div>`; return; }
        const pub = data.settings.publicList;
        box.innerHTML = `<p class="kv-sub">Every station this tuner has received (RDS for at least 5 seconds), logged automatically
            while listeners tune, from presets and from the Scanner plugin.</p>
            <div class="kv-cards"><div class="kv-card"><b>${data.stations.length}</b>stations</div>
              <div class="kv-card"><b>${data.stations.filter(s => Date.now() - s.lastHeard < 86400000).length}</b>heard in the last 24 h</div>
              <div class="kv-card"><b>${data.stations.reduce((m, s) => Math.max(m, Number(s.dist) || 0), 0) || '–'}</b>farthest (km)</div></div>
            <input type="search" placeholder="Search frequency, name, place, PI…" value="${esc(filter)}">
            <button data-csv>⬇ Download (Excel / CSV)</button>
            <button data-public="${pub ? 'false' : 'true'}" class="${pub ? 'kv-on' : ''}">${pub ? '🌐 Public list: on' : '🔒 Public list: off'}</button>
            ${pub ? `<span style="opacity:.75">Listeners can see it at <a href="/stationlog/public" target="_blank">/stationlog/public</a></span>` : ''}
            <div class="kv-table"></div>`;
        table(box);
    }

    function wire(box) {
        box.addEventListener('input', e => { if (e.target.type === 'search') { filter = e.target.value; table(box); } });
        box.addEventListener('click', async e => {
            const th = e.target.closest('th[data-sort]');
            if (th) { const k = th.dataset.sort; sortDir = sortKey === k ? -sortDir : (k === 'freq' || k === 'ps' || k === 'name' || k === 'city' ? 1 : -1); sortKey = k; return table(box); }
            const b = e.target.closest('button');
            if (!b) return;
            e.preventDefault();
            if (b.dataset.csv !== undefined) { location.href = '/stationlog/csv'; return; }
            try {
                if (b.dataset.public) { await api('POST', '/stationlog/settings?publicList=' + b.dataset.public); return load(box); }
                if (b.dataset.del && confirm('Remove this station from the log?')) { await api('POST', '/stationlog/delete?key=' + encodeURIComponent(b.dataset.del)); return load(box); }
            } catch (err) { alert('Station Log: ' + err.message); }
        });
    }

    function start() {
        let wired = false;
        window.fmdxSetupTab({ id: 'kv-stationlog', title: 'Station Log', icon: 'fa-book', onShow: box => { if (!wired) { wire(box); wired = true; } load(box); } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

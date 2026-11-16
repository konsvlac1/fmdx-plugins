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
        window.fmdxSetupTab({ id: 'stationlog', title: 'Station Log', icon: 'fa-book', onShow: box => { if (!wired) { wire(box); wired = true; } load(box); } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

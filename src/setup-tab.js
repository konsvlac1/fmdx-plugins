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

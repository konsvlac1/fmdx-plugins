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
// Fair Tuner Sharing (page part):
//   - main page: a friendly message when another listener is tuning, with a countdown
//   - Setup page: a "Fair Tuner Sharing" tab with the settings
(function () {
    'use strict';
    const esc = window.fmdxEsc, api = window.fmdxApi;

    // ---------- main page ----------
    function mainPage() {
        if (document.getElementById('plugins-tab')) return;          // not on the Setup page
        let users = 0, timer = null, left = 0, mode = 'free', tick = null;
        const bar = document.createElement('div');
        bar.id = 'fs-bar';
        bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99998;max-width:92vw;padding:9px 18px;border-radius:14px;' +
            'background:var(--color-2,#333);color:var(--color-text,#fff);border:1px solid var(--color-4,#888);box-shadow:0 6px 24px rgba(0,0,0,.5);font-size:14px;display:none;text-align:center';
        document.body.appendChild(bar);
        const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        function paint() {
            if (mode === 'wait' && left > 0) {
                bar.innerHTML = `🎧 Another listener is tuning right now. You can tune again in <b>${mmss(left)}</b>. Thanks for sharing!`;
                bar.style.display = '';
            } else if (mode === 'holder-waited' && left > 0) {
                bar.innerHTML = `🎧 Another listener would like to tune. Your turn ends in <b>${mmss(left)}</b>.`;
                bar.style.display = '';
            } else bar.style.display = 'none';
        }
        let flashT = null;
        function flash() {                                       // a small nudge so the reminder is noticed
            bar.style.transition = 'transform .12s ease';
            bar.style.transform = 'translateX(-50%) scale(1.06)';
            clearTimeout(flashT);
            flashT = setTimeout(() => { bar.style.transform = 'translateX(-50%)'; }, 150);
        }
        function nudge() {                                       // a tune was blocked: show why, don't move the dial
            if (left > 0) paint();
            else { bar.innerHTML = '🎧 Another listener is tuning right now. One moment…'; bar.style.display = ''; }
            flash();
            poll();                                              // refresh at once in case the turn just opened up
        }
        async function poll() {
            try {
                const s = await fetch('/fairshare/status', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json());
                mode = s.you; left = s.secondsLeft || 0; paint();
            } catch (_) { /* ignore */ }
        }
        clearInterval(tick);
        tick = setInterval(() => { if (left > 0) { left--; paint(); } }, 1000);
        function setUsers(n) {
            users = n;
            if (users >= 2 && !timer) { poll(); timer = setInterval(() => { if (!document.hidden) poll(); }, 5000); }
            if (users < 2 && timer) { clearInterval(timer); timer = null; mode = 'free'; left = 0; paint(); }
        }
        // Keep a waiter's tune from moving the dial at all: swallow outgoing T/Z while it is not their
        // turn (the server drops them too - this just avoids sending a doomed command and gives instant
        // feedback). The dial is server-driven, so with nothing sent it simply never moves. Admins and the
        // own network are never 'wait' (the status endpoint exempts them), so they are never blocked here.
        function guardSend() {
            if (typeof socket === 'undefined' || !socket || typeof socket.send !== 'function' || socket._fsGuarded) return;
            const orig = socket.send;
            socket.send = function (data) {
                try { if (mode === 'wait' && typeof data === 'string' && /^[TZ]/.test(data)) { nudge(); return; } } catch (_) { /* fail open */ }
                return orig.apply(this, arguments);
            };
            socket._fsGuarded = true;
        }
        const hook = () => {
            if (typeof socket === 'undefined' || !socket || !socket.addEventListener) return false;   // FM-DX's own tuner connection
            if (!socket._fsMsg) {
                socket.addEventListener('message', ev => { try { const d = JSON.parse(ev.data); if (typeof d.users === 'number') setUsers(d.users); } catch (_) { /* ignore */ } });
                socket._fsMsg = true;
            }
            guardSend();
            return true;
        };
        if (!hook()) { let n = 0; const t = setInterval(() => { if (hook() || ++n > 20) clearInterval(t); }, 500); }
        setInterval(hook, 3000);                                 // re-attach after a socket reconnect (flags stop duplicates)
    }

    // ---------- Setup page ----------
    async function load(box) {
        let a;
        try { a = await api('GET', '/fairshare/admin'); } catch (e) { box.innerHTML = `<div class="kv-empty">Could not load Fair Tuner Sharing (${esc(e.message)}).</div>`; return; }
        const s = a.settings;
        const opt = (name, values, cur, fmt) => values.map(v => `<button data-set="${name}" data-val="${v}" class="${String(v) === String(cur) ? 'kv-on' : ''}">${fmt(v)}</button>`).join('');
        // A custom value next to the quick choices: number box + Set (shown in the unit the admin thinks in)
        const custom = (name, cur, min, max, unit, factor) => {
            const shown = Math.round(cur / factor * 10) / 10;
            return `<span style="white-space:nowrap"><input type="number" class="kv-num" data-for="${name}" data-factor="${factor}" min="${min}" max="${max}" step="1" value="${shown}"
                style="width:80px;padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 8px"> ${unit}
                <button data-custom="${name}">Set</button></span>`;
        };
        const hookNote = a.hookInstalled
            ? (a.hookAddedNow ? `<p style="color:#fc6"><b>✅ Done. Now restart FM-DX</b> (close it and start it again). After that the sharing works.</p>` : '')
            : `<p style="color:#f66"><b>One more step is needed:</b> Fair Tuner Sharing must add one line to FM-DX's <code>server/index.js</code>, otherwise it does nothing.<br>
               <button data-act="installhook">🔧 Fix it now</button> then restart FM-DX.</p>`;
        box.innerHTML = hookNote + `<p class="kv-sub">When several listeners are connected, the one who tunes gets a short turn. The others
              see a friendly countdown instead of the frequency jumping around. The admin and your own network can always tune.
             </p>
            <div><button data-set="enabled" data-val="true" class="${s.enabled ? 'kv-on' : ''}">✅ On</button><button data-set="enabled" data-val="false" class="${s.enabled ? '' : 'kv-on'}">Off</button></div>
            <h3>A turn lasts (after the last tune)</h3><div>${opt('turnSeconds', [60, 120, 180, 300], s.turnSeconds, v => v / 60 + ' min')}${custom('turnSeconds', s.turnSeconds, 1, 30, 'min', 60)}</div>
            <h3>Longest turn in a row</h3><div>${opt('maxTurnMinutes', [5, 10, 15, 30], s.maxTurnMinutes, v => v + ' min')}${custom('maxTurnMinutes', s.maxTurnMinutes, 2, 120, 'min', 1)}</div>
            <h3>Start sharing from</h3><div>${opt('minListeners', [2, 3, 4], s.minListeners, v => v + ' listeners')}${custom('minListeners', s.minListeners, 2, 1000, 'listeners', 1)}</div>
            <h3>Since the last restart</h3>
            <div class="kv-cards"><div class="kv-card"><b>${a.listeners}</b>listening now</div>
              <div class="kv-card"><b>${a.stats.turns}</b>turns given</div>
              <div class="kv-card"><b>${a.stats.heldBack}</b>tunes held back</div>
              <div class="kv-card"><b>${a.turnNow ? Math.ceil(a.turnNow.secondsLeft / 60) + ' min' : '–'}</b>current turn left</div></div>`;
    }

    function setupPage() {
        let wired = false;
        window.fmdxSetupTab({ id: 'fairshare', title: 'Fair Tuner Sharing', icon: 'fa-people-arrows', onShow: box => {
            if (!wired) {
                wired = true;
                const send = async (name, value) => {
                    try { await api('POST', `/fairshare/settings?${name}=${encodeURIComponent(value)}`); load(box); } catch (err) { alert('Fair Tuner Sharing: ' + err.message); }
                };
                const fromBox = name => {
                    const inp = box.querySelector(`input.kv-num[data-for="${name}"]`);
                    const v = Number(inp.value), min = Number(inp.min), max = Number(inp.max);
                    if (!Number.isFinite(v) || v < min || v > max) { alert(`Please enter a number from ${min} to ${max}.`); inp.focus(); return; }
                    send(name, Math.round(v * Number(inp.dataset.factor)));
                };
                box.addEventListener('click', e => {
                    const b = e.target.closest('button[data-set], button[data-custom], button[data-act]');
                    if (!b) return;
                    e.preventDefault();
                    if (b.dataset.act === 'installhook') {
                        api('POST', '/fairshare/installhook').then(() => load(box)).catch(err => alert('Fair Tuner Sharing: ' + err.message));
                        return;
                    }
                    if (b.dataset.custom) fromBox(b.dataset.custom); else send(b.dataset.set, b.dataset.val);
                });
                // Enter in a number box = Set (and keep FM-DX from seeing the key)
                box.addEventListener('keydown', e => {
                    const inp = e.target.closest('input.kv-num');
                    if (!inp) return;
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); fromBox(inp.dataset.for); }
                });
            }
            load(box);
        } });
    }

    function start() { setupPage(); mainPage(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

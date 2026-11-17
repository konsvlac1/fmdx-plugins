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
        const hook = () => {
            if (typeof socket === 'undefined' || !socket || !socket.addEventListener) return false;   // FM-DX's own tuner connection
            socket.addEventListener('message', ev => { try { const d = JSON.parse(ev.data); if (typeof d.users === 'number') setUsers(d.users); } catch (_) { /* ignore */ } });
            return true;
        };
        if (!hook()) { let n = 0; const t = setInterval(() => { if (hook() || ++n > 20) clearInterval(t); }, 500); }
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

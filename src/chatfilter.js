// Chat Filter (page part):
//   - main page: when the filter refuses a message, the text goes back into the chat box
//     so the sender can fix it
//   - Setup page: a "Chat Filter" tab with the settings, a tester, the log and muted listeners
(function () {
    'use strict';
    const esc = window.fmdxEsc;
    const post = async (url, data) => {
        const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
        return r.json();
    };

    // ---------- main page ----------
    function mainPage() {
        if (document.getElementById('plugins-tab')) return;
        const box = document.getElementById('chat-chatbox'), input = document.getElementById('chat-send-message');
        if (!box || !input) return;
        let last = '';
        const send = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
            try { if (/\/chat$/.test(this.url) && typeof data === 'string') { const d = JSON.parse(data); if (d && typeof d.message === 'string') last = d.message; } } catch (_) { /* ignore */ }
            return send.apply(this, arguments);
        };
        new MutationObserver(list => {
            for (const m of list) for (const n of m.addedNodes) {
                if (n.nodeType === 1 && n.getAttribute('data-id') === '-1' && /Chat Filter/.test(n.textContent) && last && !input.value) {
                    input.value = last; last = '';
                }
            }
        }).observe(box, { childList: true });
    }

    // ---------- Setup page ----------
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString(); };
    const REASON = { 'bad word': '🚫 bad word', 'bad nickname': '🚫 bad nickname', link: '🔗 link', 'link hidden': '🔗 link removed', hidden: '✳️ hidden', repeat: '🔁 repeated', muted: '🔇 while muted' };

    let shown = false;                                     // built-in words hidden as f*** until "Show words"
    const mask = () => '****';
    function render(box, a) {
        const s = a.settings;
        const on = (k, v) => String(s[k]) === String(v) ? 'kv-on' : '';
        box.innerHTML = `
            ${a.hookInstalled ? '' : `<p style="color:#f66"><b>The chat hook is missing.</b> Run <code>node install.js &lt;FM-DX folder&gt;</code> again and restart FM-DX, otherwise nothing is filtered.</p>`}
            <p class="kv-sub">Checks every chat message before anyone sees it. Messages with bad words (Greek, Greeklish and English,
              also when written with symbols, spaces or capitals) or spam links are not sent, and only the sender sees a short note. Bad words are stopped for admins too (you can switch that off below); links, repeats and mutes never apply to admins.</p>
            <div><button data-k="enabled" data-v="true" class="${on('enabled', true)}">✅ On</button><button data-k="enabled" data-v="false" class="${on('enabled', false)}">Off</button></div>
            <h3>When a message has a bad word</h3>
            <div><button data-k="mode" data-v="block" class="${on('mode', 'block')}">🚫 Don't send it</button><button data-k="mode" data-v="hide" class="${on('mode', 'hide')}">✳️ Send it with *** instead of the word</button></div>
            <h3>Also</h3>
            <div><button data-k="blockRepeats" data-v="${!s.blockRepeats}" class="${on('blockRepeats', true)}">${s.blockRepeats ? '✅' : '⬜'} Stop the same message sent again (5 min)</button>
                 <button data-k="blockLinks" data-v="${!s.blockLinks}" class="${on('blockLinks', true)}">${s.blockLinks ? '✅' : '⬜'} Block links (spam)</button>
                 <button data-k="filterAdmins" data-v="${!s.filterAdmins}" class="${on('filterAdmins', true)}">${s.filterAdmins ? '✅' : '⬜'} Admins too (bad words)</button>
                 <button data-k="checkNicknames" data-v="${!s.checkNicknames}" class="${on('checkNicknames', true)}">${s.checkNicknames ? '✅' : '⬜'} Check nicknames too</button>
</div>
            <h3>Mute after blocked messages</h3>
            <div>${[0, 2, 3, 5].map(v => `<button data-k="muteAfter" data-v="${v}" class="${on('muteAfter', v)}">${v ? v + ' blocked' : 'Never'}</button>`).join('')}
                 <span style="white-space:nowrap;margin-left:8px">for ${[10, 60, 1440].map(v => `<button data-k="muteMinutes" data-v="${v}" class="${on('muteMinutes', v)}">${v < 60 ? v + ' min' : v < 1440 ? '1 hour' : '1 day'}</button>`).join('')}</span></div>
            <h3>Blocked words</h3>
            <p class="kv-sub">Any message with one of these words is stopped. Add your own words below; you can remove only the words you added.
              The 🔒 built-in bad words always stay. A word ending in * also blocks longer words that start with it (e.g. <code>troll*</code>). Greek words also catch Greeklish.</p>
            <div><input class="cf-add" type="text" maxlength="60" placeholder="add a word" style="width:220px;max-width:100%;padding:7px 12px;border-radius:10px;border:0;margin:0 6px 6px 0"><button data-act="add">➕ Add</button></div>
            <h3>Your words (${s.words.length})</h3>
            <div class="cf-chips">${s.words.map(w => `<span class="cf-chip cf-mine">${esc(w)}<button data-remove="${esc(w)}" title="Remove">✕</button></span>`).join('') || '<span class="kv-empty">None yet.</span>'}</div>
            <h3>🔒 Built-in bad words (${a.builtin.length}, always on)</h3>
            <div><button data-act="reveal">${shown ? '🙈 Hide words' : '👁 Show words'}</button></div>
            <div class="cf-chips${shown ? ' cf-shown' : ''}" style="margin-top:4px">${a.builtin.map(w => `<span class="cf-chip" style="padding-right:10px"><span class="cf-m">${esc(mask(w))}</span><span class="cf-r">${esc(w)}</span></span>`).join('')}</div>
            ${s.blockLinks ? `<h3>Allowed sites (links to these are OK)</h3>
            <p class="kv-sub">Links to this site are always allowed. A site here also allows its sub-sites (fmdx.org → maps.fmdx.org).</p>
            <div><input class="cf-site" type="text" maxlength="100" placeholder="e.g. fmdx.org" style="width:220px;max-width:100%;padding:7px 12px;border-radius:10px;border:0;margin:0 6px 6px 0"><button data-act="addsite">➕ Add</button></div>
            <div class="cf-chips">${s.allowSites.map(x => `<span class="cf-chip cf-mine">${esc(x)}<button data-rmsite="${esc(x)}" title="Remove">✕</button></span>`).join('') || '<span class="kv-empty">None: every link is blocked (except this site).</span>'}</div>` : ''}
            <h3>Note the sender sees</h3>
            <input class="cf-notice" type="text" maxlength="300" value="${esc(s.notice)}" style="width:100%;max-width:720px;padding:7px 12px;border-radius:10px;border:0;margin-bottom:6px">
            <div><button data-act="notice">💾 Save note</button></div>
            <h3>Try a message</h3>
            <input class="cf-test" type="text" placeholder="type a message to test" style="width:100%;max-width:520px;padding:7px 12px;border-radius:10px;border:0;margin-bottom:6px">
            <div><button data-act="test">Test</button> <span class="cf-result"></span></div>
            <h3>Since the last restart</h3>
            <div class="kv-cards"><div class="kv-card"><b>${a.stats.checked}</b>messages checked</div><div class="kv-card"><b>${a.stats.blocked}</b>blocked</div>
              <div class="kv-card"><b>${a.stats.hidden}</b>words hidden</div><div class="kv-card"><b>${a.stats.links || 0}</b>links stopped</div><div class="kv-card"><b>${a.stats.repeats}</b>repeats stopped</div><div class="kv-card"><b>${a.stats.mutes}</b>mutes</div></div>
            <h3>Muted now</h3>
            ${a.muted.length ? `<table><tr><th>Nickname</th><th>Address</th><th>Time left</th><th>Why</th><th></th></tr>${a.muted.map(m => `<tr><td>${esc(m.nickname)}</td><td>${esc(m.ip)}</td><td>${m.minutesLeft} min</td><td>${esc(m.reason)}</td><td><button data-unmute="${esc(m.ip)}">Unmute</button></td></tr>`).join('')}</table>` : '<div class="kv-empty">Nobody.</div>'}
            <h3>Stopped messages</h3>
            ${a.log.length ? `<table><tr><th>When</th><th>Nickname</th><th>Message</th><th>Why</th><th>Address</th><th></th></tr>${a.log.map(e => `<tr><td style="white-space:nowrap">${ago(e.t)}</td><td>${esc(e.nickname)}${e.admin ? ' <small style="color:#bada55">[ADMIN]</small>' : ''}</td><td>${esc(e.message)}${e.words ? `<br><small style="opacity:.7">${esc(e.words.join(', '))}</small>` : ''}</td><td style="white-space:nowrap">${REASON[e.reason] || esc(e.reason)}${e.muted ? ' → 🔇' : ''}</td><td>${esc(e.ip)}</td><td style="white-space:nowrap">${e.admin ? '' : `<button data-mute="${esc(e.ip)}" data-nick="${esc(e.nickname)}">🔇 Mute 1 day</button>`}</td></tr>`).join('')}</table>
              <div style="margin-top:8px"><button data-act="clearlog">Clear the list</button></div>` : '<div class="kv-empty">Nothing stopped yet.</div>'}`;
    }

    function css() {
        if (document.getElementById('cf-style')) return;
        const st = document.createElement('style');
        st.id = 'cf-style';
        st.textContent = `
.kv-box .cf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kv-box .cf-chip { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 10px; border-radius: 14px; background: rgba(255,255,255,.08); font-size: 13px; }
.kv-box .cf-chip.cf-mine { background: var(--color-4, #5a5); color: var(--color-main, #000); font-weight: 600; }
.kv-box .cf-chip.cf-off { opacity: .6; text-decoration: line-through; }
.kv-box .cf-chip button { padding: 0 7px !important; margin: 0 !important; border-radius: 10px !important; background: transparent !important; color: inherit !important; font-size: 12px !important; }
.kv-box .cf-chip button:hover { background: rgba(0,0,0,.25) !important; }
.kv-box .cf-chips .cf-r { display: none; }
.kv-box .cf-chips.cf-shown .cf-r { display: inline; }
.kv-box .cf-chips.cf-shown .cf-m { display: none; }`;
        document.head.appendChild(st);
    }

    function setupPage() {
        let wired = false;
        window.fmdxSetupTab({ id: 'chatfilter', title: 'Chat Filter', icon: 'fa-comment-slash', onShow: async box => {
            const run = async (url, data) => { try { render(box, await post(url, data)); } catch (err) { alert('Chat Filter: ' + (err.message === 'admin login required' ? 'please reload the page and log in again.' : err.message)); } };
            css();
            if (!wired) {
                wired = true;
                box.addEventListener('click', async e => {
                    const b = e.target.closest('button');
                    if (!b) return;
                    e.preventDefault();
                    if (b.dataset.k) {
                        const v = b.dataset.v;
                        run('/chatfilter/settings', { [b.dataset.k]: v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? Number(v) : v });
                    } else if (b.dataset.act === 'add') {
                        const inp = box.querySelector('.cf-add'), w = inp.value.trim();
                        if (w) run('/chatfilter/settings', { add: w });
                    } else if (b.dataset.act === 'reveal') {
                        shown = !shown;
                        b.textContent = shown ? '🙈 Hide words' : '👁 Show words';
                        b.parentNode.nextElementSibling.classList.toggle('cf-shown', shown);
                    } else if (b.dataset.act === 'addsite') {
                        const w = box.querySelector('.cf-site').value.trim();
                        if (w) run('/chatfilter/settings', { addSite: w });
                    } else if (b.dataset.rmsite) run('/chatfilter/settings', { removeSite: b.dataset.rmsite });
                    else if (b.dataset.remove) run('/chatfilter/settings', { remove: b.dataset.remove });

                    else if (b.dataset.act === 'notice') run('/chatfilter/settings', { notice: box.querySelector('.cf-notice').value });
                    else if (b.dataset.act === 'clearlog') { if (confirm('Clear the list of stopped messages?')) run('/chatfilter/clearlog'); }
                    else if (b.dataset.act === 'test') {
                        const out = box.querySelector('.cf-result');
                        try {
                            const r = await post('/chatfilter/test', { text: box.querySelector('.cf-test').value });
                            out.innerHTML = r.blocked ? `🚫 would be stopped (${esc([...r.found.map(f => f.word), ...r.links.map(l => '🔗 ' + l)].join(', '))})${r.found.length ? ` — hidden form: <i>${esc(r.masked)}</i>` : ''}` : '✅ OK, it would be sent';
                        } catch (err) { out.textContent = err.message; }
                    } else if (b.dataset.mute) run('/chatfilter/mute', { ip: b.dataset.mute, nickname: b.dataset.nick, minutes: 1440 });
                    else if (b.dataset.unmute) run('/chatfilter/unmute', { ip: b.dataset.unmute });
                });
                // typing in our boxes must not reach FM-DX's keyboard shortcuts
                box.addEventListener('keydown', e => {
                    if (!e.target.matches('input, textarea')) return;
                    e.stopPropagation();
                    if (e.key === 'Enter' && e.target.matches('.cf-test')) { e.preventDefault(); box.querySelector('[data-act="test"]').click(); }
                    if (e.key === 'Enter' && e.target.matches('.cf-site')) { e.preventDefault(); box.querySelector('[data-act="addsite"]').click(); }
                    if (e.key === 'Enter' && e.target.matches('.cf-add')) { e.preventDefault(); box.querySelector('[data-act="add"]').click(); }
                });
            }
            try { render(box, await fetch('/chatfilter/admin', { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })); }
            catch (err) {
                box.innerHTML = err.message === '403'
                    ? '<div class="kv-empty">You are not logged in as admin any more (for example after a restart of FM-DX). Please <a href="/setup" onclick="location.reload();return false">reload this page</a> and log in again.</div>'
                    : `<div class="kv-empty">Could not load Chat Filter (${esc(err.message)}).</div>`;
            }
        } });
    }

    function start() { setupPage(); mainPage(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

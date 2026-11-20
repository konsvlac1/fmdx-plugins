// DX Watch (page part):
//   - main page: a brief toast when the receiver catches a watched station
//   - Setup page: a "DX Watch" tab to manage the watchlist, the Discord/Telegram channels and the log
(function () {
    'use strict';
    const esc = window.fmdxEsc, api = window.fmdxApi;
    const ago = t => { if (!t) return ''; const s = Math.round((Date.now() - t) / 1000); if (s < 60) return 'just now'; const m = Math.round(s / 60); if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; return Math.round(h / 24) + ' d ago'; };
    const targetText = t => t.type === 'any-new' ? 'Any new station' : t.type === 'pi' ? 'PI ' + esc(t.value) : esc(Number(t.value).toFixed(1)) + ' MHz';
    const catchText = c => `${esc(c.name || ('PI ' + c.pi))} on ${Number(c.freq).toFixed(1)} MHz`;

    // ---------- main page: a toast when a watched station is caught ----------
    function mainPage() {
        if (document.getElementById('plugins-tab')) return;          // not on the Setup page
        let lastTs = Date.now();                                     // only toast catches made after we loaded
        const toast = document.createElement('div');
        toast.id = 'dxw-toast';
        toast.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99997;max-width:72vw;padding:9px 16px;border-radius:12px;' +
            'background:var(--color-2,#333);color:var(--color-text,#fff);border:1px solid var(--color-4,#888);box-shadow:0 6px 24px rgba(0,0,0,.5);font-size:14px;display:none;cursor:pointer';
        toast.title = 'Click to dismiss';
        toast.addEventListener('click', () => { toast.style.display = 'none'; });
        document.body.appendChild(toast);
        let hideT = null;
        function show(c) {
            toast.innerHTML = `📻 <b>DX caught:</b> ${catchText(c)}${c.itu ? ' · ' + esc(c.itu) : ''}${c.dist ? ' · ' + esc(c.dist) + ' km' : ''}`;
            toast.style.display = '';
            clearTimeout(hideT); hideT = setTimeout(() => { toast.style.display = 'none'; }, 12000);
        }
        async function poll() {
            try {
                const r = await fetch('/dxwatch/recent', { credentials: 'same-origin', cache: 'no-store' });
                if (!r.ok) return;                                   // catches not public, or feed off
                const list = await r.json();
                if (!Array.isArray(list) || !list.length) return;
                const fresh = list.filter(c => c.ts > lastTs);
                lastTs = Math.max(lastTs, ...list.map(c => c.ts || 0));
                if (fresh.length) show(fresh[0]);
            } catch (_) { /* ignore */ }
        }
        poll();
        setInterval(() => { if (!document.hidden) poll(); }, 15000);
    }

    // ---------- Setup page (admin) ----------
    async function load(box) {
        let a;
        try { a = await api('GET', '/dxwatch/admin'); } catch (e) { box.innerHTML = `<div class="kv-empty">Could not load DX Watch (${esc(e.message)}).</div>`; return; }
        const s = a.settings;
        const onoff = (k, v) => `<button data-set="${k}" data-val="${v}" class="${String(s[k]) === String(v) ? 'kv-on' : ''}">`;
        const targets = a.targets.length ? `<table><tr><th>Watching</th><th>Label</th><th></th><th></th></tr>${a.targets.map(t => `<tr${t.enabled ? '' : ' style="opacity:.5"'}>
              <td>${targetText(t)}</td><td>${esc(t.label || '')}</td>
              <td><button data-toggle="${t.id}">${t.enabled ? 'On' : 'Off'}</button></td>
              <td><button data-remove="${t.id}" title="Remove">✕</button></td></tr>`).join('')}</table>`
            : '<div class="kv-empty">No targets yet — add one below.</div>';
        const discordLine = s.discordSet
            ? `Discord webhook set (<code>${esc(s.discordWebhook)}</code>) <button data-act="discordclear">Clear</button>`
            : 'No Discord webhook set.';
        const tgLine = s.telegram.set ? 'Telegram set in the plugin.' : a.telegramAvailable ? 'Telegram available from <code>~/.fmdx-telegram</code>.' : 'No Telegram configured.';
        box.innerHTML = `
            <p class="kv-sub">Watches this receiver’s own live RDS decodes and alerts you when a station you care about is received —
              on the page, and to Discord/Telegram. It never changes the tuner.</p>
            <div><button data-set="enabled" data-val="true" class="${s.enabled ? 'kv-on' : ''}">✅ On</button><button data-set="enabled" data-val="false" class="${s.enabled ? '' : 'kv-on'}">Off</button></div>

            <h3>Watchlist</h3>
            ${targets}
            <div style="margin-top:10px">
              <select class="dxw-type" style="padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 0">
                <option value="pi">PI code</option><option value="freq">Frequency (MHz)</option><option value="any-new">Any new station</option></select>
              <input class="dxw-value" type="text" maxlength="12" placeholder="e.g. 1234 or 102.7" style="width:150px;padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 0">
              <input class="dxw-label" type="text" maxlength="40" placeholder="label (optional)" style="width:160px;padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 0">
              <button data-act="add">➕ Add target</button>
            </div>

            <h3>Alert channels</h3>
            <div class="kv-sub">${discordLine}</div>
            <div style="margin:4px 0 8px"><input class="dxw-webhook" type="text" placeholder="https://discord.com/api/webhooks/…" style="width:360px;max-width:100%;padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 0"><button data-act="discordsave">Save webhook</button></div>
            <div class="kv-sub">${tgLine}</div>
            <div style="margin:4px 0 8px"><input class="dxw-tgtoken" type="text" placeholder="Telegram bot token (optional)" style="width:230px;max-width:100%;padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 0"><input class="dxw-tgchat" type="text" placeholder="chat id" style="width:120px;padding:7px 10px;border-radius:10px;border:0;margin:0 6px 6px 0"><button data-act="tgsave">Save</button></div>
            <div style="margin:8px 0"><button data-act="test">📨 Send a test alert</button> <span class="dxw-testmsg" style="font-size:13px"></span></div>

            <h3>Options</h3>
            <div class="kv-sub">Don’t repeat the same catch for</div>
            <div>${[5, 30, 60, 240].map(v => `<button data-set="cooldownMinutes" data-val="${v}" class="${Number(s.cooldownMinutes) === v ? 'kv-on' : ''}">${v} min</button>`).join('')}</div>
            <div class="kv-sub" style="margin-top:8px">Show catches to listeners (on-page toast + public feed)</div>
            <div><button data-set="publicCatches" data-val="true" class="${s.publicCatches ? 'kv-on' : ''}">Yes</button><button data-set="publicCatches" data-val="false" class="${s.publicCatches ? '' : 'kv-on'}">No</button></div>

            <h3>Recent catches (${a.catches.length})</h3>
            ${a.catches.length ? `<div><button data-act="clearcatches">Clear the list</button></div>
              <table style="margin-top:6px"><tr><th>When</th><th>Station</th><th>PI</th><th>Freq</th><th>Signal</th></tr>${a.catches.map(c => `<tr><td style="white-space:nowrap">${ago(c.ts)}</td><td>${esc(c.name || '')}${c.city ? ' <small style="opacity:.7">' + esc(c.city) + '</small>' : ''}</td><td>${esc(c.pi)}</td><td>${Number(c.freq).toFixed(1)}</td><td>${c.sig == null ? '–' : esc(c.sig) + ' dBf'}</td></tr>`).join('')}</table>` : '<div class="kv-empty">Nothing caught yet.</div>'}`;
    }

    function setupPage() {
        let wired = false;
        window.fmdxSetupTab({ id: 'dxwatch', title: 'DX Watch', icon: 'fa-binoculars', onShow: box => {
            if (!wired) {
                wired = true;
                const post = async (url, reload = true) => { try { const r = await api('POST', url); if (reload) load(box); return r; } catch (err) { alert('DX Watch: ' + err.message); throw err; } };
                box.addEventListener('click', async e => {
                    const b = e.target.closest('button'); if (!b) return;
                    e.preventDefault();
                    if (b.dataset.set) return void post(`/dxwatch/settings?${b.dataset.set}=${encodeURIComponent(b.dataset.val)}`);
                    if (b.dataset.toggle) return void post(`/dxwatch/targets?action=toggle&id=${encodeURIComponent(b.dataset.toggle)}`);
                    if (b.dataset.remove) return void post(`/dxwatch/targets?action=remove&id=${encodeURIComponent(b.dataset.remove)}`);
                    const act = b.dataset.act;
                    if (act === 'add') {
                        const type = box.querySelector('.dxw-type').value, value = box.querySelector('.dxw-value').value.trim(), label = box.querySelector('.dxw-label').value.trim();
                        if (type !== 'any-new' && !value) { alert('Enter a PI code or a frequency first.'); return; }
                        return void post(`/dxwatch/targets?action=add&type=${type}&value=${encodeURIComponent(value)}&label=${encodeURIComponent(label)}`);
                    }
                    if (act === 'clearcatches') return void post('/dxwatch/targets?action=clearcatches');
                    if (act === 'discordsave') { const v = box.querySelector('.dxw-webhook').value.trim(); return void post(`/dxwatch/settings?discordWebhook=${encodeURIComponent(v)}`); }
                    if (act === 'discordclear') return void post('/dxwatch/settings?discordWebhook=');
                    if (act === 'tgsave') { const tok = box.querySelector('.dxw-tgtoken').value.trim(), chat = box.querySelector('.dxw-tgchat').value.trim(); return void post(`/dxwatch/settings?telegramToken=${encodeURIComponent(tok)}&telegramChat=${encodeURIComponent(chat)}`); }
                    if (act === 'test') {
                        const msg = box.querySelector('.dxw-testmsg');
                        try { const r = await post('/dxwatch/test', false); if (msg) msg.textContent = `Sent — Discord: ${r.sentDiscord ? '✓' : '—'}, Telegram: ${r.sentTelegram ? '✓' : '—'}`; } catch (_) { /* alerted */ }
                    }
                });
                // typing a PI/frequency and pressing Enter = Add
                box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.dxw-value, .dxw-label')) { e.preventDefault(); e.stopPropagation(); const add = box.querySelector('button[data-act="add"]'); if (add) add.click(); } });
            }
            load(box);
        } });
    }

    function start() { setupPage(); mainPage(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

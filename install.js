#!/usr/bin/env node
// Installer for the konvlachos plugins for FM-DX Webserver (Linux, Raspberry Pi, Windows):
//   Station Log, Listener Insights, Fair Tuner Sharing, Chat Filter
//
//   Install all:     node install.js <FM-DX folder>
//   Install some:    node install.js <FM-DX folder> StationLog ListenerInsights
//   Uninstall:       node install.js <FM-DX folder> --uninstall
//
// Fair Tuner Sharing needs one small "plugin command filter" line in server/index.js and
// Chat Filter one small "plugin chat filter" line in server/chat.js; the installer adds them
// (backups: server/index.js.before-plugin-filter, server/chat.js.before-chat-filter). Safe to run twice.
const fs = require('fs');
const path = require('path');
const ALL = ['StationLog', 'ListenerInsights', 'FairShare', 'ChatFilter'];
const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const dir = args.find(a => !a.startsWith('--') && !ALL.includes(a));
const chosen = args.filter(a => ALL.includes(a));
const plugins = chosen.length ? chosen : ALL;
const fail = m => { console.error('\n  ERROR: ' + m + '\n'); process.exit(1); };
if (!dir) fail('Tell me where FM-DX Webserver is, for example:\n\n    node install.js /home/pi/fm-dx-webserver\n    node install.js C:\\fm-dx-webserver');
const app = path.resolve(dir), indexJs = path.join(app, 'server', 'index.js'), pdir = path.join(app, 'plugins');
if (!fs.existsSync(indexJs)) fail(`"${app}" is not an FM-DX Webserver folder (server/index.js not found).`);

const HOOK = "        // Plugin command filters (e.g. Fair Tuner Sharing): a filter returning false drops the command\n        if (Array.isArray(global.fmdxCommandFilters) && !global.fmdxCommandFilters.every(f => { try { return f({ ws, request, command, isAdmin: isAdminAuthenticated }) !== false; } catch (e) { return true; } })) return;\n\n";
const ANCHOR = /( *)if \(\(serverConfig\.publicTuner && !serverConfig\.lockToAdmin\)[^\n]*\n\s*output\.write\(`\$\{command\}\\n`\);/;
const raw = fs.readFileSync(indexJs, 'utf8'), crlf = raw.includes('\r\n');
let src = raw.replace(/\r\n/g, '\n');
const save = t => fs.writeFileSync(indexJs, crlf ? t.replace(/\n/g, '\r\n') : t);

// Chat Filter: one line in server/chat.js, just before a message is saved and shown to everyone
const chatJs = path.join(app, 'server', 'chat.js');
const CHAT_HOOK = "            // Plugin chat filters (e.g. Chat Filter): a filter returning false drops the message\n            if (Array.isArray(global.fmdxChatFilters) && !global.fmdxChatFilters.every(f => { try { return f({ ws, request, message: messageData, isAdmin: request.session?.isAdminAuthenticated === true }) !== false; } catch (e) { return true; } })) return;\n\n";
const CHAT_ANCHOR = /( *)storage\.chatHistory\.push\(messageData\);/;
const chatRaw = fs.existsSync(chatJs) ? fs.readFileSync(chatJs, 'utf8') : '', chatCrlf = chatRaw.includes('\r\n');
const chatSrc = chatRaw.replace(/\r\n/g, '\n');
const saveChat = t => fs.writeFileSync(chatJs, chatCrlf ? t.replace(/\n/g, '\r\n') : t);

if (uninstall) {
    for (const p of plugins) for (const f of [p + '.js', p]) {
        const x = path.join(pdir, f);
        if (fs.existsSync(x)) { fs.rmSync(x, { recursive: true, force: true }); console.log('  - removed plugins/' + f); }
    }
    if (plugins.includes('FairShare') && src.includes(HOOK)) { save(src.split(HOOK).join('')); console.log('  - removed the plugin command filter line from server/index.js'); }
    if (plugins.includes('ChatFilter') && chatSrc.includes(CHAT_HOOK)) { saveChat(chatSrc.split(CHAT_HOOK).join('')); console.log('  - removed the plugin chat filter line from server/chat.js'); }
    console.log('\n  Done. Restart FM-DX Webserver.\n');
    process.exit(0);
}

for (const p of plugins) {
    fs.mkdirSync(path.join(pdir, p), { recursive: true });
    fs.copyFileSync(path.join(__dirname, p + '.js'), path.join(pdir, p + '.js'));
    for (const f of fs.readdirSync(path.join(__dirname, p))) fs.copyFileSync(path.join(__dirname, p, f), path.join(pdir, p, f));
    console.log(`  ✓ ${p} copied to plugins/${p}`);
}
if (plugins.includes('FairShare')) {
    if (src.includes(HOOK)) console.log('  ✓ server/index.js already has the plugin command filter line');
    else if (!ANCHOR.test(src)) console.log('  ! ' + 'this FM-DX version looks different (made for FM-DX 1.4.x); server/index.js was not changed.\n  Station Log and Listener Insights work anyway; Fair Tuner Sharing will do nothing.');
    else {
        const backup = indexJs + '.before-plugin-filter';
        if (!fs.existsSync(backup)) fs.copyFileSync(indexJs, backup);
        save(src.replace(ANCHOR, m => HOOK + m));
        console.log('  ✓ server/index.js: plugin command filter line added (backup: server/index.js.before-plugin-filter)');
    }
}
if (plugins.includes('ChatFilter')) {
    if (chatSrc.includes(CHAT_HOOK)) console.log('  ✓ server/chat.js already has the plugin chat filter line');
    else if (!CHAT_ANCHOR.test(chatSrc)) console.log('  ! server/chat.js looks different (made for FM-DX 1.4.x) and was not changed: Chat Filter will do nothing.');
    else {
        const backup = chatJs + '.before-chat-filter';
        if (!fs.existsSync(backup)) fs.copyFileSync(chatJs, backup);
        saveChat(chatSrc.replace(CHAT_ANCHOR, m => CHAT_HOOK + m));
        console.log('  ✓ server/chat.js: plugin chat filter line added (backup: server/chat.js.before-chat-filter)');
    }
}
if (process.platform !== 'win32' && process.getuid && process.getuid() === 0) {
    const { uid, gid } = fs.statSync(app);
    for (const p of plugins) for (const x of [path.join(pdir, p + '.js'), path.join(pdir, p), ...fs.readdirSync(path.join(pdir, p)).map(f => path.join(pdir, p, f))]) { try { fs.chownSync(x, uid, gid); } catch (_) { /* ignore */ } }
}
console.log(`
  Installed. Next:
    1. Open your FM-DX page, log in as admin, go to Setup -> Plugins,
       tick the new plugins and press Save.
    2. Restart FM-DX Webserver.
  Each plugin then has its own tab in Setup.
`);

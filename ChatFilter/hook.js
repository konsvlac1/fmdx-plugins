// Chat Filter needs one line in FM-DX's server/chat.js, just before a message is saved and shown to
// everyone. Used by install.js and by the "Fix it now" button in the Setup tab.
'use strict';
const fs = require('fs');

const OLD_CHAT_HOOKS = ["            // Plugin chat filters (e.g. Chat Filter): a filter returning false drops the message\n            if (Array.isArray(global.fmdxChatFilters) && !global.fmdxChatFilters.every(f => { try { return f({ ws, request, message: messageData, isAdmin: request.session?.isAdminAuthenticated === true }) !== false; } catch (e) { return true; } })) return;\n\n"];
const CHAT_HOOK = "            // Plugin chat filters (e.g. Chat Filter): a filter returning false drops the message.\n            // Right after a restart, until Chat Filter has started, messages are refused instead of sent unchecked.\n            if (!Array.isArray(global.fmdxChatFilters) && (serverConfig.plugins || []).some(p => /^ChatFilter\\//.test(p))) { ws.send(JSON.stringify({ nickname: '🛡️ Chat Filter', message: 'The chat is starting, please try again in a few seconds.', time: '', id: -1 })); return; }\n            if (Array.isArray(global.fmdxChatFilters) && !global.fmdxChatFilters.every(f => { try { return f({ ws, request, message: messageData, isAdmin: request.session?.isAdminAuthenticated === true }) !== false; } catch (e) { return true; } })) return;\n\n";
const CHAT_ANCHOR = /( *)storage\.chatHistory\.push\(messageData\);/;

function read(chatJs) {
    const raw = fs.existsSync(chatJs) ? fs.readFileSync(chatJs, 'utf8') : '';
    return { raw, crlf: raw.includes('\r\n'), src: raw.replace(/\r\n/g, '\n') };
}
const write = (chatJs, crlf, text) => fs.writeFileSync(chatJs, crlf ? text.replace(/\n/g, '\r\n') : text);

// 'ok' (line there), 'old' (an older version of the line), 'missing', or 'unknown' (chat.js looks different)
function status(chatJs) {
    const { src } = read(chatJs);
    if (src.includes(CHAT_HOOK)) return 'ok';
    if (OLD_CHAT_HOOKS.some(h => src.includes(h))) return 'old';
    return CHAT_ANCHOR.test(src) ? 'missing' : 'unknown';
}

// Adds or updates the line (backup: server/chat.js.before-chat-filter). Returns 'added', 'updated',
// 'already' or 'unknown' (nothing changed).
function install(chatJs) {
    const { src, crlf } = read(chatJs);
    const old = OLD_CHAT_HOOKS.find(h => src.includes(h));
    if (old) { write(chatJs, crlf, src.replace(old, CHAT_HOOK)); return 'updated'; }
    if (src.includes(CHAT_HOOK)) return 'already';
    if (!CHAT_ANCHOR.test(src)) return 'unknown';
    const backup = chatJs + '.before-chat-filter';
    if (!fs.existsSync(backup)) fs.copyFileSync(chatJs, backup);
    write(chatJs, crlf, src.replace(CHAT_ANCHOR, m => CHAT_HOOK + m));
    return 'added';
}

// Removes the line (any version). Returns true if something was removed.
function uninstall(chatJs) {
    const { src, crlf } = read(chatJs);
    const all = [CHAT_HOOK, ...OLD_CHAT_HOOKS];
    if (!all.some(h => src.includes(h))) return false;
    write(chatJs, crlf, all.reduce((t, h) => t.split(h).join(''), src));
    return true;
}

module.exports = { CHAT_HOOK, OLD_CHAT_HOOKS, CHAT_ANCHOR, status, install, uninstall };

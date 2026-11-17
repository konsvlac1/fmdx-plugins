// Fair Tuner Sharing needs one line in FM-DX's server/index.js, just before a tune command goes to
// the tuner. Used by install.js and by the "Fix it now" button in the Setup tab.
'use strict';
const fs = require('fs');

const HOOK = "        // Plugin command filters (e.g. Fair Tuner Sharing): a filter returning false drops the command\n        if (Array.isArray(global.fmdxCommandFilters) && !global.fmdxCommandFilters.every(f => { try { return f({ ws, request, command, isAdmin: isAdminAuthenticated }) !== false; } catch (e) { return true; } })) return;\n\n";
const ANCHOR = /( *)if \(\(serverConfig\.publicTuner && !serverConfig\.lockToAdmin\)[^\n]*\n\s*output\.write\(`\$\{command\}\\n`\);/;

function read(indexJs) {
    const raw = fs.existsSync(indexJs) ? fs.readFileSync(indexJs, 'utf8') : '';
    return { crlf: raw.includes('\r\n'), src: raw.replace(/\r\n/g, '\n') };
}
const write = (indexJs, crlf, text) => fs.writeFileSync(indexJs, crlf ? text.replace(/\n/g, '\r\n') : text);

// 'ok', 'missing', or 'unknown' (index.js looks different)
function status(indexJs) {
    const { src } = read(indexJs);
    if (src.includes(HOOK)) return 'ok';
    return ANCHOR.test(src) ? 'missing' : 'unknown';
}

// Adds the line (backup: server/index.js.before-plugin-filter). Returns 'added', 'already' or 'unknown'.
function install(indexJs) {
    const { src, crlf } = read(indexJs);
    if (src.includes(HOOK)) return 'already';
    if (!ANCHOR.test(src)) return 'unknown';
    const backup = indexJs + '.before-plugin-filter';
    if (!fs.existsSync(backup)) fs.copyFileSync(indexJs, backup);
    write(indexJs, crlf, src.replace(ANCHOR, m => HOOK + m));
    return 'added';
}

// Removes the line. Returns true if it was there.
function uninstall(indexJs) {
    const { src, crlf } = read(indexJs);
    if (!src.includes(HOOK)) return false;
    write(indexJs, crlf, src.split(HOOK).join(''));
    return true;
}

module.exports = { HOOK, ANCHOR, status, install, uninstall };

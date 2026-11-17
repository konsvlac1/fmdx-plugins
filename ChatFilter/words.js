// Chat Filter: the word list and the matching (no FM-DX dependencies, so it can be tested alone).
//
// A list entry matches a whole word; an entry ending in * matches every word that starts with it.
// Entries written in Greek also catch Greeklish (malakas, gamw, pou$th...), and every entry
// catches CAPITALS, missing accents, repeated letters (fuuuck), symbols (sh!t, f@ck) and
// spaced-out letters (f u c k, μ.α.λ.α.κ.α).
'use strict';

const BUILTIN = [
    // English
    'fuck*', 'fck', 'fuk', 'fucc*', 'motherf*', 'shit*', 'bullshit*', 'bitch*', 'biatch', 'cunt*',
    'asshole*', 'arsehole*', 'dickhead*', 'cock', 'cocks', 'cocksuck*', 'pussy', 'pussies', 'bastard*',
    'whore*', 'slut*', 'wank*', 'twat*', 'nigger*', 'nigga*', 'faggot*', 'fag', 'fags', 'retard*', 'kys',
    // Greek (catches Greeklish too)
    'μαλακα', 'μαλακας', 'μαλακες', 'μαλακισμενε', 'μαλακισμενο', 'μαλακισμενη', 'μαλακισμενοι', 'παλιομαλακα',
    'γαμω', 'γαμωτο', 'γαμωσταυρο', 'γαμησου', 'γαμησε', 'γαμησετε', 'γαμιεσαι', 'γαμιεστε', 'γαμιεται',
    'γαμημενε', 'γαμημενο', 'γαμημενη', 'γαμιολη*', 'γαμηθειτε', 'γαμηθεις',
    'πουτανα*', 'πουτανες', 'πουτανακι', 'πουτανιαρ*', 'πουστη', 'πουστης', 'πουστηδες', 'πουστρα', 'πουστια',
    'αρχιδι', 'αρχιδια', 'αρχιδα', 'αρχιδαρα', 'μουνι', 'μουνια', 'μουνο', 'μουναρα',
    'καριολη', 'καριολης', 'καριολα', 'καριολια', 'καργιολη', 'καργιολα', 'καργιολης',
    'σκατα', 'σκατο', 'σκατοφατσα', 'σκατοψυχη', 'πουτσα', 'πουτσες', 'πουτσαρα', 'πουτσος',
    'καυλι', 'καυλια', 'καυλωμεν*', 'τσουλα', 'τσουλες', 'κερατα', 'κερατας',
    'κωλοπαιδο', 'κωλοπαιδα', 'κωλογλειφτη', 'κωλογλειφτης', 'μπασταρδε', 'μπασταρδο'
];

const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't' };
const GR = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n',
    ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'i', φ: 'f', χ: 'x', ψ: 'ps', ω: 'o' };
const GREEK = /[Ͱ-Ͽἀ-῿]/;

// Cyrillic letters that look Latin (fuсk with a Cyrillic с), and invisible characters (fu\u200Bck)
const LOOK = { а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's' };
const INVISIBLE = /[\u00ad\u200b-\u200f\u2060\ufeff]/g;
const base = s => [...String(s).replace(INVISIBLE, '').toLowerCase()].map(c => LOOK[c] || c).join('').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
const collapse = s => s.replace(/(.)\1+/g, '$1');
// Plain form, for Latin entries: f@ck -> fack, fuuuck -> fuck
const plain = t => collapse([...base(t)].map(c => LEET[c] || c).join(''));
// Greek/Greeklish form, for Greek entries: μαλάκα, malaka, MALAKAAA -> malaka; γαμώ, gamw -> gamo
function greek(t) {
    let s = base(t).replace(/αυ/g, 'av').replace(/ευ/g, 'ev');
    s = [...s].map(c => GR[c] || (c === '8' ? 'th' : LEET[c]) || c).join('');
    s = s.replace(/ch/g, 'x').replace(/ks/g, 'x').replace(/h/g, 'i').replace(/w/g, 'o').replace(/[yu]/g, 'i')
         .replace(/mp/g, 'b').replace(/nt/g, 'd').replace(/g[kg]/g, 'g').replace(/ai/g, 'e');
    return collapse(s);
}

function compile(list) {
    const out = [];
    for (const raw of list || []) {
        const w = String(raw).trim();
        if (!w) continue;
        const prefix = w.endsWith('*');
        const word = prefix ? w.slice(0, -1) : w;
        if (!word) continue;
        const isGreek = GREEK.test(word);
        out.push({ entry: w, prefix, isGreek, form: isGreek ? greek(word) : plain(word) });
    }
    return out;
}

// Words of a message with their place in it. Also joined: letters split by spaces or dots (f u c k,
// μ.α.λ.α.κ.α) and pieces glued by one symbol without spaces (fu.ck, f*ck, sh-it).
function tokens(text) {
    const s = String(text || '');
    const words = [];
    for (const m of s.matchAll(/[\p{L}\p{N}\p{M}@$!|+\u00ad\u200b-\u200f\u2060\ufeff]+/gu)) {
        let w = m[0], start = m.index;
        const lead = w.match(/^[!|+]+/), trail = w.match(/[!|+]+$/);
        if (lead) { start += lead[0].length; w = w.slice(lead[0].length); }
        if (trail) w = w.slice(0, w.length - trail[0].length);
        if (w) words.push({ w, start, end: start + w.length });
    }
    const out = words.slice();
    for (let i = 0; i < words.length;) {
        let j = i;
        while (j < words.length && [...words[j].w].length === 1) j++;
        if (j - i >= 3) out.push({ w: words.slice(i, j).map(x => x.w).join(''), start: words[i].start, end: words[j - 1].end });
        i = Math.max(j, i + 1);
    }
    for (let i = 0; i < words.length;) {
        let j = i;
        while (j + 1 < words.length && words[j + 1].start - words[j].end === 1 && /[.\-_*~'`]/.test(s[words[j].end])) j++;
        if (j > i) out.push({ w: words.slice(i, j + 1).map(x => x.w).join(''), start: words[i].start, end: words[j].end });
        i = j + 1;
    }
    return out;
}

function hit(tok, compiled) {
    let p = null, g = null;
    for (const e of compiled) {
        const f = e.isGreek ? (g = g || greek(tok.w)) : (p = p || plain(tok.w));
        if (e.prefix ? f.startsWith(e.form) : f === e.form) return e.entry;
    }
    return null;
}

// -> { found: [ { word, entry } ], masked }
function check(text, compiled) {
    const s = String(text || '');
    const found = [];
    for (const t of tokens(s)) {
        const entry = hit(t, compiled);
        if (entry) found.push({ word: s.slice(t.start, t.end), entry, start: t.start, end: t.end });
    }
    // hide the longest matches first; skip a match inside a part that is already hidden
    const spans = [];
    for (const f of found.slice().sort((a, b) => (b.end - b.start) - (a.end - a.start)))
        if (!spans.some(x => f.start < x.end && f.end > x.start)) spans.push(f);
    let masked = s;
    for (const f of spans.sort((a, b) => b.start - a.start))
        masked = masked.slice(0, f.start) + '*'.repeat(Math.max(3, Math.min(8, [...f.word].length))) + masked.slice(f.end);
    return { found: found.map(f => ({ word: f.word, entry: f.entry })), masked };
}

// Links: http(s)://…, www.…, or name.<common ending> (example.com, t.me/x, discord.gg/x, bit.ly/x).
// Numbers like 106.8 or 1.4.2 are not links. -> [ { text, host, start, end } ]
const TLD = 'com|net|org|info|biz|gr|eu|io|me|gg|ly|co|cc|to|tv|app|dev|xyz|top|site|online|shop|store|link|live|click|club|pro|ru|ua|de|uk|us|fr|it|es|nl|be|pl|ro|bg|cy|al|tr|in|cn|tk|ml|ga|cf|gq|sh|ai|so|ws|fm|am|vip|win|bet|casino|porn|sex|xxx';
const LINK = new RegExp(`(?:https?:\\/\\/[^\\s<>"']+|www\\.[^\\s<>"']+|\\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLD})\\b(?:[/:?#][^\\s<>"']*)?)`, 'gi');
function links(text) {
    const s = String(text || '').replace(INVISIBLE, ''), out = [];
    for (const m of s.matchAll(LINK)) {
        const host = m[0].replace(/^https?:\/\//i, '').split(/[/:?#]/)[0].toLowerCase().replace(/^www\./, '').replace(/[.,;!)]+$/, '');
        out.push({ text: m[0], host, start: m.index, end: m.index + m[0].length });
    }
    return out;
}
const siteAllowed = (host, sites) => (sites || []).some(x => host === x || host.endsWith('.' + x));

module.exports = { BUILTIN, compile, check, links, siteAllowed, _forms: { plain, greek } };

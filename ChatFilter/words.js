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

const base = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
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

// Words of a message with their place in it; letters split by dots/spaces (f u c k) are joined too.
function tokens(text) {
    const s = String(text || '');
    const words = [];
    for (const m of s.matchAll(/[\p{L}\p{N}@$!|+]+/gu)) {
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
    let masked = s;
    for (const f of found.slice().sort((a, b) => b.start - a.start)) {
        if (masked.slice(f.start, f.end).includes('*')) continue;   // already hidden by a longer match
        masked = masked.slice(0, f.start) + '*'.repeat(Math.max(3, Math.min(8, [...f.word].length))) + masked.slice(f.end);
    }
    return { found: found.map(f => ({ word: f.word, entry: f.entry })), masked };
}

module.exports = { BUILTIN, compile, check, _forms: { plain, greek } };

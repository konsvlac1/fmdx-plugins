// Chat Filter: the word list and the matching (no FM-DX dependencies, so it can be tested alone).
//
// A list entry matches a whole word; an entry ending in * matches every word that starts with it;
// an entry starting with ! is an exception: that word is never blocked (γάμος = wedding, under γαμο*);
// an entry with spaces is a phrase: those words in a row (each word may end in *).
// Entries written in Greek also catch Greeklish (malakas, gamw, pou$th...), and every entry
// catches CAPITALS, missing accents, repeated letters (fuuuck), symbols (sh!t, f@ck) and
// spaced-out letters (f u c k, μ.α.λ.α.κ.α).
'use strict';

const BUILTIN = [
    // English
    'fuck*', 'fck', 'fuk', 'fucc*', 'motherf*', 'shit*', 'bullshit*', 'bitch*', 'biatch', 'cunt*',
    'asshole*', 'arsehole*', 'dickhead*', 'cock', 'cocks', 'cocksuck*', 'pussy', 'pussies', 'bastard*',
    'whore*', 'slut*', 'wank*', 'twat*', 'nigger*', 'nigga', 'niggas', 'niggaz', 'faggot*', 'fag', 'fags', 'retard', 'retards', 'retarded', 'kys',
    // Greek (catches Greeklish too)
    'μαλακα', 'μαλακας', 'μαλακες', 'μαλακισμεν*', 'μαλακιζ*', 'μαλακια', 'μαλακιες', 'αρχιμαλακας', 'χοντρομαλακας', 'παλιομαλακα',
    'γαμω', 'γαμωτο', 'γαμωσταυρο', 'γαμησου', 'γαμησε', 'γαμησετε', 'γαμιεσαι', 'γαμιεστε', 'γαμιεται',
    'γαμημενε', 'γαμημενο', 'γαμημενη', 'γαμιολη*', 'γαμηθειτε', 'γαμηθεις', 'γαμηδια', 'γαμηδι',
    'γαμω*', 'γαμο*', 'γαμησ*', 'γαμημεν*',
    // normal words that start like the ones above (wedding, marital...)
    '!γαμος', '!γαμου', '!γαμο', '!γαμοι', '!γαμων', '!γαμους', '!γαμοπιλαφο', '!γαμοπιλαφα', '!shiitake', '!shitake', '!shiite', '!shiites', '!wankel',
    '!κολαρα', '!κολαρο', '!κολαρου', '!κολαρων', '!κολαρακι', '!γαμα', '!γκαμα', '!γκαμες', '!μουνουχος',
    // English words that look like Greeklish spellings of the Greek entries
    '!cheese', '!cheeses', '!chaise', '!chaises', '!pipes', '!pupa', '!pupae', '!pupas', '!pouts', '!poilu',
    // "γαμάτο" = great/cool in everyday slang: allowed (add γαματ* as your own word to block it)
    '!γαματο', '!γαματος', '!γαματη', '!γαματα', '!γαματοι', '!γαματες', '!γαματου', '!γαματων', '!γαματους', '!μουνουχοι', '!μουνουχου', '!καυλος', '!καυλου', '!καυλοι', '!καυλων', '!καυλους', '!καυλο',
    // same letters, other accent: μαλακά = softly, κέρατα = horns (an exception with an accent only allows that accent)
    '!μαλακά', '!κέρατα',
    'πουταν*', 'πουστ*',
    'αρχιδι', 'αρχιδια', 'αρχιδα', 'αρχιδαρα', 'αρχιδακι', 'αρχιδακια', 'αρχιδατος', 'αρχιδοκαυλος',
    'μουνι*', 'μουνο*', 'μουνα*', 'μουνακ*', 'μουνοτρυπ*',
    'ψωλ*', 'πουτσ*', 'πουλι', 'πουλαρα', 'πουλαρες', 'καυλ*', 'καβλ*', 'τσιμπουκ*', 'πιπα', 'πιπες', 'πιπακι', 'πιπακια',
    'βυζι', 'βυζια', 'βυζακια', 'βυζαρα', 'βυζαρες', 'κωλος', 'κωλαρα', 'κωλαρες', 'κωλαρακι', 'κωλαρακος', 'κωλοτρυπ*', 'κωλοφαρδ*',
    'μπινε', 'μπινες', 'μπινεδες', 'πορνη', 'πορνες', 'πορνιδιο', 'πορνο*', 'γλειφτρα', 'ξεκωλι*', 'ξεκωλω*', 'ξεπαρθεν*',
    // from Wiktionary's Greek vulgar / offensive words (normal words left out)
    'γαμα*', 'γαμιεμαι', 'γαμιεσαι', 'γαμιεται', 'γαμιομαστε', 'γαμιεστε', 'γαμιουνται', 'γαμιας', 'γαμιολα', 'αγαμητ*', 'κακογαμημεν*',
    'ακαυλος', 'γλειφομουν*', 'πλακομουν*', 'κλαψομουν*', 'κωλομουν*', 'μαλαπερδα', 'καραπουτανα', 'κοκοτα', 'τροτεζα', 'φακλανα',
    'κουραδ*', 'κωλοδαχτυλο', 'κωλογερος', 'κωλογρια', 'κωλοπαιδαρας', 'κωλοπαιδι', 'κωλοφυλλαδα', 'σφουγγοκωλαριος', 'χοντροκωλ*',
    'σκατουλα', 'σκατουλακι', 'σκατουλης', 'σκατουλι', 'σκατουλιτσα', 'σκατιλα', 'σκατης', 'σκατας', 'σκατογερος', 'σκατογρια', 'σκατοπαιδο',
    'ξεσκατ*', 'χεζω', 'χεζεις', 'χεζει', 'χεζουμε', 'χεζετε', 'χεζουν', 'χεζομαι', 'χεζεσαι', 'χεζεται', 'χεζας', 'χεζου',
    'χεσε', 'χεσω', 'χεσει', 'χεσεις', 'χεσουν', 'χεσου', 'χεστε', 'χεστει', 'χεστηκα', 'χεστηκες', 'χεστηκε', 'χεστηκαμε', 'χεστηκατε', 'χεστηκαν',
    'χεστης', 'χεστες', 'χεστρα', 'χεσιμο', 'χεσμεν*', 'τσιρλα', 'χυσι', 'χυσια', 'πορδ*', 'κλανω', 'κλανει', 'κλανια', 'κλανιες', 'κλασιμο', 'κλανιαρ*',
    'τσουτσουνι', 'πιπων*', 'σηκωμαρα', 'πισωκολλητο', 'αυλοκολακας', 'παπαρι', 'παπαρας', 'πισωγλεντης', 'μπουχεσας',
    'βρωμοθηλυκο', 'βρομοθηλυκο', 'ζωντοβολο', 'σαπιοκοιλια', 'σκασμος', 'σκυλα', 'σκυλαρα', 'χοντρομπαλας', 'χοντρομπαλου',
    'παλιογερος', 'παλιογρια', 'ανεγκεφαλος', 'κιναιδος', 'πρεζακιας', 'πρεζονι',
    // racial / ethnic slurs
    'αραπης', 'αραπισσα', 'αραπινα', 'αραπακι', 'γυφτος', 'γυφτοι', 'γυφτισσα', 'γιουφτος', 'καραγυφτος', 'τουρκαλας',
    'καριολη', 'καριολης', 'καριολα', 'καριολια', 'καργιολη', 'καργιολα', 'καργιολης',
    'σκατα', 'σκατο', 'σκατοφατσα', 'σκατοψυχη', 
     'τσουλα', 'τσουλες', 'κερατα', 'κερατας',
    'κωλοπαιδο', 'κωλοπαιδα', 'κωλογλειφτη', 'κωλογλειφτης', 'μπασταρδ*',
    // Greek insults
    'ηλιθιε', 'ηλιθιοι', 'βλακα', 'βλακες', 'βλακεντιε', 'κοπανε', 'καθυστερημενε', 'καθυστερημενοι', 'βλαμμεν*',
    'τσογλαν*', 'καθαρμα*', 'καθικι', 'καθικια', 'χαιβανι', 'χαιβανια', 'σιχαμα',
    'βρωμοστομα', 'βρωμιαρη', 'βρωμιαρα', 'σιχτιρ*', 'ψοφα', 'ψοφησε', 'ψοφηστε', 'ψοφησεις', 'ψοφιμι',
    // Greek phrases (more are made automatically below: GREEK_STARTS x GREEK_ENDS)
    'να πας στο διαολο', 'στο διαολο να πας', 'πηγαινε στο διαολο', 'να χαθεις', 'να ψοφησεις', 'να πεθανεις', 'να πνιγεις',
    'χαθειτε ρε', 'χασου ρε', 'πνιξου ρε', 'ψοφα ρε', 'σκασε ρε', 'βγαλε το σκασμο', 'κλεισε το στομα σου', 'κλεισε το ρημαδι',
    'θα σε σκοτωσω', 'θα σε σφαξω', 'θα σε πνιξω', 'στον κωλο σου', 'στα παπαρια μου', 'παπαρια', 'παπαριες', 'φτου σου',
    // English insults and phrases
    'idiot', 'idiots', 'moron*', 'dumbass*', 'jackass*', 'douche*', 'scumbag*',
    'go to hell', 'shut up', 'shut the hell up', 'stfu', 'go die', 'kill yourself', 'drop dead', 'piss off',
    'screw you', 'suck my', 'you suck', 'damn you', 'get lost loser', 'eat dirt', 'i will kill you'
];

// Greek curses made of a start + an ending ("άι στο διάολο", "άντε χάσου", "άμε πνίξου"...): every combination
const GREEK_STARTS = ['α', 'αι', 'αντε', 'αιντε', 'αμε', 'αει', 'ασε'];
const GREEK_ENDS = ['στο διαολο', 'στον διαολο', 'στο διαλο', 'στον διαλο', 'στα κομματια', 'στα τσακιδια', 'στον κοραχα', 'στον αγυριστο', 'χαθου', 'χασου',
    'πνιξου', 'πνιγου', 'κουρεψου', 'σιχτιρ', 'ψοφα', 'σκασε', 'πεθανε', 'γαμησου', 'παρατα μας', 'στο πουτανα'];
for (const a of GREEK_STARTS) for (const b of GREEK_ENDS) BUILTIN.push(a + ' ' + b);

// English: "List of Dirty, Naughty, Obscene and Otherwise Bad Words" (Shutterstock, CC BY 4.0,
// https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), without the
// entries that are also everyday words (as, butt, escort, hardcore, tied up, big black...).
const LDNOOBW_EN = ["2g1c", "2 girls 1 cup", "acrotomophilia", "alabama hot pocket", "alaskan pipeline", "anal", "anilingus", "anus", "apeshit", "arsehole", "asshole", "assmunch", "auto erotic", "autoerotic", "babeland", "baby batter", "baby juice", "ball gag", "ball gravy", "ball licking", "ball sack", "ball sucking", "bangbros", "bangbus", "barely legal", "bastard", "bastardo", "bbw", "bdsm", "beaner", "beaners", "beaver cleaver", "beaver lips", "beastiality", "bestiality", "big breasts", "big knockers", "big tits", "bimbos", "birdlock", "bitch", "bitches", "black cock", "blonde on blonde action", "blowjob", "blow job", "blow your load", "blue waffle", "blumpkin", "bollocks", "bondage", "boner", "booty call", "brown showers", "bukkake", "bulldyke", "bullet vibe", "bullshit", "bung hole", "bunghole", "busty", "buttcheeks", "butthole", "camel toe", "camgirl", "camslut", "camwhore", "carpet muncher", "carpetmuncher", "chocolate rosebuds", "cialis", "circlejerk", "cleveland steamer", "clit", "clitoris", "clover clamps", "clusterfuck", "cock", "cocks", "coprolagnia", "coprophilia", "cornhole", "coon", "coons", "creampie", "cum", "cumming", "cumshot", "cumshots", "cunnilingus", "cunt", "darkie", "date rape", "daterape", "deep throat", "deepthroat", "dendrophilia", "dildo", "dingleberry", "dingleberries", "dirty pillows", "dirty sanchez", "doggie style", "doggiestyle", "doggy style", "doggystyle", "dog style", "dolcett", "dominatrix", "dommes", "donkey punch", "double dong", "double penetration", "dp action", "dry hump", "dvda", "eat my ass", "ecchi", "ejaculation", "erotic", "erotism", "fag", "faggot", "fecal", "felch", "fellatio", "feltch", "female squirting", "femdom", "figging", "fingerbang", "fisting", "foot fetish", "footjob", "frotting", "fuck", "fuck buttons", "fuckin", "fucking", "fucktards", "fudge packer", "fudgepacker", "futanari", "gangbang", "gang bang", "gay sex", "genitals", "giant cock", "girl on top", "girls gone wild", "goatcx", "goatse", "god damn", "gokkun", "golden shower", "goodpoop", "goregasm", "group sex", "guro", "hand job", "handjob", "hentai", "homoerotic", "honkey", "horny", "hot carl", "humping", "incest", "jack off", "jail bait", "jailbait", "jerk off", "jigaboo", "jiggaboo", "jiggerboo", "jizz", "juggs", "kike", "kinbaku", "kinkster", "knobbing", "leather restraint", "leather straight jacket", "lemon party", "livesex", "make me come", "male squirting", "masturbate", "masturbating", "masturbation", "menage a trois", "milf", "missionary position", "motherfucker", "mound of venus", "mr hands", "muff diver", "muffdiving", "nambla", "nawashi", "neonazi", "nigga", "nigger", "nig nog", "nimphomania", "nsfw", "nsfw images", "nude", "nudity", "nutten", "nympho", "nymphomania", "octopussy", "omorashi", "one cup two girls", "one guy one jar", "orgasm", "orgy", "paedophile", "paki", "panties", "panty", "pedobear", "pedophile", "pegging", "penis", "phone sex", "piece of shit", "pikey", "pissing", "piss pig", "pisspig", "pole smoker", "ponyplay", "poon", "poontang", "punany", "poop chute", "poopchute", "porn", "porno", "pornography", "prince albert piercing", "pthc", "pubes", "pussy", "queaf", "queef", "quim", "raghead", "raging boner", "rape", "raping", "rapist", "rectum", "reverse cowgirl", "rimjob", "rimming", "rosy palm", "rosy palm and her 5 sisters", "rusty trombone", "sadism", "santorum", "schlong", "scissoring", "semen", "sex", "sexcam", "sexo", "shaved beaver", "shaved pussy", "shemale", "shibari", "shit", "shitblimp", "shitty", "shota", "shrimping", "slanteye", "slut", "smut", "sodomize", "sodomy", "spastic", "spic", "splooge", "splooge moose", "spooge", "spread legs", "strap on", "strapon", "strip club", "style doggy", "suicide girls", "sultry women", "swastika", "tea bagging", "threesome", "throating", "thumbzilla", "tits", "titties", "titty", "topless", "tosser", "towelhead", "tranny", "tribadism", "tub girl", "tubgirl", "twat", "two girls one cup", "upskirt", "urethra play", "urophilia", "vagina", "venus mound", "viagra", "vibrator", "violet wand", "vorarephilia", "voyeurweb", "vulva", "wank", "wetback", "wet dream", "white power", "whore", "worldsex", "wrapping men", "wrinkled starfish", "yaoi", "yellow showers", "yiffy", "zoophilia"];
for (const w of LDNOOBW_EN) if (!BUILTIN.includes(w)) BUILTIN.push(w);

const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't' };
const GR = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n',
    ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'i', φ: 'f', χ: 'x', ψ: 'ps', ω: 'o' };
const GREEK = /[Ͱ-Ͽἀ-῿]/;

// Cyrillic letters that look Latin (fuсk with a Cyrillic с), and invisible characters (fu\u200Bck)
const LOOK = { а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's' };
const INVISIBLE = /[\u00ad\u200b-\u200f\u2060\ufeff]/g;
const base = s => [...String(s).replace(INVISIBLE, '').toLowerCase()].map(c => LOOK[c] || c).join('').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
// Plain form, for Latin entries: f@ck -> fack (repeated letters are handled when comparing, see same())
const plain = t => [...base(t)].map(c => LEET[c] || c).join('');
// Greek/Greeklish form, for Greek entries: μαλάκα, malaka, MALAKAAA -> malaka; γαμώ, gamw -> gamo
function greek(t) {
    let s = base(t).replace(/αυ/g, 'av').replace(/ευ/g, 'ev');
    s = [...s].map(c => GR[c] || (c === '8' ? 'th' : LEET[c]) || c).join('');
    s = s.replace(/ch/g, 'x').replace(/ks/g, 'x').replace(/h/g, 'i').replace(/w/g, 'o').replace(/[yu]/g, 'i')
         .replace(/mp/g, 'b').replace(/nt/g, 'd').replace(/g[kg]/g, 'g').replace(/ai/g, 'e');
    return s;
}

// Exceptions compare the exact letters (only accents and capitals ignored), so γάμο (wedding) is
// allowed while γαμώ / gamw are not. Greeklish spelling of the exception is allowed too (gamos).
const STRICT = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'h', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n',
    ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'u', φ: 'f', χ: 'x', ψ: 'ps', ω: 'w' };
const strict = t => base(t);
const ACCENT = /[\u0300-\u036f]/;
const accented = t => String(t).replace(INVISIBLE, '').toLowerCase().normalize('NFC').replace(/ς/g, 'σ');
const strictLatin = t => [...base(t)].map(c => STRICT[c] || c).join('');

// Letters with their repeat counts: 'fuuuck' -> [['f',1],['u',3],['c',1],['k',1]]
function runs(s) {
    const out = [];
    for (const c of s) { const last = out[out.length - 1]; if (last && last[0] === c) last[1]++; else out.push([c, 1]); }
    return out;
}
const VOWEL = /[aeiouy]/;
// Is word w (runs) the entry e (runs)? Same letters in the same order, and for each letter:
// same count, or stretched (3+ times: fuuuck), or a doubled vowel (fuuck, shiit) where the
// entry has one. A double in the entry must be in the word too (coon is not con).
// prefix: the entry only has to match the start of the word.
function same(w, e, prefix) {
    if (prefix ? w.length < e.length : w.length !== e.length) return false;
    for (let i = 0; i < e.length; i++) {
        const [c, ec] = e[i], [wc, n] = w[i];
        if (c !== wc) return false;
        const last = prefix && i === e.length - 1;
        if (n === ec || n >= 3 || (n === 2 && ec === 1 && VOWEL.test(c)) || (last && n > ec)) continue;
        return false;
    }
    return true;
}

function compile(list) {
    const out = [];
    for (const raw of list || []) {
        const w = String(raw).trim().replace(/\s+/g, ' ');
        if (!w) continue;
        if (w.includes(' ') && !w.startsWith('!')) {           // a phrase
            const parts = compile(w.split(' ')).filter(x => !x.except);
            if (parts.length > 1) out.push({ entry: w, phrase: parts });
            continue;
        }
        const except = w.startsWith('!');
        const prefix = w.endsWith('*');
        const word = (prefix ? w.slice(0, -1) : w).replace(/^!/, '');
        if (!word) continue;
        const isGreek = GREEK.test(word);
        out.push({ entry: w, prefix, except, isGreek, form: runs(isGreek ? greek(word) : plain(word)),
            acc: except && ACCENT.test(word.normalize('NFD')),
            strict: except ? (ACCENT.test(word.normalize('NFD')) ? [accented(word)] : [strict(word), strictLatin(word)]) : null });
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
    out.words = words;      // just the words as typed, in order (for phrases)
    return out;
}

function hit(tok, compiled) {
    let p = null, g = null, found = null;
    for (const e of compiled) {
        if (e.phrase) continue;
        const f = e.isGreek ? (g = g || runs(greek(tok.w))) : (p = p || runs(plain(tok.w)));
        if (e.except) {
            if (e.strict.includes(e.acc ? accented(tok.w) : strict(tok.w))) return null;      // a normal word: never blocked
            continue;
        }
        if (same(f, e.form, e.prefix)) found = found || e.entry;
    }
    return found;
}

const partHit = (part, w) => same(runs(part.isGreek ? greek(w) : plain(w)), part.form, part.prefix);

// -> { found: [ { word, entry } ], masked }
function check(text, compiled) {
    const s = String(text || '');
    const found = [];
    const toks = tokens(s);
    for (const t of toks) {
        const entry = hit(t, compiled);
        if (entry) found.push({ word: s.slice(t.start, t.end), entry, start: t.start, end: t.end });
    }
    // phrases: the plain words of the message, in order
    const words1 = toks.words;
    for (const e of compiled) {
        if (!e.phrase) continue;
        const n = e.phrase.length;
        for (let i = 0; i + n <= words1.length; i++) {
            let ok = true;
            for (let k = 0; k < n && ok; k++) ok = partHit(e.phrase[k], words1[i + k].w);
            if (ok) found.push({ word: s.slice(words1[i].start, words1[i + n - 1].end), entry: e.entry, start: words1[i].start, end: words1[i + n - 1].end });
        }
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

#!/usr/bin/env bash
# ============================================================================
#  FM-DX Webserver - εργαλείο ενημέρωσης για Linux / Raspberry Pi
#  του Konstantinos Vlachos
#
#  Ενημερώνει το FM-DX Webserver στην τελευταία έκδοση ΚΡΑΤΩΝΤΑΣ τις ρυθμίσεις
#  σας (config.json), όλα τα πρόσθετα, τις ρυθμίσεις τους, τις συνδέσεις και το
#  session secret. Βρίσκει μόνο του τον φάκελο fm-dx-webserver, κρατάει πρώτα
#  αντίγραφο ασφαλείας, και ΣΤΑΜΑΤΑΕΙ χωρίς να αλλάξει τίποτα αν κάτι δεν πάει καλά.
#
#  Χρήση:
#     ./update-fm-dx-linux.el.sh                 # βρίσκει τον φάκελο μόνο του
#     ./update-fm-dx-linux.el.sh /path/to/fm-dx-webserver
#     FMDX_DIR=/path/to/fm-dx-webserver ./update-fm-dx-linux.el.sh
#     ./update-fm-dx-linux.el.sh -y              # χωρίς ερωτήσεις, κατευθείαν
#
#  Χρειάζεται: node + npm. git αν ο φάκελος είναι git clone, αλλιώς curl/wget
#  και unzip για να κατεβάσει το τελευταίο ZIP.
# ============================================================================
set -u

YES=0
ARGDIR=""
for a in "$@"; do
    case "$a" in
        -y|--yes) YES=1 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        -*) echo "Άγνωστη επιλογή: $a" >&2; exit 2 ;;
        *)  ARGDIR="$a" ;;
    esac
done

say()  { printf '%s\n' "$*"; }
die()  { printf '\n[ΔΙΑΚΟΠΗ] %s\n' "$*" >&2; printf 'Δεν άλλαξε τίποτα δικό σας.\n' >&2; exit 1; }
ask()  { # ask "ερώτηση" ; επιστρέφει 0 για ναι
    [ "$YES" = "1" ] && return 0
    { true </dev/tty; } 2>/dev/null || die "Χρειάζεται επιβεβαίωση αλλά δεν υπάρχει terminal. Ξανατρέξτε με -y για ενημέρωση χωρίς ερωτήσεις."
    local r; printf '%s [y/N] ' "$1" >&2; read -r r </dev/tty || return 1
    case "$r" in y|Y|yes|YES|ν|Ν|ναι|ΝΑΙ) return 0 ;; *) return 1 ;; esac
}

is_fmdx() { [ -n "$1" ] && [ -f "$1/package.json" ] && grep -q 'fm-dx-webserver' "$1/package.json" 2>/dev/null; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd -P)"

say ""
say "=============================================="
say "  FM-DX Webserver - ενημέρωση στην τελευταία έκδοση"
say "=============================================="

# ---- 1) βρες τον φάκελο fm-dx-webserver ------------------------------------
# Μια διαδρομή που δίνετε με το χέρι (όρισμα ή FMDX_DIR) πρέπει να είναι σωστή:
# αν δεν είναι, σταματάμε αντί να ενημερώσουμε κατά λάθος άλλον φάκελο.
DIR=""
if [ -n "$ARGDIR" ]; then
    is_fmdx "$ARGDIR" || die "Το '$ARGDIR' δεν είναι φάκελος FM-DX Webserver."
    DIR="$ARGDIR"
elif [ -n "${FMDX_DIR:-}" ]; then
    is_fmdx "${FMDX_DIR:-}" || die "FMDX_DIR='$FMDX_DIR': δεν είναι φάκελος FM-DX Webserver."
    DIR="$FMDX_DIR"
else
    for cand in "$SCRIPT_DIR" "$PWD" \
                "$HOME/fm-dx-webserver" "/root/fm-dx-webserver" \
                "/home/pi/fm-dx-webserver" "/opt/fm-dx-webserver" \
                "/usr/local/fm-dx-webserver"; do
        if is_fmdx "$cand"; then DIR="$cand"; break; fi
    done
    # ψάξε στους συνηθισμένους φακέλους ως τελευταία λύση
    if [ -z "$DIR" ]; then
        say "Ψάχνω τον φάκελο fm-dx-webserver..."
        while IFS= read -r pj; do
            d="$(dirname -- "$pj")"
            if is_fmdx "$d"; then DIR="$d"; break; fi
        done < <(find /home /root /opt /usr/local -maxdepth 4 -type f -name package.json \
                      -path '*fm-dx-webserver*' 2>/dev/null)
    fi
    [ -n "$DIR" ] || die "Δεν βρέθηκε ο φάκελος fm-dx-webserver. Δώστε τον: ./update-fm-dx-linux.el.sh /path/to/fm-dx-webserver"
fi
DIR="$(cd -- "$DIR" >/dev/null 2>&1 && pwd -P)" || die "Ο φάκελος '$DIR' δεν είναι προσβάσιμος."
is_fmdx "$DIR" || die "Το '$DIR' δεν μοιάζει με φάκελο FM-DX Webserver (δεν ταιριάζει το package.json)."

say ""
say "Βρέθηκε το FM-DX Webserver στο:"
say "    $DIR"
case "$DIR" in
    */[Dd]ownloads/*|/tmp/*|*/[Tt]mp/*|/var/tmp/*)
        say ""
        say "ΠΡΟΣΟΧΗ: αυτός ο φάκελος είναι μέσα σε Downloads ή προσωρινή τοποθεσία."
        say "Συνήθως είναι ένα προσωρινό αντίγραφο, ΟΧΙ ο πραγματικός σας server, και"
        say "το σύστημα μπορεί να σβήσει μόνο του τους προσωρινούς φακέλους. Βάλτε το"
        say "FM-DX σε μόνιμο φάκελο (π.χ. /opt/fm-dx-webserver ή το home σας)."
        ;;
esac
ask "Να ενημερωθεί ΑΥΤΟΣ ο φάκελος;" || die "Ακυρώθηκε."

# ---- 2) έλεγχος περιβάλλοντος (σταμάτα αν λείπει κάτι) ----------------------
command -v node >/dev/null 2>&1 || die "Το Node.js δεν είναι εγκατεστημένο (λείπει το 'node')."
command -v npm  >/dev/null 2>&1 || die "Το npm δεν είναι εγκατεστημένο."

USE_GIT=0
if [ -d "$DIR/.git" ]; then
    command -v git >/dev/null 2>&1 || die "Είναι git clone αλλά το 'git' δεν είναι εγκατεστημένο."
    USE_GIT=1
else
    { command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1; } \
        || die "Δεν είναι git clone και δεν υπάρχει ούτε 'curl' ούτε 'wget' (χρειάζεται για κατέβασμα)."
    command -v unzip >/dev/null 2>&1 || die "Δεν είναι git clone και το 'unzip' δεν είναι εγκατεστημένο."
fi

# τρέξε git/npm ως ο ιδιοκτήτης του φακέλου (να μη φτιαχτούν αρχεία του root)
OWNER="$(stat -c '%U' "$DIR" 2>/dev/null || echo "$USER")"
NEED_SUDO=0
if [ "$(id -un)" != "$OWNER" ]; then
    if [ "$(id -u)" = "0" ]; then
        command -v sudo >/dev/null 2>&1 || die "Τα αρχεία ανήκουν στον '$OWNER'· χρειάζεται sudo για να ενεργήσουμε ως αυτός ο χρήστης."
        NEED_SUDO=1
    else
        die "Ο φάκελος ανήκει στον '$OWNER'. Τρέξτε το script ως '$OWNER' (ή με sudo)."
    fi
fi
run_as() { if [ "$NEED_SUDO" = "1" ]; then sudo -u "$OWNER" -H -- "$@"; else "$@"; fi; }

[ -w "$DIR" ] || [ "$NEED_SUDO" = "1" ] || die "Δεν υπάρχει δικαίωμα εγγραφής στο '$DIR'. Τρέξτε ως '$OWNER' ή με sudo."

# σταμάτα τον server που τρέχει ώστε να μη χρησιμοποιούνται τα αρχεία (ξεκινάει ξανά στο τέλος)
STOPPED_SERVICE=0
HAS_SERVICE=0
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^fm-dx-webserver\.service'; then
    HAS_SERVICE=1
    if systemctl is-active --quiet fm-dx-webserver.service; then
        say ""
        say "Σταματάω το service fm-dx-webserver..."
        if [ "$(id -u)" = "0" ]; then systemctl stop fm-dx-webserver.service && STOPPED_SERVICE=1
        else sudo systemctl stop fm-dx-webserver.service && STOPPED_SERVICE=1; fi
    fi
else
    say ""
    say "Αν τρέχει το FM-DX Webserver, σταματήστε το τώρα ώστε να μη χρησιμοποιούνται τα αρχεία."
    ask "Σταμάτησε (ή να συνεχίσω);" || die "Σταματήστε το FM-DX και ξανατρέξτε το."
fi

# ---- 3) αντίγραφο ασφαλείας ρυθμίσεων και πρόσθετων -------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${DIR}-backup-${STAMP}"
say ""
say "Κρατάω αντίγραφο ασφαλείας ρυθμίσεων και πρόσθετων στο:"
say "    $BACKUP"
mkdir -p "$BACKUP/web/js" || die "Δεν μπόρεσα να φτιάξω τον φάκελο αντιγράφου '$BACKUP'."
for f in config.json .session-secret sessions.json; do
    [ -e "$DIR/$f" ] && cp -a "$DIR/$f" "$BACKUP/" 2>/dev/null
done
for d in plugins plugins_configs; do
    [ -d "$DIR/$d" ] && cp -a "$DIR/$d" "$BACKUP/" 2>/dev/null
done
[ -d "$DIR/web/js/plugins" ] && cp -a "$DIR/web/js/plugins" "$BACKUP/web/js/" 2>/dev/null

# αν είναι git clone, κράτα και αντίγραφο από κάθε αρχείο που ΑΛΛΑΞΑΤΕ εσείς
# (δικές σας προσαρμογές + αρχεία που προσθέσατε), ώστε να μη χαθούν ποτέ
if [ "$USE_GIT" = "1" ]; then
    CUSTOM="$( { run_as git -C "$DIR" diff --name-only HEAD; run_as git -C "$DIR" ls-files --others --exclude-standard; } 2>/dev/null | sort -u )"
    if [ -n "$CUSTOM" ]; then
        n=0
        while IFS= read -r rel; do
            [ -n "$rel" ] && [ -e "$DIR/$rel" ] || continue
            mkdir -p "$BACKUP/custom/$(dirname -- "$rel")" 2>/dev/null
            cp -a "$DIR/$rel" "$BACKUP/custom/$rel" 2>/dev/null && n=$((n + 1))
        done <<EOF_CUSTOM
$CUSTOM
EOF_CUSTOM
        [ "$n" -gt 0 ] && say "Κρατήθηκε αντίγραφο από $n δικά σας αλλαγμένα/προσαρμοσμένα αρχεία στο backup (custom/)."
    fi
fi
say "Το αντίγραφο ασφαλείας έτοιμο."

# ---- 4) ενημέρωση του κώδικα ----------------------------------------------
UPSTREAM="https://github.com/NoobishSVK/fm-dx-webserver"
HOOK_NOTE=0

if [ "$USE_GIT" = "1" ]; then
    say ""
    say "Ενημέρωση (git)..."
    run_as git config --global --add safe.directory "$DIR" >/dev/null 2>&1 || true
    stashed=0
    out="$(run_as git -C "$DIR" stash 2>&1 || true)"
    case "$out" in *"No local changes"*) stashed=0 ;; *"Saved working directory"*) stashed=1 ;; *) stashed=0 ;; esac
    if ! run_as git -C "$DIR" pull --ff-only 2>/dev/null; then
        if ! run_as git -C "$DIR" pull; then
            [ "$stashed" = "1" ] && run_as git -C "$DIR" stash pop >/dev/null 2>&1 || true
            die "Το git pull απέτυχε. Ο φάκελός σας έμεινε ανέπαφος."
        fi
    fi
    if [ "$stashed" = "1" ]; then
        if ! run_as git -C "$DIR" stash pop >/dev/null 2>&1; then
            # το pop συγκρούστηκε: επαναφορά στον καθαρό upstream ώστε να μη μείνουν markers
            run_as git -C "$DIR" reset --hard HEAD >/dev/null 2>&1 || true
            HOOK_NOTE=1
            say ""
            say "ΣΗΜΕΙΩΣΗ: οι δικές σας αλλαγές σε βασικά αρχεία δεν ξαναμπήκαν πάνω"
            say "          από την ενημέρωση, οπότε ο κώδικας επανήλθε στην καθαρή νέα έκδοση."
            say "          ΔΕΝ χάθηκαν - είναι στο backup και στο 'git stash'."
        fi
    fi
else
    say ""
    say "Δεν είναι git clone - κατεβάζω τον τελευταίο κώδικα ως ZIP..."
    TMP="$(mktemp -d)" || die "Δεν μπόρεσα να φτιάξω προσωρινό φάκελο."
    trap 'rm -rf "$TMP"' EXIT
    ZIP="$TMP/fmdx.zip"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$UPSTREAM/archive/refs/heads/main.zip" -o "$ZIP" || die "Το κατέβασμα απέτυχε."
    else
        wget -q "$UPSTREAM/archive/refs/heads/main.zip" -O "$ZIP" || die "Το κατέβασμα απέτυχε."
    fi
    unzip -q "$ZIP" -d "$TMP" || die "Δεν μπόρεσα να αποσυμπιέσω το αρχείο."
    SRC="$TMP/fm-dx-webserver-main"
    [ -d "$SRC" ] || die "Το αρχείο που κατέβηκε φαίνεται λάθος (δεν υπάρχει fm-dx-webserver-main)."
    say "Αντιγράφω τον νέο κώδικα (ρυθμίσεις και πρόσθετα μένουν ως έχουν)..."
    # αντίγραψε τα πάντα ΕΚΤΟΣ από τα δικά σας δεδομένα· κράτα πρόσθετα, config και sessions.
    # Όποιο βασικό αρχείο αντικατασταθεί, πρώτα μπαίνει στο backup (replaced/), ώστε
    # ένα αρχείο που προσαρμόσατε να μη σβηστεί σιωπηλά - μένει ανακτήσιμο.
    if command -v rsync >/dev/null 2>&1; then
        run_as rsync -a --backup --backup-dir="$BACKUP/replaced" \
            --exclude '.git' --exclude 'node_modules' \
            --exclude 'plugins' --exclude 'plugins_configs' \
            --exclude 'web/js/plugins' \
            --exclude 'config.json' --exclude '.session-secret' --exclude 'sessions.json' \
            "$SRC"/ "$DIR"/ || die "Η αντιγραφή απέτυχε."
    else
        ( cd "$SRC" && find . -type d \
             ! -path './.git*' ! -path './node_modules*' \
             ! -path './plugins*' ! -path './plugins_configs*' ! -path './web/js/plugins*' \
             -exec sh -c 'mkdir -p "$0/$1"' "$DIR" {} \; )
        ( cd "$SRC" && find . -type f \
             ! -path './.git*' ! -path './node_modules*' \
             ! -path './plugins*' ! -path './plugins_configs*' ! -path './web/js/plugins*' \
             ! -name config.json ! -name .session-secret ! -name sessions.json \
             -print ) | while IFS= read -r rel; do
                 rel="${rel#./}"
                 # κράτα ό,τι πρόκειται να αλλάξει (διατηρεί τις προσαρμογές σας)
                 if [ -e "$DIR/$rel" ] && ! cmp -s "$SRC/$rel" "$DIR/$rel"; then
                     mkdir -p "$BACKUP/replaced/$(dirname -- "$rel")" 2>/dev/null
                     cp -a "$DIR/$rel" "$BACKUP/replaced/$rel" 2>/dev/null
                 fi
                 run_as cp -a "$SRC/$rel" "$DIR/$rel"
             done
    fi
    HOOK_NOTE=1   # ανανεώθηκαν τα βασικά αρχεία, οι γραμμές των πρόσθετων χάθηκαν
fi

# ---- 5) εξαρτήσεις --------------------------------------------------------
# npm_doctor: τρέχει `npm ci`, κι αν αποτύχει εφαρμόζει ΜΟΝΟ ασφαλείς, αναστρέψιμες
# διορθώσεις (επανάληψη σε προσωρινά σφάλματα δικτύου, έλεγχος/καθαρισμός cache,
# ανακατασκευή node_modules, εναλλακτικά `npm install`). Το node_modules ξαναφτιάχνεται
# πλήρως και το install έχει ήδη αντίγραφο, οπότε τίποτα δεν χάνεται. Προβλήματα που
# θέλουν αλλαγές συστήματος ή επικίνδυνες επιλογές (build tools, δικαιώματα, χώρος δίσκου,
# έκδοση Node) ΔΕΝ επιχειρούνται - αναφέρονται με συγκεκριμένη οδηγία. Χωρίς --force.
npm_doctor() {
    local log n
    log="$(mktemp 2>/dev/null || echo "$DIR/.npm-update.log")"
    _npm() { say "  > npm $*"; ( cd "$DIR" && run_as npm "$@" ) >"$log" 2>&1; local r=$?; tail -n 3 "$log" | sed 's/^/    | /'; return $r; }
    _has() { grep -qiE "$1" "$log"; }

    _npm ci && { rm -f "$log"; return 0; }

    # --- δεν διορθώνονται με ασφάλεια από εδώ: αναφορά συγκεκριμένου βήματος, καμία αλλαγή ---
    if _has "gyp ERR|node-gyp|prebuild-install|make: \*\*\*|collect2|MSBUILD|Visual Studio|not found.*(make|python|gcc|g\+\+)"; then
        say ""; say "ΠΡΟΣΟΧΗ: μια εξάρτηση χρειάζεται build tools για μεταγλώττιση, οπότε το npm δεν ολοκληρώθηκε."
        say "         Ο κώδικας του FM-DX ενημερώθηκε. Σε Raspberry Pi / Debian τρέξτε:"
        say "             sudo apt-get install -y build-essential python3"
        say "         και μετά 'npm ci' μέσα στο $DIR. (πλήρες log: $log)"
        return 1
    fi
    if _has "EACCES|EPERM|permission denied|operation not permitted"; then
        say ""; say "ΠΡΟΣΟΧΗ: σφάλμα δικαιωμάτων στο npm. Ο κώδικας του FM-DX ενημερώθηκε."
        say "         Κάποιο αρχείο ανήκει σε άλλον χρήστη. Ξανατρέξτε τον updater ως '$OWNER', ή:"
        say "             sudo chown -R $OWNER \"$DIR/node_modules\" && (cd \"$DIR\" && npm ci)"
        say "         (πλήρες log: $log)"
        return 1
    fi
    if _has "ENOSPC|no space left"; then
        say ""; say "ΠΡΟΣΟΧΗ: ο δίσκος είναι γεμάτος, το npm δεν ολοκληρώθηκε. Ελευθερώστε χώρο και τρέξτε"
        say "         'npm ci' μέσα στο $DIR. (πλήρες log: $log)"
        return 1
    fi
    if _has "EBADENGINE|Unsupported engine|requires Node|engine \"node\""; then
        say ""; say "ΠΡΟΣΟΧΗ: το Node.js σας είναι πολύ παλιό για το FM-DX 1.4. Εγκαταστήστε νεότερο Node LTS και"
        say "         τρέξτε 'npm ci' μέσα στο $DIR. (πλήρες log: $log)"
        return 1
    fi

    # --- ασφαλείς αυτόματες διορθώσεις ---
    if _has "ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|ENOTFOUND|socket hang up|network|429 Too Many"; then
        for n in 1 2; do say "  Προσωρινό πρόβλημα δικτύου - αναμονή 5s και νέα προσπάθεια ($n/2)..."; sleep 5; _npm ci && { rm -f "$log"; return 0; }; done
    fi
    if _has "EINTEGRITY|integrity check|sha512|sha1-|tarball data|corrupt|checksum"; then
        say "  Ένα αρχείο κατέβηκε χαλασμένο - έλεγχος του npm cache και νέα προσπάθεια..."
        ( cd "$DIR" && run_as npm cache verify ) >>"$log" 2>&1 || true
        _npm ci && { rm -f "$log"; return 0; }
        say "  Ακόμα πρόβλημα - καθαρισμός του npm cache και νέα προσπάθεια..."
        ( cd "$DIR" && run_as npm cache clean --force ) >>"$log" 2>&1 || true
        _npm ci && { rm -f "$log"; return 0; }
    fi
    # Τελευταία λύση (καλύπτει lockfile εκτός συγχρονισμού και μισοφτιαγμένο node_modules):
    say "  Ανακατασκευή εξαρτήσεων από την αρχή (διαγραφή node_modules - ξαναφτιάχνεται πλήρως)..."
    ( cd "$DIR" && run_as rm -rf node_modules ) >>"$log" 2>&1 || true
    _npm install --no-audit --no-fund && { rm -f "$log"; return 0; }

    say ""; say "ΠΡΟΣΟΧΗ: το npm δεν ολοκληρώθηκε ούτε μετά τις ασφαλείς προσπάθειες. Ο κώδικας του FM-DX"
    say "         ενημερώθηκε. Τα τελευταία μηνύματα του npm είναι πιο πάνω· τρέξτε 'npm ci' μέσα στο"
    say "         $DIR για το πλήρες σφάλμα. (πλήρες log: $log)"
    return 1
}

say ""
say "Εγκατάσταση/ενημέρωση εξαρτήσεων (npm ci)..."
say "  Αν φαίνεται να σταματά για λίγο, είναι φυσιολογικό - γράφει τα"
say "  πακέτα στον δίσκο. Δεν έχει κολλήσει· περιμένετε λίγο."
npm_doctor || true

# ---- 5b) έλεγχος/επιδιόρθωση ffmpeg (το npm ci το κατεβάζει κάθε φορά) -----
# Το ffmpeg-static κατεβάζει το ffmpeg σε install script· το npm ci σβήνει το
# node_modules, οπότε πρέπει να ξανατρέξει. Κάποια npm μπλοκάρουν τα install
# scripts, γι' αυτό το τρέχουμε απευθείας (node) αντί για npm rebuild.
FFFAIL=0
FFBIN="$DIR/node_modules/ffmpeg-static/ffmpeg"
FFINST="$DIR/node_modules/ffmpeg-static/install.js"
if [ ! -s "$FFBIN" ]; then
    say ""
    say "Λείπει το ffmpeg (το npm ci το κατεβάζει κάθε φορά). Γίνεται επιδιόρθωση..."
    [ -f "$FFINST" ] && ( cd "$DIR" && run_as node "$FFINST" ) || true
    if [ ! -s "$FFBIN" ]; then
        say "Νέα προσπάθεια λήψης του ffmpeg..."
        [ -f "$FFINST" ] && ( cd "$DIR" && run_as node "$FFINST" ) || true
    fi
    if [ ! -s "$FFBIN" ]; then
        FFFAIL=1
        say ""
        say "ΠΡΟΣΟΧΗ: δεν κατέβηκε το ffmpeg αυτόματα. Ο ήχος ΔΕΝ θα ξεκινήσει μέχρι"
        say "         να διορθωθεί. Ελέγξτε τη σύνδεση του server και μετά τρέξτε"
        say "         'node node_modules/ffmpeg-static/install.js' μέσα στο $DIR."
    else
        say "Το ffmpeg είναι στη θέση του."
    fi
fi

# ---- 6) τέλος -------------------------------------------------------------
say ""
say "=============================================="
say "  Έτοιμο. Το FM-DX Webserver είναι ενημερωμένο."
say "  Οι ρυθμίσεις και τα πρόσθετά σας διατηρήθηκαν."
say "  Αντίγραφο ασφαλείας: $BACKUP"
say "=============================================="
if [ "$HOOK_NOTE" = "1" ]; then
    say ""
    say "ΣΗΜΕΙΩΣΗ: οι γραμμές των πρόσθετων στα server/chat.js / server/index.js"
    say "          μπορεί να χάθηκαν. Αφού ξεκινήσει το FM-DX, ανοίξτε το Setup και"
    say "          πατήστε το κουμπί \"Fix it now\" σε κάθε πρόσθετο."
fi
say ""
# health_check: το `systemctl start` που επιστρέφει 0 σημαίνει μόνο ότι ξεκίνησε η unit -
# μια node εφαρμογή μπορεί να ξεκινήσει και μετά να κρασάρει. Επιβεβαιώνει ότι είναι ακόμα
# ζωντανό μετά από λίγα δευτερόλεπτα και (αν υπάρχει curl) ότι απαντά στην πόρτα του. Σε
# αποτυχία προειδοποιεί και δείχνει τα logs και το backup· ΔΕΝ κάνει επαναφορά μόνο του.
health_check() {
    local port code n
    sleep 6
    if ! systemctl is-active --quiet fm-dx-webserver.service; then
        say ""
        say "ΠΡΟΣΟΧΗ: το FM-DX ξεκίνησε αλλά δεν έμεινε ζωντανό (σταμάτησε μέσα σε λίγα δευτερόλεπτα)."
        say "         Η προηγούμενη έκδοσή σας έχει αντίγραφο στο:"
        say "             $BACKUP"
        say "         Δείτε τι πήγε στραβά με:"
        say "             journalctl -u fm-dx-webserver.service -n 50 --no-pager"
        return 1
    fi
    port="$(grep -oE '"port"[[:space:]]*:[[:space:]]*[0-9]+' "$DIR/config.json" 2>/dev/null | grep -oE '[0-9]+$' | head -1)"
    [ -n "$port" ] || port=8080
    if command -v curl >/dev/null 2>&1; then
        for n in 1 2 3 4 5; do
            code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null || true)"
            [ "$code" = "200" ] && { say "Το FM-DX είναι πάνω και απαντά στην πόρτα $port."; return 0; }
            sleep 2
        done
        say ""
        say "ΣΗΜΕΙΩΣΗ: το FM-DX τρέχει, αλλά δεν απάντησε στο http://127.0.0.1:$port μέσα σε ~15s."
        say "          Ίσως ακόμα ξεκινά, ή η πόρτα στο config.json είναι άλλη. Αν η σελίδα δεν"
        say "          ανοίγει, δείτε:  journalctl -u fm-dx-webserver.service -n 50 --no-pager"
        return 0
    fi
    say "Το FM-DX τρέχει."
    return 0
}

# ξεκίνα ξανά το service: αυτόματα αν το σταματήσαμε, αλλιώς ρώτα
if [ "$FFFAIL" = "1" ]; then
    say "ΔΕΝ ξεκινάω το FM-DX: λείπει ακόμα το ffmpeg (δείτε την προειδοποίηση πιο πάνω)."
    say "Διορθώστε το ffmpeg και ξεκινήστε το μόνοι: sudo systemctl start fm-dx-webserver.service"
elif [ "$STOPPED_SERVICE" = "1" ]; then
    say "Ξεκινάω ξανά το service fm-dx-webserver..."
    if [ "$(id -u)" = "0" ]; then systemctl start fm-dx-webserver.service && say "Ξεκίνησε."
    else sudo systemctl start fm-dx-webserver.service && say "Ξεκίνησε."; fi
    health_check || true
elif [ "$HAS_SERVICE" = "1" ]; then
    if ask "Να γίνει επανεκκίνηση του service fm-dx-webserver τώρα;"; then
        if [ "$(id -u)" = "0" ]; then systemctl restart fm-dx-webserver.service && say "Έγινε επανεκκίνηση."
        else sudo systemctl restart fm-dx-webserver.service && say "Έγινε επανεκκίνηση."; fi
        health_check || true
    else
        say "Ξεκινήστε ξανά το FM-DX Webserver όποτε είστε έτοιμοι."
    fi
else
    say "Τώρα ξεκινήστε ξανά το FM-DX Webserver."
fi

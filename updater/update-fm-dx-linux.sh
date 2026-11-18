#!/usr/bin/env bash
# ============================================================================
#  FM-DX Webserver - updater for Linux / Raspberry Pi
#  by Konstantinos Vlachos
#
#  Updates FM-DX Webserver to the latest version while KEEPING your settings
#  (config.json), all plugins, plugin settings, logins and session secret.
#  It finds the fm-dx-webserver folder automatically, makes a backup first,
#  and ABORTS without changing anything if something is not right.
#
#  Usage:
#     ./update-fm-dx-linux.sh                 # find the folder automatically
#     ./update-fm-dx-linux.sh /path/to/fm-dx-webserver
#     FMDX_DIR=/path/to/fm-dx-webserver ./update-fm-dx-linux.sh
#     ./update-fm-dx-linux.sh -y              # don't ask, just do it
#
#  Needs: node + npm. git if the folder is a git clone, otherwise curl/wget
#  and unzip to download the latest ZIP.
# ============================================================================
set -u

YES=0
ARGDIR=""
for a in "$@"; do
    case "$a" in
        -y|--yes) YES=1 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        -*) echo "Unknown option: $a" >&2; exit 2 ;;
        *)  ARGDIR="$a" ;;
    esac
done

say()  { printf '%s\n' "$*"; }
die()  { printf '\n[ABORT] %s\n' "$*" >&2; printf 'Nothing of yours was changed.\n' >&2; exit 1; }
ask()  { # ask "question" ; returns 0 for yes
    [ "$YES" = "1" ] && return 0
    { true </dev/tty; } 2>/dev/null || die "A confirmation is needed but there is no terminal. Re-run with -y to update without asking."
    local r; printf '%s [y/N] ' "$1" >&2; read -r r </dev/tty || return 1
    case "$r" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

is_fmdx() { [ -n "$1" ] && [ -f "$1/package.json" ] && grep -q 'fm-dx-webserver' "$1/package.json" 2>/dev/null; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd -P)"

say ""
say "=============================================="
say "  FM-DX Webserver - update to latest version"
say "=============================================="

# ---- 1) find the fm-dx-webserver folder -----------------------------------
# A path you give by hand (argument or FMDX_DIR) must be valid: if it is not,
# we abort rather than silently update some other folder.
DIR=""
if [ -n "$ARGDIR" ]; then
    is_fmdx "$ARGDIR" || die "'$ARGDIR' is not an FM-DX Webserver folder."
    DIR="$ARGDIR"
elif [ -n "${FMDX_DIR:-}" ]; then
    is_fmdx "${FMDX_DIR:-}" || die "FMDX_DIR='$FMDX_DIR' is not an FM-DX Webserver folder."
    DIR="$FMDX_DIR"
else
    for cand in "$SCRIPT_DIR" "$PWD" \
                "$HOME/fm-dx-webserver" "/root/fm-dx-webserver" \
                "/home/pi/fm-dx-webserver" "/opt/fm-dx-webserver" \
                "/usr/local/fm-dx-webserver"; do
        if is_fmdx "$cand"; then DIR="$cand"; break; fi
    done
    # search under the usual roots as a last resort
    if [ -z "$DIR" ]; then
        say "Looking for your fm-dx-webserver folder..."
        while IFS= read -r pj; do
            d="$(dirname -- "$pj")"
            if is_fmdx "$d"; then DIR="$d"; break; fi
        done < <(find /home /root /opt /usr/local -maxdepth 4 -type f -name package.json \
                      -path '*fm-dx-webserver*' 2>/dev/null)
    fi
    [ -n "$DIR" ] || die "Could not find your fm-dx-webserver folder. Pass it: ./update-fm-dx-linux.sh /path/to/fm-dx-webserver"
fi
DIR="$(cd -- "$DIR" >/dev/null 2>&1 && pwd -P)" || die "Folder '$DIR' is not accessible."
is_fmdx "$DIR" || die "'$DIR' does not look like an FM-DX Webserver folder (no matching package.json)."

say ""
say "Found FM-DX Webserver at:"
say "    $DIR"
ask "Update THIS folder?" || die "Cancelled."

# ---- 2) validate the environment (abort if anything is missing) -----------
command -v node >/dev/null 2>&1 || die "Node.js is not installed (no 'node')."
command -v npm  >/dev/null 2>&1 || die "npm is not installed."

USE_GIT=0
if [ -d "$DIR/.git" ]; then
    command -v git >/dev/null 2>&1 || die "This is a git clone but 'git' is not installed."
    USE_GIT=1
else
    { command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1; } \
        || die "Not a git clone and neither 'curl' nor 'wget' is installed (needed to download)."
    command -v unzip >/dev/null 2>&1 || die "Not a git clone and 'unzip' is not installed."
fi

# run git/npm as the folder's owner (don't create root-owned files)
OWNER="$(stat -c '%U' "$DIR" 2>/dev/null || echo "$USER")"
NEED_SUDO=0
if [ "$(id -un)" != "$OWNER" ]; then
    if [ "$(id -u)" = "0" ]; then
        command -v sudo >/dev/null 2>&1 || die "Files are owned by '$OWNER'; need sudo to act as that user."
        NEED_SUDO=1
    else
        die "This folder is owned by '$OWNER'. Run the script as '$OWNER' (or with sudo)."
    fi
fi
run_as() { if [ "$NEED_SUDO" = "1" ]; then sudo -u "$OWNER" -H -- "$@"; else "$@"; fi; }

[ -w "$DIR" ] || [ "$NEED_SUDO" = "1" ] || die "No write permission on '$DIR'. Run as '$OWNER' or with sudo."

# stop a running server so its files are not in use (restarted at the end)
STOPPED_SERVICE=0
HAS_SERVICE=0
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^fm-dx-webserver\.service'; then
    HAS_SERVICE=1
    if systemctl is-active --quiet fm-dx-webserver.service; then
        say ""
        say "Stopping the fm-dx-webserver service..."
        if [ "$(id -u)" = "0" ]; then systemctl stop fm-dx-webserver.service && STOPPED_SERVICE=1
        else sudo systemctl stop fm-dx-webserver.service && STOPPED_SERVICE=1; fi
    fi
else
    say ""
    say "If FM-DX Webserver is running, stop it now so its files are not in use."
    ask "Stopped (or ok to continue)?" || die "Stop FM-DX, then run this again."
fi

# ---- 3) backup your settings and plugins ----------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${DIR}-backup-${STAMP}"
say ""
say "Backing up settings and plugins to:"
say "    $BACKUP"
mkdir -p "$BACKUP/web/js" || die "Could not create backup folder '$BACKUP'."
for f in config.json .session-secret sessions.json; do
    [ -e "$DIR/$f" ] && cp -a "$DIR/$f" "$BACKUP/" 2>/dev/null
done
for d in plugins plugins_configs; do
    [ -d "$DIR/$d" ] && cp -a "$DIR/$d" "$BACKUP/" 2>/dev/null
done
[ -d "$DIR/web/js/plugins" ] && cp -a "$DIR/web/js/plugins" "$BACKUP/web/js/" 2>/dev/null

# if this is a git clone, also set aside a copy of every file YOU changed
# (your own customizations + any files you added), so an update never loses them
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
        [ "$n" -gt 0 ] && say "Kept a copy of your $n changed/custom file(s) in the backup (custom/)."
    fi
fi
say "Backup done."

# ---- 4) update the code ---------------------------------------------------
UPSTREAM="https://github.com/NoobishSVK/fm-dx-webserver"
HOOK_NOTE=0

if [ "$USE_GIT" = "1" ]; then
    say ""
    say "Updating (git)..."
    run_as git config --global --add safe.directory "$DIR" >/dev/null 2>&1 || true
    stashed=0
    out="$(run_as git -C "$DIR" stash 2>&1 || true)"
    case "$out" in *"No local changes"*) stashed=0 ;; *"Saved working directory"*) stashed=1 ;; *) stashed=0 ;; esac
    if ! run_as git -C "$DIR" pull --ff-only 2>/dev/null; then
        if ! run_as git -C "$DIR" pull; then
            [ "$stashed" = "1" ] && run_as git -C "$DIR" stash pop >/dev/null 2>&1 || true
            die "git pull failed. Your folder is untouched."
        fi
    fi
    if [ "$stashed" = "1" ]; then
        run_as git -C "$DIR" stash pop || HOOK_NOTE=1
    fi
else
    say ""
    say "Not a git clone - downloading the latest code as a ZIP..."
    TMP="$(mktemp -d)" || die "Could not create a temp folder."
    trap 'rm -rf "$TMP"' EXIT
    ZIP="$TMP/fmdx.zip"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$UPSTREAM/archive/refs/heads/main.zip" -o "$ZIP" || die "Download failed."
    else
        wget -q "$UPSTREAM/archive/refs/heads/main.zip" -O "$ZIP" || die "Download failed."
    fi
    unzip -q "$ZIP" -d "$TMP" || die "Could not unzip the download."
    SRC="$TMP/fm-dx-webserver-main"
    [ -d "$SRC" ] || die "Downloaded archive looks wrong (no fm-dx-webserver-main)."
    say "Copying new code in (settings and plugins are left alone)..."
    # copy everything EXCEPT your data; keep plugins, config and sessions.
    # Any core file we replace is first moved into the backup (replaced/), so a
    # file you customized is never silently overwritten - it stays recoverable.
    if command -v rsync >/dev/null 2>&1; then
        run_as rsync -a --backup --backup-dir="$BACKUP/replaced" \
            --exclude '.git' --exclude 'node_modules' \
            --exclude 'plugins' --exclude 'plugins_configs' \
            --exclude 'web/js/plugins' \
            --exclude 'config.json' --exclude '.session-secret' --exclude 'sessions.json' \
            "$SRC"/ "$DIR"/ || die "Copy failed."
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
                 # back up any existing file we are about to change (keeps customizations)
                 if [ -e "$DIR/$rel" ] && ! cmp -s "$SRC/$rel" "$DIR/$rel"; then
                     mkdir -p "$BACKUP/replaced/$(dirname -- "$rel")" 2>/dev/null
                     cp -a "$DIR/$rel" "$BACKUP/replaced/$rel" 2>/dev/null
                 fi
                 run_as cp -a "$SRC/$rel" "$DIR/$rel"
             done
    fi
    HOOK_NOTE=1   # core files refreshed, the plugin hook lines were reset
fi

# ---- 5) dependencies ------------------------------------------------------
say ""
say "Installing/updating dependencies (npm install)..."
if ! ( cd "$DIR" && run_as npm install ); then
    say "WARNING: npm install reported a problem. The code was still updated;"
    say "         try running 'npm install' yourself inside the folder."
fi

# ---- 6) done --------------------------------------------------------------
say ""
say "=============================================="
say "  Done. FM-DX Webserver is up to date."
say "  Your settings and plugins were kept."
say "  Backup: $BACKUP"
say "=============================================="
if [ "$HOOK_NOTE" = "1" ]; then
    say ""
    say "NOTE: the plugin hook lines in server/chat.js / server/index.js may"
    say "      have been reset. After starting FM-DX, open Setup and press"
    say "      the plugin's \"Fix it now\" button to re-add them."
fi
say ""
# restart the service: automatically if we stopped it, otherwise offer
if [ "$STOPPED_SERVICE" = "1" ]; then
    say "Starting the fm-dx-webserver service again..."
    if [ "$(id -u)" = "0" ]; then systemctl start fm-dx-webserver.service && say "Started."
    else sudo systemctl start fm-dx-webserver.service && say "Started."; fi
elif [ "$HAS_SERVICE" = "1" ]; then
    if ask "Restart the fm-dx-webserver service now?"; then
        if [ "$(id -u)" = "0" ]; then systemctl restart fm-dx-webserver.service && say "Restarted."
        else sudo systemctl restart fm-dx-webserver.service && say "Restarted."; fi
    else
        say "Start FM-DX Webserver again when you are ready."
    fi
else
    say "Now start FM-DX Webserver again."
fi

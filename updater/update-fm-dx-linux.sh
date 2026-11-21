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
case "$DIR" in
    */[Dd]ownloads/*|/tmp/*|*/[Tt]mp/*|/var/tmp/*)
        say ""
        say "WARNING: this folder is inside a Downloads or temp location. That is"
        say "usually a one-off extracted copy, NOT your real installed server, and"
        say "the system may clear temp folders on its own. Put FM-DX in a permanent"
        say "folder (e.g. /opt/fm-dx-webserver or your home dir) and run this there."
        ;;
esac
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
        if ! run_as git -C "$DIR" stash pop >/dev/null 2>&1; then
            # pop conflicted: reset to clean upstream so no merge markers remain
            run_as git -C "$DIR" reset --hard HEAD >/dev/null 2>&1 || true
            HOOK_NOTE=1
            say ""
            say "NOTE: your local edits to core files could not be re-applied on top"
            say "      of this update, so the code was reset to the clean latest version."
            say "      They are NOT lost - saved in the backup and in 'git stash'."
        fi
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
# npm_doctor: run `npm ci`, and if it fails apply ONLY safe, reversible fixes
# (retry transient network errors, verify/clean the cache, rebuild node_modules,
# fall back to `npm install`). node_modules is fully regenerable and the install
# was already backed up, so these cannot lose anything. Problems that need system
# changes or risky flags (build tools, permissions, disk, Node version) are NOT
# attempted - they are reported with a specific instruction. No --force / no
# --legacy-peer-deps (those can leave a silently broken install).
npm_doctor() {
    local log n
    log="$(mktemp 2>/dev/null || echo "$DIR/.npm-update.log")"
    _npm() { say "  > npm $*"; ( cd "$DIR" && run_as npm "$@" ) >"$log" 2>&1; local r=$?; tail -n 3 "$log" | sed 's/^/    | /'; return $r; }
    _has() { grep -qiE "$1" "$log"; }

    _npm ci && { rm -f "$log"; return 0; }

    # --- cannot be fixed safely from here: report a specific next step, change nothing ---
    if _has "gyp ERR|node-gyp|prebuild-install|make: \*\*\*|collect2|MSBUILD|Visual Studio|not found.*(make|python|gcc|g\+\+)"; then
        say ""; say "WARNING: a dependency needs build tools to compile, so npm could not finish."
        say "         The FM-DX code was still updated. On a Raspberry Pi / Debian, run:"
        say "             sudo apt-get install -y build-essential python3"
        say "         then run 'npm ci' inside $DIR. (full log: $log)"
        return 1
    fi
    if _has "EACCES|EPERM|permission denied|operation not permitted"; then
        say ""; say "WARNING: npm hit a permission error. The FM-DX code was still updated."
        say "         A file is owned by another user. Re-run the updater as '$OWNER', or:"
        say "             sudo chown -R $OWNER \"$DIR/node_modules\" && (cd \"$DIR\" && npm ci)"
        say "         (full log: $log)"
        return 1
    fi
    if _has "ENOSPC|no space left"; then
        say ""; say "WARNING: the disk is full, so npm could not finish. Free some space, then run"
        say "         'npm ci' inside $DIR. (full log: $log)"
        return 1
    fi
    if _has "EBADENGINE|Unsupported engine|requires Node|engine \"node\""; then
        say ""; say "WARNING: your Node.js is too old for FM-DX 1.4. Install a newer Node LTS, then run"
        say "         'npm ci' inside $DIR. (full log: $log)"
        return 1
    fi

    # --- safe automatic fixes ---
    if _has "ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|ENOTFOUND|socket hang up|network|429 Too Many"; then
        for n in 1 2; do say "  Network hiccup - waiting 5s and retrying ($n/2)..."; sleep 5; _npm ci && { rm -f "$log"; return 0; }; done
    fi
    if _has "EINTEGRITY|integrity check|sha512|sha1-|tarball data|corrupt|checksum"; then
        say "  A download looks corrupted - verifying the npm cache and retrying..."
        ( cd "$DIR" && run_as npm cache verify ) >>"$log" 2>&1 || true
        _npm ci && { rm -f "$log"; return 0; }
        say "  Still bad - cleaning the npm cache and retrying..."
        ( cd "$DIR" && run_as npm cache clean --force ) >>"$log" 2>&1 || true
        _npm ci && { rm -f "$log"; return 0; }
    fi
    # Last resort (covers a lockfile out of sync and a half-written node_modules):
    # rebuild dependencies from scratch. node_modules is regenerable; your code/config are untouched.
    say "  Rebuilding dependencies from scratch (removing node_modules - it is fully regenerable)..."
    ( cd "$DIR" && run_as rm -rf node_modules ) >>"$log" 2>&1 || true
    _npm install --no-audit --no-fund && { rm -f "$log"; return 0; }

    say ""; say "WARNING: npm could not finish even after the safe retries. The FM-DX code was still"
    say "         updated. The last npm messages are above; run 'npm ci' inside $DIR to see the"
    say "         full error. (full log: $log)"
    return 1
}

say ""
say "Installing/updating dependencies (npm ci)..."
say "  If it seems to pause for a while, that is normal - npm is writing the"
say "  packages to disk. It is not frozen; give it a minute."
npm_doctor || true

# ---- 5b) ffmpeg check/repair (npm ci re-downloads ffmpeg each run) --------
# ffmpeg-static fetches its ffmpeg binary in an install script; npm ci wipes
# node_modules so it must re-run. Some npm setups block install scripts, so we
# run the installer directly (node) rather than via npm rebuild, which obeys it.
FFFAIL=0
FFBIN="$DIR/node_modules/ffmpeg-static/ffmpeg"
FFINST="$DIR/node_modules/ffmpeg-static/install.js"
if [ ! -s "$FFBIN" ]; then
    say ""
    say "ffmpeg is missing (npm ci re-downloads it each run). Repairing..."
    [ -f "$FFINST" ] && ( cd "$DIR" && run_as node "$FFINST" ) || true
    if [ ! -s "$FFBIN" ]; then
        say "Retrying the ffmpeg download..."
        [ -f "$FFINST" ] && ( cd "$DIR" && run_as node "$FFINST" ) || true
    fi
    if [ ! -s "$FFBIN" ]; then
        FFFAIL=1
        say ""
        say "WARNING: could not download ffmpeg automatically. Audio will NOT start"
        say "         until this is fixed. Check the server's internet access, then run"
        say "         'node node_modules/ffmpeg-static/install.js' inside $DIR."
    else
        say "ffmpeg is in place."
    fi
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
# health_check: `systemctl start` returning 0 only means the unit launched - a node
# app can start and then crash. Confirm it is still up a few seconds later, and (if
# curl is present) that it answers on its port. On failure it warns and points to the
# logs and the backup; it does NOT roll back by itself.
health_check() {
    local port code n
    sleep 6
    if ! systemctl is-active --quiet fm-dx-webserver.service; then
        say ""
        say "WARNING: FM-DX started but did not stay up (it stopped within a few seconds)."
        say "         Your previous version is backed up in:"
        say "             $BACKUP"
        say "         See what went wrong with:"
        say "             journalctl -u fm-dx-webserver.service -n 50 --no-pager"
        return 1
    fi
    port="$(grep -oE '"port"[[:space:]]*:[[:space:]]*[0-9]+' "$DIR/config.json" 2>/dev/null | grep -oE '[0-9]+$' | head -1)"
    [ -n "$port" ] || port=8080
    if command -v curl >/dev/null 2>&1; then
        for n in 1 2 3 4 5; do
            code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null || true)"
            [ "$code" = "200" ] && { say "FM-DX is up and answering on port $port."; return 0; }
            sleep 2
        done
        say ""
        say "NOTE: FM-DX is running, but it did not answer on http://127.0.0.1:$port within ~15s."
        say "      It may still be starting, or the port in config.json differs. If the page does"
        say "      not load, check:  journalctl -u fm-dx-webserver.service -n 50 --no-pager"
        return 0
    fi
    say "FM-DX is running."
    return 0
}

# restart the service: automatically if we stopped it, otherwise offer
if [ "$FFFAIL" = "1" ]; then
    say "NOT starting FM-DX: ffmpeg is still missing (see the warning above)."
    say "Fix ffmpeg, then start it yourself: sudo systemctl start fm-dx-webserver.service"
elif [ "$STOPPED_SERVICE" = "1" ]; then
    say "Starting the fm-dx-webserver service again..."
    if [ "$(id -u)" = "0" ]; then systemctl start fm-dx-webserver.service && say "Started."
    else sudo systemctl start fm-dx-webserver.service && say "Started."; fi
    health_check || true
elif [ "$HAS_SERVICE" = "1" ]; then
    if ask "Restart the fm-dx-webserver service now?"; then
        if [ "$(id -u)" = "0" ]; then systemctl restart fm-dx-webserver.service && say "Restarted."
        else sudo systemctl restart fm-dx-webserver.service && say "Restarted."; fi
        health_check || true
    else
        say "Start FM-DX Webserver again when you are ready."
    fi
else
    say "Now start FM-DX Webserver again."
fi

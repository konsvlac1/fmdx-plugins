# FM-DX Webserver updaters

*(Στα Ελληνικά: [README.el.md](README.el.md))*

Update **FM-DX Webserver** to the latest version with **one command**. It keeps all your settings and plugins, and does everything else for you:

> stops the server → backs up your settings and plugins → finds the folder → updates to the latest version → `npm ci` → starts the server again.

You only press **Y** once to confirm the folder. If anything is not right, it stops and changes nothing.

---

## Windows

Press the **Windows key**, type **cmd**, press **Enter**, and paste this **one line**:

```
curl -Ls -o "%TEMP%\fmdx-update.bat" https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-windows.bat && "%TEMP%\fmdx-update.bat"
```

That is it. (If it can't find your folder, run `set FMDX_DIR=C:\path\to\fm-dx-webserver` first, then paste the line again.)

## Linux / Raspberry Pi

Paste this **one line** in a terminal:

```
curl -Ls https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-linux.sh | bash
```

For a specific folder, or to skip all questions, add arguments:

```
curl -Ls https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-linux.sh | bash -s -- -y /home/pi/fm-dx-webserver
```

---

### What it keeps

`config.json`, all plugins, plugin settings, logins and the session secret — these are git-ignored by FM-DX, so updating never touches them. A timestamped backup folder is made too, just in case.

**Your own edits are protected.** If you changed any core files yourself (a theme, a tweak, the plugin hook lines), the updater detects them and sets a copy aside in the backup — under `custom/` (files you changed, git installs) or `replaced/` (any core file replaced during a ZIP update) — so an update can never silently overwrite something you customized.

If a run ever says the plugin hook lines were reset, open **Setup** in FM-DX and press **🔧 Fix it now** in each plugin.

### If npm has a problem

If `npm ci` fails, the updater tries to fix it **safely and automatically** before giving up:

- a **network hiccup** → it waits and retries;
- a **corrupted download** → it checks/cleans the npm cache and retries;
- an **out-of-sync lock file or a half-finished `node_modules`** → it rebuilds the dependencies from scratch (your code and settings are untouched — `node_modules` is simply re-downloaded).

For problems it should **not** touch on its own, it changes nothing and tells you exactly what to do: missing **build tools**, a **permission** problem, a **full disk**, or a **too-old Node.js**. It never forces an install (no `--force`), so it can't leave you with a half-broken one.

# FM-DX Webserver updaters

*(Στα Ελληνικά: [README.el.md](README.el.md))*

One-click updaters that bring **FM-DX Webserver itself** up to the latest version **without losing your settings or plugins**.

Both scripts:
- find the `fm-dx-webserver` folder automatically (or you can give the path),
- make a **backup** of your settings and plugins first,
- update to the latest version and run `npm install`,
- **abort without changing anything** if something is not right.

They keep `config.json`, all plugins, plugin settings, logins and the session secret (these are git-ignored by FM-DX, so a `git pull` never touches them). The scripts also keep the plugin hook lines in `server/chat.js` / `server/index.js`; if those ever get reset, open **Setup** and press **🔧 Fix it now** in each plugin.

---

## Windows — step by step

Uses [`update-fm-dx-windows.bat`](update-fm-dx-windows.bat).

1. **Stop FM-DX Webserver** — close its window (the black console), so no files are locked.
2. **Download the updater.** Press the **Windows key**, type **cmd**, press **Enter**, and paste this line:
   ```
   curl -L -o "%USERPROFILE%\Downloads\update-fm-dx-windows.bat" https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-windows.bat
   ```
   (This saves it in your **Downloads** folder. You can also download it from the GitHub page instead.)
3. **Run it.** Open **Downloads** and **double-click** `update-fm-dx-windows.bat`.
   *(Tip: run it from the `cmd` window with `"%USERPROFILE%\Downloads\update-fm-dx-windows.bat"` so you can read every message.)*
4. **Confirm the folder.** It shows the `fm-dx-webserver` folder it found and asks `Update THIS folder? [Y/N]`. Press **Y** and **Enter**.
   *(If it can't find the folder, close it and run first: `set FMDX_DIR=C:\path\to\fm-dx-webserver`, then run the `.bat` again.)*
5. **Wait.** It makes a backup, downloads the latest version and runs `npm install`. When it says **Done.**, close the window.
6. **Start FM-DX Webserver again.**

---

## Linux / Raspberry Pi — step by step

Uses [`update-fm-dx-linux.sh`](update-fm-dx-linux.sh).

1. **Stop FM-DX Webserver** so files are not in use:
   ```
   sudo systemctl stop fm-dx-webserver     # or close the window / press Ctrl+C where it runs
   ```
2. **Download the updater:**
   ```
   curl -LO https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-linux.sh
   ```
3. **Make it runnable:**
   ```
   chmod +x update-fm-dx-linux.sh
   ```
4. **Run it:**
   ```
   ./update-fm-dx-linux.sh
   ```
   *(If it can't find the folder, give it: `./update-fm-dx-linux.sh /home/pi/fm-dx-webserver`. For no questions at all, add `-y`.)*
5. **Confirm.** It shows the `fm-dx-webserver` folder it found and asks to update it — answer **y**. It then backs up your settings/plugins, updates to the latest version and runs `npm install`.
6. **Start FM-DX again.** If a `fm-dx-webserver` systemd service exists, the script offers to restart it for you; otherwise start it the way you normally do.

---

If a run ever says the plugin hook lines were reset, just open **Setup** in FM-DX and press **🔧 Fix it now** in each plugin, then restart.

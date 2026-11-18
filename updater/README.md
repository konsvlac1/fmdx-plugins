# FM-DX Webserver updaters

One-click updaters that bring **FM-DX Webserver itself** up to the latest version **without losing your settings or plugins**.

Both scripts:
- find the `fm-dx-webserver` folder automatically (or you can give the path),
- make a **backup** of your settings and plugins first,
- update to the latest version and run `npm install`,
- **abort without changing anything** if something is not right.

They keep `config.json`, all plugins, plugin settings, logins and the session secret (these are git-ignored by FM-DX, so a `git pull` never touches them). The scripts also keep the plugin hook lines in `server/chat.js` / `server/index.js`; if those ever get reset, open **Setup** and press **🔧 Fix it now** in each plugin.

## Windows — [`update-fm-dx-windows.bat`](update-fm-dx-windows.bat)

1. Download it, or copy it into your `fm-dx-webserver` folder.
2. **Close** the FM-DX Webserver window (stop the server).
3. **Double-click** the file.
4. Start FM-DX Webserver again.

Download in a `cmd` window:
```
curl -L -o "%USERPROFILE%\Downloads\update-fm-dx-windows.bat" https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-windows.bat
```

## Linux / Raspberry Pi — [`update-fm-dx-linux.sh`](update-fm-dx-linux.sh)

```
# stop FM-DX first, then:
curl -LO https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-linux.sh
chmod +x update-fm-dx-linux.sh
./update-fm-dx-linux.sh
```

You can also give the folder by hand (`./update-fm-dx-linux.sh /home/pi/fm-dx-webserver`), set it with `FMDX_DIR=...`, or run unattended with `-y`. If a `fm-dx-webserver` systemd service exists, it offers to restart it for you.

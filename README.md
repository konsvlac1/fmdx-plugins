# konvlachos plugins for FM-DX Webserver

*by konvlachos*

Three free plugins that help you run a public FM-DX tuner:

| Plugin | What it does for you |
|---|---|
| 📒 **Station Log** | Writes down every station your tuner receives, automatically: frequency, PI, station name, place, best signal, first and last heard. You get a list of "what can be received here", with search and Excel download. You can also show the list to your listeners. |
| 📊 **Listener Insights** | Shows how your server is used: visitors per day, busiest hours and days, most listened stations, countries and how long people stay. Optional weekly summary in Telegram. No IP addresses are stored. |
| 🎧 **Fair Tuner Sharing** | When several listeners are connected, the one who tunes gets a short turn (2 minutes after the last tune, at most 10 minutes). The others see a friendly countdown instead of the frequency jumping around. You (the admin) can always tune. |

Each plugin gets its own tab in the **Setup** page (admin panel).

---

## Install

You need **FM-DX Webserver 1.4** and about 5 minutes.

### Raspberry Pi / Linux
Open a terminal and paste (change `/home/pi/fm-dx-webserver` to your FM-DX folder):
```
cd ~
wget -O konvlachos-plugins.zip https://github.com/konsvlac1/fmdx-plugins/archive/refs/heads/main.zip && unzip -o konvlachos-plugins.zip
sudo node fmdx-plugins-main/install.js /home/pi/fm-dx-webserver
```

### Windows
1. Download https://github.com/konsvlac1/fmdx-plugins/archive/refs/heads/main.zip
2. Right-click the ZIP in **Downloads** → **Extract All…** → **Extract**.
3. Press the **Windows key**, type **cmd**, press **Enter**, and type (change `C:\fm-dx-webserver` to your FM-DX folder):
```
node "%USERPROFILE%\Downloads\fmdx-plugins-main\fmdx-plugins-main\install.js" "C:\fm-dx-webserver"
```

### Then (all systems)
1. Open your FM-DX page, log in as **admin**, open **Setup → Plugins**.
2. Tick **Station Log**, **Listener Insights** and **Fair Tuner Sharing**, press **Save**.
3. **Restart** FM-DX Webserver.
4. In **Setup** you now have the tabs **Station Log**, **Listener Insights** and **Fair Tuner Sharing**.

You can also install only some: add their names at the end of the install line,
for example `… install.js /home/pi/fm-dx-webserver StationLog ListenerInsights`.

To remove them: run the same install line with ` --uninstall` at the end, then restart FM-DX.

---

## Questions

**Do the plugins slow down my server?**
No. Station Log looks at the tuner once a second, Listener Insights every 10 seconds. Both only save a small file every 30–60 seconds.

**What does Fair Tuner Sharing change in FM-DX?**
FM-DX plugins cannot hold back tune commands by themselves, so the installer adds one line to `server/index.js`
(with a backup). With only one listener connected, nothing changes at all.

**Where is the data?**
In the folder `plugins_configs` of your FM-DX folder: `stationlog.json`, `insights.json`, `fairshare.json`.

**Telegram summary?**
Put a file `.fmdx-telegram` in the home folder of the user that runs FM-DX:
```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```
Listener Insights then sends a short summary every Monday at 09:00.

---

## License

MIT, see [LICENSE](LICENSE).

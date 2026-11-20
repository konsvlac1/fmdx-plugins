# konvlachos plugins for FM-DX Webserver

*by konvlachos*

🇬🇷 [Οδηγίες στα ελληνικά](README.el.md)

Six free plugins that help you run a public FM-DX tuner:

| Plugin | What it does for you |
|---|---|
| 📒 **Station Log** | Writes down every station your tuner receives, automatically: frequency, PI, station name, place, best signal, first and last heard. You get a list of "what can be received here", with search and Excel download. You can also show the list to your listeners. |
| 📊 **Listener Insights** | Shows how your server is used: visitors per day, busiest hours and days, most listened stations, countries and how long people stay. Optional weekly summary in Telegram. No IP addresses are stored. |
| 🎧 **Fair Tuner Sharing** | When several listeners are connected, the one who tunes gets a short turn (2 minutes after the last tune, at most 10 minutes). The others see a friendly countdown instead of the frequency jumping around. You (the admin) can always tune. In its Setup tab you choose the turn length, the longest turn and from how many listeners sharing starts: quick buttons or any number you like (up to 1000 listeners). |
| 🛡️ **Chat Filter** | Checks every chat message **before anyone sees it**. Messages with bad words (Greek, Greeklish and English) are not sent, and only the sender sees a short note; their text goes back into the chat box so they can fix it. It also stops **spam links** (links to your own site and to sites you allow, like fmdx.org, are fine), the same message sent again and again, and mutes a sender for a while after a few blocked messages. It knows hundreds of words and phrases (curses like "go to hell" in Greek and English, in any spelling) and leaves normal words alone. In its Setup tab you add your own words or phrases (and remove them again) with one click; the built-in bad words always stay. You can also choose "send it with \*\*\* instead", test a message, and see and mute senders. Bad words are stopped for admins too (can be switched off); links, repeats and mutes never apply to admins. |
| 🛰️ **Antenna Advisor** | For tuners with **two or more antennas**: compares them on the frequency you are tuned to and tells you which one receives best (signal, RDS, stereo). It briefly switches each antenna, measures, then puts yours back. Only you (the admin) start a comparison; listeners simply see the recommended antenna. On a single‑antenna tuner it stays hidden. |
| 📻 **DX Watch** | Watches your receiver's **own live decodes** and alerts you when a station you care about is received — a **PI code**, a **frequency**, or **any new station** you have never heard. Alerts show on the page and can go to **Discord** and **Telegram**, with a cooldown so the same catch isn't repeated. Read‑only: it never changes the tuner. |

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
2. Tick **Station Log**, **Listener Insights**, **Fair Tuner Sharing**, **Chat Filter**, **Antenna Advisor** and **DX Watch**, press **Save**.
3. **Restart** FM-DX Webserver.
4. In **Setup** you now have the tabs **Station Log**, **Listener Insights**, **Fair Tuner Sharing**, **Chat Filter**, **Antenna Advisor** and **DX Watch**. (Antenna Advisor shows only on tuners with two or more antennas.)

### Only one plugin

Do the same steps as above, but write the plugin's **name** at the **end** of the install line.
Pick the name from this table:

| Plugin | Name to write |
|---|---|
| 📒 Station Log | `StationLog` |
| 📊 Listener Insights | `ListenerInsights` |
| 🎧 Fair Tuner Sharing | `FairShare` |
| 🛡️ Chat Filter | `ChatFilter` |
| 🛰️ Antenna Advisor | `AntennaAdvisor` |
| 📻 DX Watch | `DXWatch` |

Example with Chat Filter (write another name from the table instead, if you want another plugin):

**Windows** (in the black `cmd` window):
```
node "%USERPROFILE%\Downloads\fmdx-plugins-main\fmdx-plugins-main\install.js" "C:\fm-dx-webserver" ChatFilter
```

**Raspberry Pi / Linux:**
```
sudo node fmdx-plugins-main/install.js /home/pi/fm-dx-webserver ChatFilter
```

Then in **Setup → Plugins** tick only that plugin, press **Save**, and restart FM-DX.
For two or more plugins, write their names with a space between them (e.g. `StationLog ChatFilter`).

*Scan Guard is a separate download: see [fmdx-scan-guard](https://github.com/konsvlac1/fmdx-scan-guard).*

To remove them: run the same install line with ` --uninstall` at the end, then restart FM-DX.

### Updating FM-DX (Linux or Windows)

Update FM-DX Webserver to the latest version with **one command** — it stops the server, backs up your settings and plugins, updates, runs `npm install` and starts the server again, **without losing your settings or plugins**. You only press **Y** once to confirm the folder. Full details: [`updater/`](updater/).

**Windows** — in a `cmd` window:
```
curl -Ls -o "%TEMP%\fmdx-update.bat" https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-windows.bat && "%TEMP%\fmdx-update.bat"
```

**Linux / Raspberry Pi** — in a terminal:
```
curl -Ls https://raw.githubusercontent.com/konsvlac1/fmdx-plugins/main/updater/update-fm-dx-linux.sh | bash
```

It keeps `config.json`, all plugins, plugin settings and logins. If it says the plugin hook lines were reset, open **Setup** and press **🔧 Fix it now** in each plugin.

---

## Questions

**Do the plugins slow down my server?**
No. Station Log and DX Watch look at the tuner once a second, Listener Insights every 10 seconds, and Chat Filter only works when someone sends a chat message. Antenna Advisor does nothing until you press its button. They only save a small file now and then.

**What does Antenna Advisor change in FM-DX?**
Nothing permanent. When you press **Compare now** it switches the antenna for a few seconds to measure each one, then puts your antenna back. It needs no extra line in FM-DX. It appears only on tuners with two or more antennas, and only an admin can start a comparison (it briefly flickers everyone's audio while it switches).

**How do I get DX Watch alerts in Discord or Telegram?**
In the DX Watch Setup tab, paste a Discord **webhook URL** (in Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL). For Telegram it uses the same `.fmdx-telegram` file as Listener Insights, or you can type a bot token and chat id in the tab. Press **Send a test alert** to check. Add targets (a PI code, a frequency, or "any new station") in the same tab.

**What does Fair Tuner Sharing change in FM-DX?**
FM-DX plugins cannot hold back tune commands by themselves, so the installer adds one line to `server/index.js`
(with a backup). With only one listener connected, nothing changes at all.

**What does Chat Filter change in FM-DX?**
The same idea: the installer adds one line to `server/chat.js` (backup: `server/chat.js.before-chat-filter`),
so messages are checked on the server and nobody can get around the filter.

**A tab says "One more step is needed"?** (Chat Filter or Fair Tuner Sharing)
The plugin was copied into the `plugins` folder by hand, so the line it needs in FM-DX itself is missing.
Press **🔧 Fix it now** in that note, then restart FM-DX. (Running the install line does the same.)
Station Log and Listener Insights need no extra step: copying them is enough.

**Will Chat Filter block normal words by mistake?**
It matches whole words, so words like *γάμος*, *μαλακό*, *cocktail* or *class* pass. Use **Try a message**
in its Setup tab to check, and add or remove your own words there.

**Where is the data?**
In the folder `plugins_configs` of your FM-DX folder: `stationlog.json`, `insights.json`, `fairshare.json`, `chatfilter.json` (+ `chatfilter-log.json`, the stopped messages), `antennaadvisor.json` and `dxwatch.json`.

**Telegram summary?**
Put a file `.fmdx-telegram` in the home folder of the user that runs FM-DX:
```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```
Listener Insights then sends a short summary every Monday at 09:00.

---

## Credits

Chat Filter's English list includes the [List of Dirty, Naughty, Obscene and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (Shutterstock, CC BY 4.0), without its everyday words.

## License

MIT, see [LICENSE](LICENSE).

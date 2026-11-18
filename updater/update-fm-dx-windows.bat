@echo off
rem ===========================================================================
rem  FM-DX Webserver - one-click updater for Windows
rem  by Konstantinos Vlachos
rem
rem  Updates FM-DX Webserver to the latest version while KEEPING your
rem  settings (config.json), all your plugins, plugin settings, logins and
rem  session secret. Nothing of yours is overwritten.
rem
rem  How to use:
rem    - Easiest: put this file inside your fm-dx-webserver folder and
rem      double-click it. It updates that folder.
rem    - Or just double-click it anywhere: it will look for your
rem      fm-dx-webserver folder automatically (Desktop, Downloads,
rem      Documents, your user folder, C:\). You can also set the folder by
rem      hand:  set FMDX_DIR=C:\path\to\fm-dx-webserver  before running.
rem
rem  Needs: Node.js (npm). Git is used if the folder is a git clone; if not,
rem  the latest code is downloaded as a ZIP instead.
rem ===========================================================================

title FM-DX Webserver updater
color 0b
setlocal

set "UPSTREAM=https://github.com/NoobishSVK/fm-dx-webserver"
set "DIR="

echo.
echo  ==============================================
echo    FM-DX Webserver - update to latest version
echo  ==============================================
echo.

rem ---- 1) find the fm-dx-webserver folder ----------------------------------
rem (a) a folder you set by hand wins; if it is set but wrong, we abort
if defined FMDX_DIR (
    call :isfmdx "%FMDX_DIR%"
    if not defined DIR (
        echo.
        echo  FMDX_DIR is set to "%FMDX_DIR%" but that is not an FM-DX Webserver folder.
        goto :fail
    )
)
rem (b) this script's own folder
if not defined DIR if exist "%~dp0package.json" call :isfmdx "%~dp0"
rem (c) the usual places
if not defined DIR call :isfmdx "%USERPROFILE%\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Desktop\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Downloads\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Documents\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\OneDrive\Desktop\fm-dx-webserver"
if not defined DIR call :isfmdx "C:\fm-dx-webserver"
if not defined DIR call :isfmdx "%PUBLIC%\fm-dx-webserver"

rem (d) last resort: search your user folder (a bit slower)
if not defined DIR (
    echo  Looking for your fm-dx-webserver folder, please wait...
    for /f "delims=" %%p in ('powershell -NoProfile -Command "Get-ChildItem -Path $env:USERPROFILE -Recurse -Depth 5 -Filter package.json -Force -ErrorAction SilentlyContinue | Where-Object { Select-String -Path $_.FullName -Pattern 'fm-dx-webserver' -SimpleMatch -Quiet } | Select-Object -First 1 -ExpandProperty DirectoryName"') do set "DIR=%%p"
)

if not defined DIR (
    echo.
    echo  Could not find your fm-dx-webserver folder automatically.
    echo  Put this file inside that folder and run it again, or set it by hand:
    echo       set FMDX_DIR=C:\path\to\fm-dx-webserver
    echo  then run this file again.
    goto :fail
)

rem strip a trailing backslash
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

echo  Found FM-DX Webserver at:
echo       %DIR%
echo.
set "ANS=Y"
set /p "ANS=  Update THIS folder? [Y/N] (default Y): "
if /i not "%ANS%"=="Y" goto :cancel

rem ---- 2) checks ------------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js / npm was not found. Install Node.js first, then run this again.
    goto :fail
)

rem ---- stop FM-DX automatically so its files are not locked -----------------
echo.
echo  Stopping FM-DX Webserver if it is running...
powershell -NoProfile -Command "$d=('%DIR%').ToLower(); Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($d) } | ForEach-Object { Write-Host ('  stopped FM-DX (node PID ' + $_.ProcessId + ')'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1

rem ---- 3) back up your settings and plugins (safety net) --------------------
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "BACKUP=%DIR%-backup-%STAMP%"
echo.
echo  Backing up your settings and plugins to:
echo       %BACKUP%
robocopy "%DIR%" "%BACKUP%" config.json .session-secret sessions.json /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\plugins"         robocopy "%DIR%\plugins"         "%BACKUP%\plugins"         /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\plugins_configs" robocopy "%DIR%\plugins_configs" "%BACKUP%\plugins_configs" /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\web\js\plugins"  robocopy "%DIR%\web\js\plugins"  "%BACKUP%\web\js\plugins"  /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul

rem ---- 4) update the code ---------------------------------------------------
if exist "%DIR%\.git" goto :gitupdate
goto :zipupdate

:gitupdate
echo.
echo  Updating (git)...
where git >nul 2>&1
if errorlevel 1 (
    echo  This is a git clone but git is not installed. Install Git for Windows,
    echo  or delete the .git folder to let this script use the ZIP method.
    goto :fail
)
git config --global --add safe.directory "%DIR%" >nul 2>&1
rem keep a copy of every file YOU changed (your customizations) in the backup
echo  Keeping a copy of your own changed files...
powershell -NoProfile -Command "$d='%DIR%'; $b='%BACKUP%\custom'; Set-Location -LiteralPath $d; @(git diff --name-only HEAD) + @(git ls-files --others --exclude-standard) | Where-Object { $_ } | Sort-Object -Unique | ForEach-Object { $s=Join-Path $d $_; if (Test-Path -LiteralPath $s) { $t=Join-Path $b $_; New-Item -ItemType Directory -Force -Path (Split-Path -Parent $t) | Out-Null; Copy-Item -LiteralPath $s -Destination $t -Force } }" 2>nul
rem keep the plugin hook lines you added to server\chat.js / server\index.js
set "STASHED=0"
git -C "%DIR%" stash >"%TEMP%\fmdx_stash.txt" 2>&1
findstr /c:"No local changes" "%TEMP%\fmdx_stash.txt" >nul 2>&1 || set "STASHED=1"
git -C "%DIR%" pull
if errorlevel 1 (
    if "%STASHED%"=="1" git -C "%DIR%" stash pop >nul 2>&1
    echo  git pull failed. Your folder is untouched; nothing was lost.
    goto :fail
)
if "%STASHED%"=="1" (
    git -C "%DIR%" stash pop
    if errorlevel 1 (
        echo.
        echo  NOTE: your plugin hook lines did not re-apply cleanly after the
        echo        update. After starting FM-DX, open Setup and click
        echo        "Fix it now" in each affected plugin to re-add them.
    )
)
goto :npminstall

:zipupdate
echo.
echo  This is not a git clone - downloading the latest code as a ZIP...
set "ZIP=%TEMP%\fmdx-latest.zip"
set "EXD=%TEMP%\fmdx-latest"
if exist "%EXD%" rmdir /s /q "%EXD%" >nul 2>&1
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%UPSTREAM%/archive/refs/heads/main.zip' -OutFile '%ZIP%' } catch { exit 1 }"
if errorlevel 1 (
    echo  Download failed. Check your internet connection and try again.
    goto :fail
)
powershell -NoProfile -Command "try { Expand-Archive -Path '%ZIP%' -DestinationPath '%EXD%' -Force } catch { exit 1 }"
if errorlevel 1 (
    echo  Could not unzip the download.
    goto :fail
)
rem keep a copy of the current core files first, so nothing custom is lost
echo  Keeping a copy of the current core files (so nothing custom is lost)...
robocopy "%DIR%" "%BACKUP%\replaced" /E /R:1 /W:1 /XD node_modules .git plugins plugins_configs "%DIR%\web\js\plugins" /NJH /NJS /NFL /NDL >nul
echo  Copying new code in (your settings and plugins are left alone)...
rem /XD skips any folder named plugins (covers plugins\ AND web\js\plugins),
rem node_modules, plugins_configs and .git. /XF keeps your config and sessions.
robocopy "%EXD%\fm-dx-webserver-main" "%DIR%" /E /R:1 /W:1 ^
    /XD plugins node_modules plugins_configs .git ^
    /XF config.json .session-secret sessions.json ^
    /NJH /NJS /NFL /NDL >nul
echo.
echo  NOTE (ZIP update): core files were refreshed, so the plugin hook lines
echo        in server\chat.js / server\index.js were reset. After starting
echo        FM-DX, open Setup and click "Fix it now" in each affected plugin.
goto :npminstall

:npminstall
echo.
echo  Installing/updating dependencies (npm ci)...
pushd "%DIR%"
call npm ci
set "NPMERR=%errorlevel%"
popd
if not "%NPMERR%"=="0" (
    echo  npm ci reported a problem. The code was still updated; try
    echo  running  npm ci  yourself inside the folder.
)

rem ---- ffmpeg check/repair (npm ci re-downloads ffmpeg every run) ----------
rem  npm ci wipes node_modules, so ffmpeg-static must re-fetch ffmpeg.exe.
rem  If that download is blocked or antivirus removes it, repair it here.
set "FFBIN=%DIR%\node_modules\ffmpeg-static\ffmpeg.exe"
if exist "%FFBIN%" goto :ffmpegok
echo.
echo  ffmpeg is missing (npm ci re-downloads it each run). Repairing...
rem best effort: keep antivirus from deleting ffmpeg.exe (needs admin; ignored otherwise)
powershell -NoProfile -Command "try { Add-MpPreference -ExclusionPath '%DIR%' -ErrorAction Stop; Write-Host '  added a Windows Defender exclusion for the folder' } catch {}" >nul 2>&1
pushd "%DIR%"
call npm rebuild ffmpeg-static
popd
if exist "%FFBIN%" goto :ffmpegok
echo  Retrying the ffmpeg download...
pushd "%DIR%"
call npm rebuild ffmpeg-static
popd
if exist "%FFBIN%" goto :ffmpegok
echo.
echo  Could not download ffmpeg automatically. Audio will NOT start until fixed.
echo  Most likely your antivirus removed ffmpeg.exe, or the download was blocked.
echo    1) Check your antivirus quarantine and allow this folder:
echo         %DIR%
echo    2) Then run:  npm rebuild ffmpeg-static
echo.
set "FFFAIL=1"
goto :done
:ffmpegok
echo  ffmpeg is in place.

:done
echo.
echo  ==============================================
echo    Done. FM-DX Webserver is up to date.
echo    Your settings and plugins were kept.
echo    A backup is here if you need it:
echo       %BACKUP%
echo  ==============================================
echo.
if "%FFFAIL%"=="1" (
    echo  WARNING: ffmpeg is still missing, so FM-DX audio will not start.
    echo           Fix that first, then start the server.
    echo.
    set "ANS=N"
) else (
    set "ANS=Y"
)
set /p "ANS=  Start FM-DX Webserver now? [Y/N] (default %ANS%): "
if /i "%ANS%"=="Y" (
    echo  Starting FM-DX Webserver in a new window...
    pushd "%DIR%"
    start "FM-DX Webserver" cmd /k npm run webserver
    popd
) else (
    echo  Start FM-DX Webserver yourself when you are ready.
)
echo.
pause
endlocal
exit /b 0

:cancel
echo  Cancelled. Nothing was changed.
pause
endlocal
exit /b 0

:fail
echo.
echo  Stopped. Nothing of yours was deleted.
pause
endlocal
exit /b 1

rem --- subroutine: set DIR if %1 is a real fm-dx-webserver folder ------------
:isfmdx
if defined DIR goto :eof
if not exist "%~1\package.json" goto :eof
findstr /i /c:"fm-dx-webserver" "%~1\package.json" >nul 2>&1 && set "DIR=%~1"
goto :eof

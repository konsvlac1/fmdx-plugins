@echo off
chcp 65001 >nul
rem ===========================================================================
rem  FM-DX Webserver - εργαλείο ενημέρωσης με ένα κλικ για Windows
rem  του Konstantinos Vlachos
rem
rem  Ενημερώνει το FM-DX Webserver στην τελευταία έκδοση ΚΡΑΤΩΝΤΑΣ τις
rem  ρυθμίσεις σας (config.json), όλα τα πρόσθετα, τις ρυθμίσεις τους, τις
rem  συνδέσεις και το session secret. Τίποτα δικό σας δεν σβήνεται.
rem
rem  Πώς χρησιμοποιείται:
rem    - Πιο εύκολο: βάλτε το αρχείο μέσα στον φάκελο fm-dx-webserver και
rem      κάντε διπλό κλικ. Ενημερώνει αυτόν τον φάκελο.
rem    - Ή απλώς διπλό κλικ οπουδήποτε: ψάχνει μόνο του τον φάκελο
rem      fm-dx-webserver (Desktop, Downloads, Documents, φάκελος χρήστη, C:\).
rem      Μπορείτε και με το χέρι:  set FMDX_DIR=C:\path\to\fm-dx-webserver
rem
rem  Χρειάζεται: Node.js (npm). Git αν ο φάκελος είναι git clone· αλλιώς ο
rem  νέος κώδικας κατεβαίνει ως ZIP.
rem ===========================================================================

title FM-DX Webserver updater
color 0b
setlocal

set "UPSTREAM=https://github.com/NoobishSVK/fm-dx-webserver"
set "DIR="

echo.
echo  ==============================================
echo    FM-DX Webserver - ενημέρωση στην τελευταία έκδοση
echo  ==============================================
echo.

rem ---- 1) βρες τον φάκελο fm-dx-webserver -----------------------------------
rem (a) φάκελος που ορίσατε με το χέρι έχει προτεραιότητα· αν είναι λάθος, σταματάμε
if defined FMDX_DIR (
    call :isfmdx "%FMDX_DIR%"
    if not defined DIR (
        echo.
        echo  Το FMDX_DIR είναι "%FMDX_DIR%" αλλά δεν είναι φάκελος FM-DX Webserver.
        goto :fail
    )
)
rem (b) ο φάκελος αυτού του αρχείου
if not defined DIR if exist "%~dp0package.json" call :isfmdx "%~dp0"
rem (c) οι συνηθισμένοι φάκελοι
if not defined DIR call :isfmdx "%USERPROFILE%\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Desktop\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Downloads\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Documents\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\OneDrive\Desktop\fm-dx-webserver"
if not defined DIR call :isfmdx "C:\fm-dx-webserver"
if not defined DIR call :isfmdx "%PUBLIC%\fm-dx-webserver"

rem (d) τελευταία λύση: ψάξε στον φάκελο χρήστη (λίγο πιο αργό)
if not defined DIR (
    echo  Ψάχνω τον φάκελο fm-dx-webserver, περιμένετε...
    for /f "delims=" %%p in ('powershell -NoProfile -Command "Get-ChildItem -Path $env:USERPROFILE -Recurse -Depth 5 -Filter package.json -Force -ErrorAction SilentlyContinue | Where-Object { Select-String -Path $_.FullName -Pattern 'fm-dx-webserver' -SimpleMatch -Quiet } | Select-Object -First 1 -ExpandProperty DirectoryName"') do set "DIR=%%p"
)

if not defined DIR (
    echo.
    echo  Δεν βρέθηκε αυτόματα ο φάκελος fm-dx-webserver.
    echo  Βάλτε αυτό το αρχείο μέσα στον φάκελο και ξανατρέξτε το, ή ορίστε τον με το χέρι:
    echo       set FMDX_DIR=C:\path\to\fm-dx-webserver
    echo  και μετά ξανατρέξτε αυτό το αρχείο.
    goto :fail
)

rem αφαίρεσε τυχόν backslash στο τέλος
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

echo  Βρέθηκε το FM-DX Webserver στο:
echo       %DIR%
echo.
set "ANS=Y"
set /p "ANS=  Να ενημερωθεί ΑΥΤΟΣ ο φάκελος; [Y/N] (προεπιλογή Y): "
if /i not "%ANS%"=="Y" goto :cancel

rem ---- 2) έλεγχοι -----------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Δεν βρέθηκε το Node.js / npm. Εγκαταστήστε πρώτα το Node.js και ξανατρέξτε το.
    goto :fail
)

rem ---- σταμάτα το FM-DX αυτόματα ώστε να μην είναι κλειδωμένα τα αρχεία ------
echo.
echo  Σταματάω το FM-DX Webserver αν τρέχει...
powershell -NoProfile -Command "$d=('%DIR%').ToLower(); Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($d) } | ForEach-Object { Write-Host ('  σταμάτησε το FM-DX (node PID ' + $_.ProcessId + ')'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1

rem ---- 3) αντίγραφο ασφαλείας ρυθμίσεων και πρόσθετων -----------------------
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "BACKUP=%DIR%-backup-%STAMP%"
echo.
echo  Κρατάω αντίγραφο ασφαλείας ρυθμίσεων και πρόσθετων στο:
echo       %BACKUP%
robocopy "%DIR%" "%BACKUP%" config.json .session-secret sessions.json /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\plugins"         robocopy "%DIR%\plugins"         "%BACKUP%\plugins"         /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\plugins_configs" robocopy "%DIR%\plugins_configs" "%BACKUP%\plugins_configs" /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\web\js\plugins"  robocopy "%DIR%\web\js\plugins"  "%BACKUP%\web\js\plugins"  /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul

rem ---- 4) ενημέρωση του κώδικα ----------------------------------------------
if exist "%DIR%\.git" goto :gitupdate
goto :zipupdate

:gitupdate
echo.
echo  Ενημέρωση (git)...
where git >nul 2>&1
if errorlevel 1 (
    echo  Είναι git clone αλλά το git δεν είναι εγκατεστημένο. Εγκαταστήστε Git for
    echo  Windows, ή σβήστε τον φάκελο .git για να γίνει η ενημέρωση με ZIP.
    goto :fail
)
git config --global --add safe.directory "%DIR%" >nul 2>&1
rem κράτα τις γραμμές των πρόσθετων στα server\chat.js / server\index.js
set "STASHED=0"
git -C "%DIR%" stash >"%TEMP%\fmdx_stash.txt" 2>&1
findstr /c:"No local changes" "%TEMP%\fmdx_stash.txt" >nul 2>&1 || set "STASHED=1"
git -C "%DIR%" pull
if errorlevel 1 (
    if "%STASHED%"=="1" git -C "%DIR%" stash pop >nul 2>&1
    echo  Το git pull απέτυχε. Ο φάκελός σας έμεινε ανέπαφος· δεν χάθηκε τίποτα.
    goto :fail
)
if "%STASHED%"=="1" (
    git -C "%DIR%" stash pop
    if errorlevel 1 (
        echo.
        echo  ΣΗΜΕΙΩΣΗ: οι γραμμές των πρόσθετων δεν μπήκαν ξανά σωστά μετά την
        echo        ενημέρωση. Αφού ξεκινήσει το FM-DX, ανοίξτε το Setup και πατήστε
        echo        "Fix it now" σε κάθε σχετικό πρόσθετο για να μπουν ξανά.
    )
)
goto :npminstall

:zipupdate
echo.
echo  Δεν είναι git clone - κατεβάζω τον τελευταίο κώδικα ως ZIP...
set "ZIP=%TEMP%\fmdx-latest.zip"
set "EXD=%TEMP%\fmdx-latest"
if exist "%EXD%" rmdir /s /q "%EXD%" >nul 2>&1
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%UPSTREAM%/archive/refs/heads/main.zip' -OutFile '%ZIP%' } catch { exit 1 }"
if errorlevel 1 (
    echo  Το κατέβασμα απέτυχε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.
    goto :fail
)
powershell -NoProfile -Command "try { Expand-Archive -Path '%ZIP%' -DestinationPath '%EXD%' -Force } catch { exit 1 }"
if errorlevel 1 (
    echo  Δεν μπόρεσα να αποσυμπιέσω το αρχείο.
    goto :fail
)
echo  Αντιγράφω τον νέο κώδικα (ρυθμίσεις και πρόσθετα μένουν ως έχουν)...
rem το /XD παραλείπει κάθε φάκελο plugins (και plugins\ ΚΑΙ web\js\plugins),
rem node_modules, plugins_configs και .git. Το /XF κρατά config και sessions.
robocopy "%EXD%\fm-dx-webserver-main" "%DIR%" /E /R:1 /W:1 ^
    /XD plugins node_modules plugins_configs .git ^
    /XF config.json .session-secret sessions.json ^
    /NJH /NJS /NFL /NDL >nul
echo.
echo  ΣΗΜΕΙΩΣΗ (ενημέρωση με ZIP): ανανεώθηκαν τα βασικά αρχεία, οπότε οι γραμμές
echo        των πρόσθετων στα server\chat.js / server\index.js χάθηκαν. Αφού ξεκινήσει
echo        το FM-DX, ανοίξτε το Setup και πατήστε "Fix it now" σε κάθε σχετικό πρόσθετο.
goto :npminstall

:npminstall
echo.
echo  Εγκατάσταση/ενημέρωση εξαρτήσεων (npm install)...
pushd "%DIR%"
call npm install
set "NPMERR=%errorlevel%"
popd
if not "%NPMERR%"=="0" (
    echo  Το npm install ανέφερε πρόβλημα. Ο κώδικας ενημερώθηκε· δοκιμάστε να
    echo  τρέξετε  npm install  μόνοι σας μέσα στον φάκελο.
)

:done
echo.
echo  ==============================================
echo    Έτοιμο. Το FM-DX Webserver είναι ενημερωμένο.
echo    Οι ρυθμίσεις και τα πρόσθετά σας διατηρήθηκαν.
echo    Υπάρχει αντίγραφο ασφαλείας εδώ αν το χρειαστείτε:
echo       %BACKUP%
echo  ==============================================
echo.
set "ANS=Y"
set /p "ANS=  Να ξεκινήσει τώρα το FM-DX Webserver; [Y/N] (προεπιλογή Y): "
if /i "%ANS%"=="Y" (
    echo  Ξεκινάω το FM-DX Webserver σε νέο παράθυρο...
    pushd "%DIR%"
    start "FM-DX Webserver" cmd /k npm run webserver
    popd
) else (
    echo  Ξεκινήστε μόνοι σας το FM-DX Webserver όποτε είστε έτοιμοι.
)
echo.
pause
endlocal
exit /b 0

:cancel
echo  Ακυρώθηκε. Δεν άλλαξε τίποτα.
pause
endlocal
exit /b 0

:fail
echo.
echo  Σταμάτησε. Δεν σβήστηκε τίποτα δικό σας.
pause
endlocal
exit /b 1

rem --- υπορουτίνα: όρισε το DIR αν το %1 είναι πραγματικός φάκελος fm-dx-webserver
:isfmdx
if defined DIR goto :eof
if not exist "%~1\package.json" goto :eof
findstr /i /c:"fm-dx-webserver" "%~1\package.json" >nul 2>&1 && set "DIR=%~1"
goto :eof

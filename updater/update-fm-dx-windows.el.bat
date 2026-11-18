@echo off
rem ===========================================================================
rem  FM-DX Webserver - ergaleio enimerosis me ena klik gia Windows
rem  tou Konstantinos Vlachos
rem
rem  (Ta minimata einai se greeklish epitides: etsi to .bat trexei panta,
rem   xoris provlimata kodikopoiisis sto parathiro tou cmd.)
rem
rem  Enimeronei to FM-DX Webserver stin teleftaia ekdosi KRATONTAS tis
rem  rythmiseis sas (config.json), ola ta prostheta, tis rythmiseis tous,
rem  tis syndeseis kai to session secret. Tipota diko sas den svinetai.
rem
rem  Pos xrisimopoieitai:
rem    - Pio efkolo: valte to arxeio mesa ston fakelo fm-dx-webserver kai
rem      kante diplo klik. Enimeronei afton ton fakelo.
rem    - I aplos diplo klik opoudipote: psaxnei mono tou ton fakelo
rem      fm-dx-webserver (Desktop, Downloads, Documents, fakelos xristi, C:\).
rem      Mporeite kai me to xeri:  set FMDX_DIR=C:\path\to\fm-dx-webserver
rem
rem  Xreiazetai: Node.js (npm). Git an o fakelos einai git clone; alliws o
rem  neos kodikas katevainei ws ZIP.
rem ===========================================================================

title FM-DX Webserver updater
color 0b
setlocal

set "UPSTREAM=https://github.com/NoobishSVK/fm-dx-webserver"
set "DIR="

echo.
echo  ==============================================
echo    FM-DX Webserver - enimerosi stin teleftaia ekdosi
echo  ==============================================
echo.

rem ---- 1) vres ton fakelo fm-dx-webserver -----------------------------------
rem (a) fakelos pou orisate me to xeri exei proteraiotita; an einai lathos, stamatame
if defined FMDX_DIR (
    call :isfmdx "%FMDX_DIR%"
    if not defined DIR (
        echo.
        echo  To FMDX_DIR einai "%FMDX_DIR%" alla den einai fakelos FM-DX Webserver.
        goto :fail
    )
)
rem (b) o fakelos autou tou arxeiou
if not defined DIR if exist "%~dp0package.json" call :isfmdx "%~dp0"
rem (c) oi synithismenoi fakeloi
if not defined DIR call :isfmdx "%USERPROFILE%\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Desktop\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Downloads\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\Documents\fm-dx-webserver"
if not defined DIR call :isfmdx "%USERPROFILE%\OneDrive\Desktop\fm-dx-webserver"
if not defined DIR call :isfmdx "C:\fm-dx-webserver"
if not defined DIR call :isfmdx "%PUBLIC%\fm-dx-webserver"

rem (d) teleftaia lysi: psakse ston fakelo xristi (ligo pio argo)
if not defined DIR (
    echo  Psaxno ton fakelo fm-dx-webserver, perimenete...
    for /f "delims=" %%p in ('powershell -NoProfile -Command "Get-ChildItem -Path $env:USERPROFILE -Recurse -Depth 5 -Filter package.json -Force -ErrorAction SilentlyContinue | Where-Object { Select-String -Path $_.FullName -Pattern 'fm-dx-webserver' -SimpleMatch -Quiet } | Select-Object -First 1 -ExpandProperty DirectoryName"') do set "DIR=%%p"
)

if not defined DIR (
    echo.
    echo  Den vrethike automata o fakelos fm-dx-webserver.
    echo  Valte auto to arxeio mesa ston fakelo kai ksanatrekste to, i oriste ton me to xeri:
    echo       set FMDX_DIR=C:\path\to\fm-dx-webserver
    echo  kai meta ksanatrekste auto to arxeio.
    goto :fail
)

rem afaire tyxon backslash sto telos
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

echo  Vrethike to FM-DX Webserver sto:
echo       %DIR%
echo.
set "ANS=Y"
set /p "ANS=  Na enimerothei AFTOS o fakelos? [Y/N] (proepilogi Y): "
if /i not "%ANS%"=="Y" goto :cancel

rem ---- 2) elegxoi -----------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Den vrethike to Node.js / npm. Egkatastiste prota to Node.js kai ksanatrekste to.
    goto :fail
)

rem ---- stamata to FM-DX automata wste na min einai kleidomena ta arxeia -----
echo.
echo  Stamatao to FM-DX Webserver an trexei...
powershell -NoProfile -Command "$d=('%DIR%').ToLower(); Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($d) } | ForEach-Object { Write-Host ('  stamatise to FM-DX (node PID ' + $_.ProcessId + ')'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1

rem ---- 3) antigrafo asfaleias rythmiseon kai prostheton ---------------------
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "BACKUP=%DIR%-backup-%STAMP%"
echo.
echo  Kratao antigrafo asfaleias rythmiseon kai prostheton sto:
echo       %BACKUP%
robocopy "%DIR%" "%BACKUP%" config.json .session-secret sessions.json /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\plugins"         robocopy "%DIR%\plugins"         "%BACKUP%\plugins"         /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\plugins_configs" robocopy "%DIR%\plugins_configs" "%BACKUP%\plugins_configs" /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul
if exist "%DIR%\web\js\plugins"  robocopy "%DIR%\web\js\plugins"  "%BACKUP%\web\js\plugins"  /E /R:1 /W:1 /NJH /NJS /NFL /NDL >nul

rem ---- 4) enimerosi tou kodika ----------------------------------------------
if exist "%DIR%\.git" goto :gitupdate
goto :zipupdate

:gitupdate
echo.
echo  Enimerosi (git)...
where git >nul 2>&1
if errorlevel 1 (
    echo  Einai git clone alla to git den einai egkatestimeno. Egkatastiste Git for
    echo  Windows, i svinte ton fakelo .git gia na ginei i enimerosi me ZIP.
    goto :fail
)
git config --global --add safe.directory "%DIR%" >nul 2>&1
rem kratise antigrafo apo kathe arxeio pou ALLAKSATE eseis (prosarmoges) sto backup
echo  Kratao antigrafo apo ta dika sas allagmena arxeia...
powershell -NoProfile -Command "$d='%DIR%'; $b='%BACKUP%\custom'; Set-Location -LiteralPath $d; @(git diff --name-only HEAD) + @(git ls-files --others --exclude-standard) | Where-Object { $_ } | Sort-Object -Unique | ForEach-Object { $s=Join-Path $d $_; if (Test-Path -LiteralPath $s) { $t=Join-Path $b $_; New-Item -ItemType Directory -Force -Path (Split-Path -Parent $t) | Out-Null; Copy-Item -LiteralPath $s -Destination $t -Force } }" 2>nul
rem kratise tis grammes ton prostheton sta server\chat.js / server\index.js
set "STASHED=0"
git -C "%DIR%" stash >"%TEMP%\fmdx_stash.txt" 2>&1
findstr /c:"No local changes" "%TEMP%\fmdx_stash.txt" >nul 2>&1 || set "STASHED=1"
git -C "%DIR%" pull
if errorlevel 1 (
    if "%STASHED%"=="1" git -C "%DIR%" stash pop >nul 2>&1
    echo  To git pull apetyxe. O fakelos sas emeine anepafos; den xathike tipota.
    goto :fail
)
if "%STASHED%"=="1" (
    git -C "%DIR%" stash pop
    if errorlevel 1 (
        echo.
        echo  SIMEIOSI: oi grammes ton prostheton den bikan ksana sosta meta tin
        echo        enimerosi. Afou ksekinisei to FM-DX, anoikste to Setup kai patiste
        echo        "Fix it now" se kathe sxetiko prostheto gia na bown ksana.
    )
)
goto :npminstall

:zipupdate
echo.
echo  Den einai git clone - katevazo ton teleftaio kodika ws ZIP...
set "ZIP=%TEMP%\fmdx-latest.zip"
set "EXD=%TEMP%\fmdx-latest"
if exist "%EXD%" rmdir /s /q "%EXD%" >nul 2>&1
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%UPSTREAM%/archive/refs/heads/main.zip' -OutFile '%ZIP%' } catch { exit 1 }"
if errorlevel 1 (
    echo  To katevasma apetyxe. Elegkste ti syndesi sas kai dokimaste ksana.
    goto :fail
)
powershell -NoProfile -Command "try { Expand-Archive -Path '%ZIP%' -DestinationPath '%EXD%' -Force } catch { exit 1 }"
if errorlevel 1 (
    echo  Den mporesa na aposympieso to arxeio.
    goto :fail
)
rem kratise prota antigrafo ton torinon vasikon arxeion, na min xathei tipota custom
echo  Kratao antigrafo ton torinon vasikon arxeion (na min xathei tipota diko sas)...
robocopy "%DIR%" "%BACKUP%\replaced" /E /R:1 /W:1 /XD node_modules .git plugins plugins_configs "%DIR%\web\js\plugins" /NJH /NJS /NFL /NDL >nul
echo  Antigrafo tou neou kodika (rythmiseis kai prostheta menoun ws exoun)...
rem to /XD paraleipei kathe fakelo plugins (kai plugins\ KAI web\js\plugins),
rem node_modules, plugins_configs kai .git. To /XF krata config kai sessions.
robocopy "%EXD%\fm-dx-webserver-main" "%DIR%" /E /R:1 /W:1 ^
    /XD plugins node_modules plugins_configs .git ^
    /XF config.json .session-secret sessions.json ^
    /NJH /NJS /NFL /NDL >nul
echo.
echo  SIMEIOSI (enimerosi me ZIP): ananeothikan ta vasika arxeia, opote oi grammes
echo        ton prostheton sta server\chat.js / server\index.js xathikan. Afou ksekinisei
echo        to FM-DX, anoikste to Setup kai patiste "Fix it now" se kathe sxetiko prostheto.
goto :npminstall

:npminstall
echo.
echo  Egkatastasi/enimerosi eksartiseon (npm install)...
pushd "%DIR%"
call npm install
set "NPMERR=%errorlevel%"
popd
if not "%NPMERR%"=="0" (
    echo  To npm install anefere provlima. O kodikas enimerothike; dokimaste na
    echo  treksete  npm install  monoi sas mesa ston fakelo.
)

:done
echo.
echo  ==============================================
echo    Etoimo. To FM-DX Webserver einai enimeromeno.
echo    Oi rythmiseis kai ta prostheta sas diatirithikan.
echo    Yparxei antigrafo asfaleias edo an to xreiasteite:
echo       %BACKUP%
echo  ==============================================
echo.
set "ANS=Y"
set /p "ANS=  Na ksekinisei tora to FM-DX Webserver? [Y/N] (proepilogi Y): "
if /i "%ANS%"=="Y" (
    echo  Ksekinao to FM-DX Webserver se neo parathiro...
    pushd "%DIR%"
    start "FM-DX Webserver" cmd /k npm run webserver
    popd
) else (
    echo  Ksekiniste monoi sas to FM-DX Webserver opote eiste etoimoi.
)
echo.
pause
endlocal
exit /b 0

:cancel
echo  Akyrothike. Den allakse tipota.
pause
endlocal
exit /b 0

:fail
echo.
echo  Stamatise. Den svistike tipota diko sas.
pause
endlocal
exit /b 1

rem --- yporoutina: orise to DIR an to %1 einai pragmatikos fakelos fm-dx-webserver
:isfmdx
if defined DIR goto :eof
if not exist "%~1\package.json" goto :eof
findstr /i /c:"fm-dx-webserver" "%~1\package.json" >nul 2>&1 && set "DIR=%~1"
goto :eof

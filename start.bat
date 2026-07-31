@echo off
setlocal
title Browser Strike Launcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto no_node

if not exist node_modules goto install
goto launch

:install
echo [1/3] Ustanovka komponentov igry...
call npm install
if errorlevel 1 goto install_error

:launch
echo [2/3] Zapusk lokalnogo servera...
start "Browser Strike Server" /min cmd /c "npm run dev"

for /l %%i in (1,1,40) do (
    powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:5173; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto ready
    timeout /t 1 /nobreak >nul
)
goto server_error

:ready
echo [3/3] Igra gotova: http://127.0.0.1:5173
start "" "http://127.0.0.1:5173"
echo Server rabotaet v otdelnom svernutom okne.
echo Chtoby ostanovit igru, zakroyte okno "Browser Strike Server".
pause
exit /b 0

:no_node
echo [OSHIBKA] Node.js ne ustanovlen.
echo Ustanovite Node.js LTS s https://nodejs.org/ i povtorite zapusk.
pause
exit /b 1

:install_error
echo [OSHIBKA] Ne udalos ustanovit komponenty. Proverte internet i prava dostupa.
pause
exit /b 1

:server_error
echo [OSHIBKA] Server ne otvetil za 40 sekund.
echo Proverte, svoboden li port 5173, i zapustite start.bat snova.
pause
exit /b 1

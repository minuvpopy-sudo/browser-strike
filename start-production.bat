@echo off
setlocal
title Browser Strike Production
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto no_node
if not exist dist\index.html goto no_dist

start "Browser Strike Production Server" /min cmd /c "node server.mjs"
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8080 ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto ready
    timeout /t 1 /nobreak >nul
)
echo [OSHIBKA] Production-server ne zapustilsya.
pause
exit /b 1

:ready
start "" "http://127.0.0.1:8080"
echo Production-versiya zapushchena: http://127.0.0.1:8080
pause
exit /b 0

:no_node
echo [OSHIBKA] Node.js ne ustanovlen.
pause
exit /b 1

:no_dist
echo [OSHIBKA] Papka dist ne naydena. Vypolnite npm install i npm run build.
pause
exit /b 1

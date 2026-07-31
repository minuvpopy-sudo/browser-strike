@echo off
setlocal
title Browser Strike Simple Launcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto no_node
if not exist node_modules goto no_modules

start "Browser Strike Server" /min cmd /c "npm run dev"
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:5173 ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto ready
    timeout /t 1 /nobreak >nul
)
echo [OSHIBKA] Server ne zapustilsya.
pause
exit /b 1

:ready
start "" "http://127.0.0.1:5173"
echo Igra zapushchena: http://127.0.0.1:5173
pause
exit /b 0

:no_node
echo [OSHIBKA] Node.js ne ustanovlen.
pause
exit /b 1

:no_modules
echo [OSHIBKA] Komponenty ne ustanovleny. Snachala zapustite start.bat.
pause
exit /b 1

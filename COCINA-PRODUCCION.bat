@echo off
title Capriccio - Cocina (Produccion)
echo.
echo  ==========================================
echo   CAPRICCIO PIZZERIA - COCINA (PRODUCCION)
echo   https://capricciopizzeria.com/cocina
echo  ==========================================
echo.

set CHROME=""
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if %CHROME%=="" (
    echo ERROR: No se encontro Google Chrome.
    pause
    exit /b 1
)

start "" %CHROME% ^
    --kiosk-printing ^
    --app=https://capricciopizzeria.com/cocina ^
    --start-maximized ^
    --disable-infobars ^
    --no-first-run

timeout /t 3 /nobreak >nul

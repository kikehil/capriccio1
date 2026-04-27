@echo off
title Capriccio - Modulo Cocina
echo.
echo  ==========================================
echo   CAPRICCIO PIZZERIA - MODULO COCINA
echo   Iniciando con impresion automatica...
echo  ==========================================
echo.

REM Buscar Chrome en las rutas comunes de Windows
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
    echo Instala Chrome desde https://www.google.com/chrome/
    pause
    exit /b 1
)

echo Abriendo modulo cocina con impresion silenciosa...
echo Impresora predeterminada: activa
echo.

REM --kiosk-printing  = imprime SIN mostrar dialogo, directo a impresora predeterminada
REM --app             = modo app (sin barra de tabs)
REM --start-maximized = pantalla completa

start "" %CHROME% ^
    --kiosk-printing ^
    --app=http://localhost:3000/cocina ^
    --start-maximized ^
    --disable-infobars ^
    --no-first-run ^
    --disable-default-apps

echo Chrome iniciado correctamente.
echo.
echo NOTA: Cierra esta ventana cuando el modulo este cargado.
timeout /t 3 /nobreak >nul

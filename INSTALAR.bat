@echo off
title ANIRUL - Instalacion
cd /d "%~dp0"

echo.
echo  ========================================
echo       ANIRUL - Instalacion
echo  ========================================
echo.

:: Verificar si node existe
where node >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Node.js no esta instalado.
    echo.
    echo  Descarga Node.js desde:
    echo  https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo  Instalando dependencias...
echo.
call npm install

if errorlevel 1 (
    echo.
    echo  ERROR: Fallo la instalacion.
    pause
    exit /b 1
)

echo.
echo  ========================================
echo       Instalacion completada!
echo  ========================================
echo.
echo  Ejecuta INICIAR_ANIRUL.bat para abrir
echo.
pause

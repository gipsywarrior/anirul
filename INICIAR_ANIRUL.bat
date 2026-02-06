@echo off
title ANIRUL - Bitacora RPG
cd /d "%~dp0"

:: Verificar si node_modules existe
if not exist "node_modules" (
    echo.
    echo  Ejecuta INSTALAR.bat primero
    echo.
    pause
    exit /b 1
)

start "" npm start

@echo off
title Nuenime App Launcher
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0run-app.ps1" %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Script berhenti dengan kode error: %ERRORLEVEL%
    pause
)

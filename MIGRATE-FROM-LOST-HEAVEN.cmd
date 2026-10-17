@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MIGRATE-FROM-LOST-HEAVEN.ps1"
set "ERR=%ERRORLEVEL%"
exit /b %ERR%

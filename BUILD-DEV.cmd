@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD-DEV.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" echo BUILD FAILED. Error code: %ERR%
exit /b %ERR%

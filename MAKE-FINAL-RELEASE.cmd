@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MAKE-FINAL-RELEASE.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" echo FAILED. Error code: %ERR%
exit /b %ERR%

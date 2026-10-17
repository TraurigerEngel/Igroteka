@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INIT-DEMO-DATA.ps1"
exit /b %ERRORLEVEL%

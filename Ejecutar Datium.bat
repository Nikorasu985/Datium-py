@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0Ejecutar-Datium.ps1"
if errorlevel 1 pause

@echo off
cd /d "%~dp0"
if exist "%~dp0Blueprint Ledger.exe" (
 start "" "%~dp0Blueprint Ledger.exe"
 exit /b 0
)
set "LEDGER_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "LEDGER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%LEDGER_NODE%" --version >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Opening the standalone app instead.
 echo For server sync, install Node.js 20 or later from https://nodejs.org/
 start "" "%~dp0index.html"
 pause
 exit /b 0
)
"%LEDGER_NODE%" server.mjs --open
pause

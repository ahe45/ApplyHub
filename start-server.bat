@echo off
setlocal
cd /d "%~dp0"

set "APPLYHUB_SETUP_REQUIRED=0"
set "APPLYHUB_SETUP_LOG=%~dp0log\setup-windows.log"
if /i "%~1"=="--setup" set "APPLYHUB_SETUP_REQUIRED=1"
if not exist ".env" set "APPLYHUB_SETUP_REQUIRED=1"
if not exist "node_modules\" set "APPLYHUB_SETUP_REQUIRED=1"
where node >nul 2>&1
if errorlevel 1 goto RUN_SETUP
where npm.cmd >nul 2>&1
if errorlevel 1 goto RUN_SETUP
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22 || (major===22 && minor>=13) ? 0 : 1)"
if errorlevel 1 goto RUN_SETUP
if "%APPLYHUB_SETUP_REQUIRED%"=="1" goto RUN_SETUP
node -e "for (const name of Object.keys(require('./package.json').dependencies)) require.resolve(name)" >nul 2>&1
if errorlevel 1 goto RUN_SETUP
goto START_SERVER

:RUN_SETUP
echo ApplyHub needs Windows setup. Follow the questions in this window.
if not exist "log\" mkdir "log"
if not exist "deploy\setup-windows.ps1" (
  echo deploy\setup-windows.ps1 was not found. Update the complete project and try again.
  goto FAILED
)
where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo Windows PowerShell was not found.
  goto FAILED
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\setup-windows.ps1"
if errorlevel 1 (
  echo Setup failed. See log\setup-windows.log.
  goto FAILED
)
rem Node may have been installed by the child PowerShell process.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"

:START_SERVER
if not exist "log\" mkdir "log"
node scripts/check-startup.js > "log\startup-check.log" 2>&1
if errorlevel 1 (
  type "log\startup-check.log"
  echo Run start-server.bat --setup to configure the database again.
  goto FAILED
)
echo Starting ApplyHub server. Press Ctrl+C to stop the server.
echo.
call npm.cmd start
if errorlevel 1 goto FAILED
echo.
echo Server process exited.
pause
exit /b 0

:FAILED
echo.
echo ApplyHub could not start. Read the message above and see README.md.
pause
exit /b 1

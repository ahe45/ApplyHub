@echo off
setlocal
if defined APPLYHUB_UPDATE_WORKER goto RUN_UPDATE
set "APPLYHUB_UPDATE_ROOT=%~dp0"
set "APPLYHUB_UPDATE_COPY=%TEMP%\ApplyHub-update-%RANDOM%-%RANDOM%.bat"
rem Parse this block before Git can replace the launcher that is currently running.
(
  copy /y "%~f0" "%APPLYHUB_UPDATE_COPY%" >nul
  if errorlevel 1 (
    echo Could not prepare the update launcher in the temporary folder.
    pause
    exit /b 1
  ) else (
    set "APPLYHUB_UPDATE_WORKER=1"
    call "%APPLYHUB_UPDATE_COPY%"
    if errorlevel 1 (exit /b 1) else (exit /b 0)
  )
)

:RUN_UPDATE
cd /d "%APPLYHUB_UPDATE_ROOT%"

set "APPLYHUB_UPDATE_LOG=%APPLYHUB_UPDATE_ROOT%log\update-server.log"
set "APPLYHUB_BRANCH="
set "APPLYHUB_LOCAL_CHANGES="
if not exist "log\" mkdir "log"
echo ApplyHub update started: %DATE% %TIME%> "%APPLYHUB_UPDATE_LOG%"
echo Updating ApplyHub. Stop the running server before continuing.
pause

where git >nul 2>&1
if errorlevel 1 (
  echo Git for Windows is required.>> "%APPLYHUB_UPDATE_LOG%"
  goto FAILED
)
where node >nul 2>&1
if errorlevel 1 goto NEED_SETUP
where npm.cmd >nul 2>&1
if errorlevel 1 goto NEED_SETUP
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22 || (major===22 && minor>=13) ? 0 : 1)"
if errorlevel 1 goto NEED_SETUP
if not exist ".env" goto NEED_SETUP
if not exist ".git" (
  echo This folder is not a Git clone.>> "%APPLYHUB_UPDATE_LOG%"
  goto FAILED
)
git rev-parse --is-inside-work-tree >> "%APPLYHUB_UPDATE_LOG%" 2>&1
if errorlevel 1 goto FAILED
for /f "delims=" %%B in ('git branch --show-current') do set "APPLYHUB_BRANCH=%%B"
if not defined APPLYHUB_BRANCH (
  echo No branch is checked out. Check out your deployment branch first.>> "%APPLYHUB_UPDATE_LOG%"
  goto FAILED
)
git status --porcelain > "log\update-status.log" 2>> "%APPLYHUB_UPDATE_LOG%"
if errorlevel 1 goto FAILED
for /f "usebackq delims=" %%S in ("log\update-status.log") do set "APPLYHUB_LOCAL_CHANGES=1"
if defined APPLYHUB_LOCAL_CHANGES (
  echo Local changes found. Commit or stash them before updating.>> "%APPLYHUB_UPDATE_LOG%"
  type "log\update-status.log" >> "%APPLYHUB_UPDATE_LOG%"
  goto FAILED
)

echo Updating branch %APPLYHUB_BRANCH%...
git fetch origin >> "%APPLYHUB_UPDATE_LOG%" 2>&1
if errorlevel 1 goto FAILED
git merge --ff-only "origin/%APPLYHUB_BRANCH%" >> "%APPLYHUB_UPDATE_LOG%" 2>&1
if errorlevel 1 goto FAILED

echo Installing dependencies...
call npm.cmd ci >> "%APPLYHUB_UPDATE_LOG%" 2>&1
if errorlevel 1 goto FAILED
echo Preparing database schema...
call npm.cmd run db:setup >> "%APPLYHUB_UPDATE_LOG%" 2>&1
if errorlevel 1 goto FAILED
node scripts/check-startup.js >> "%APPLYHUB_UPDATE_LOG%" 2>&1
if errorlevel 1 goto FAILED

echo.
echo ApplyHub update completed. Run start-server.bat to start the server again.
echo Log: %APPLYHUB_UPDATE_LOG%
pause
exit /b 0

:NEED_SETUP
echo Run start-server.bat --setup first to prepare Node.js and .env.>> "%APPLYHUB_UPDATE_LOG%"
goto FAILED

:FAILED
echo.
type "%APPLYHUB_UPDATE_LOG%"
echo.
echo ApplyHub update failed. See log\update-server.log.
pause
exit /b 1

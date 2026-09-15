@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm >nul 2>&1
if errorlevel 1 goto missing_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22 || (major===22 && minor>=13) ? 0 : 1)"
if errorlevel 1 goto old_node

if not exist ".env" goto missing_env
if not exist "node_modules\" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto failed
)

node scripts/check-startup.js
if errorlevel 1 goto failed
call npm start
if errorlevel 1 goto failed
pause
exit /b 0

:missing_node
echo Node.js and npm are required. Install Node.js 24 LTS, then reopen this file.
goto failed

:old_node
echo This project requires Node.js 22.13 or newer. Install Node.js 24 LTS.
goto failed

:missing_env
copy /y ".env.example" ".env" >nul
if errorlevel 1 goto failed
echo Created .env from .env.example.
echo Open .env in a text editor and configure DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD.
echo Make sure MySQL or MariaDB is running, then run this file again.
goto failed

:failed
echo.
echo ApplyHub could not start. Read the message above. See README.md for first-time setup.
pause
exit /b 1

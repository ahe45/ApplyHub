@echo off
setlocal

cd /d "%~dp0"

set "CLOUDFLARED_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
set "LOCAL_URL=http://localhost:3000"

if not exist "%CLOUDFLARED_EXE%" goto cloudflared_missing

echo Starting Cloudflare Tunnel for %LOCAL_URL%
echo Press Ctrl+C to stop the tunnel.
echo.

"%CLOUDFLARED_EXE%" tunnel --url %LOCAL_URL% --no-autoupdate

if errorlevel 1 goto cloudflared_failed

endlocal
exit /b 0

:cloudflared_missing
echo cloudflared executable not found:
echo %CLOUDFLARED_EXE%
pause
endlocal
exit /b 1

:cloudflared_failed
echo.
echo cloudflared exited with an error.
pause
endlocal
exit /b 1

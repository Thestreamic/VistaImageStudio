@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Vista Image Studio - Web (browser)

REM Keep the console open when Explorer starts this via cmd /c
set "_CMDLINE=%cmdcmdline:"=%"
echo %_CMDLINE% | find.exe /I "/c" >nul
if not errorlevel 1 if /I not "%~1"=="--stay" (
    cmd /k "%~f0" --stay
    exit /b
)

cd /d "%~dp0"
if errorlevel 1 (
    echo Failed to change directory to "%~dp0"
    pause
    exit /b 1
)

if not exist "%~dp0package.json" (
    echo package.json not found. Keep this script inside the Vista Image Studio folder.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~f0' -ErrorAction SilentlyContinue; Get-ChildItem -LiteralPath '%~dp0' -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>nul

set "LOG=%~dp0run-web.log"
> "%LOG%" echo ===== %DATE% %TIME% =====
>>"%LOG%" echo script=%~f0
>>"%LOG%" echo cwd=%CD%

set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
set "npm_config_devdir="
set "PORT=3100"
set "URL=http://127.0.0.1:%PORT%"

echo ============================================================
echo   Vista Image Studio - Web only (local browser)
echo ============================================================
echo.
echo   This is the online / GitHub-bound version.
echo   Nothing is uploaded. Close the window when you are done.
echo.
echo   URL: %URL%
echo   Log: "%LOG%"
echo.
echo   For a production preview of what GitHub Pages will host,
echo   run preview-web.bat instead.
echo.

where.exe node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Install LTS from https://nodejs.org then re-run.
    >>"%LOG%" echo ERROR: node missing
    pause
    exit /b 1
)
where.exe npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
    echo npm.cmd not found. Reinstall Node.js from https://nodejs.org
    >>"%LOG%" echo ERROR: npm.cmd missing
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies - first run only...
    >>"%LOG%" echo npm.cmd install
    call npm.cmd install
    if !errorlevel! neq 0 (
        echo npm install failed. See "%LOG%"
        pause
        exit /b 1
    )
)

echo Opening %URL% once the server is ready...
echo.
>>"%LOG%" echo npm.cmd run web
start "Vista web browser" /b cmd /c "call npx.cmd --no-install wait-on %URL% && start "" %URL%"
call npm.cmd run web
set "APP_EXIT=!errorlevel!"
>>"%LOG%" echo exit=!APP_EXIT!

echo.
if not "!APP_EXIT!"=="0" (
    echo Web server exited with error code !APP_EXIT!.
    echo If port %PORT% is in use, close the other window and try again.
    echo See "%LOG%"
)
pause
exit /b !APP_EXIT!

@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Vista Image Studio - Web preview (GitHub Pages artifact)

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

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~f0' -ErrorAction SilentlyContinue" >nul 2>nul

set "LOG=%~dp0preview-web.log"
> "%LOG%" echo ===== %DATE% %TIME% =====
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
set "npm_config_devdir="

echo ============================================================
echo   Local preview of the GitHub Pages build
echo ============================================================
echo.
echo   Builds the static site, serves it at http://127.0.0.1:4173
echo   and opens your browser. Nothing is pushed or deployed.
echo.
echo   Optional: set BASE_PATH=/your-repo-name first if the live
echo   GitHub URL will be username.github.io/your-repo-name/
echo.

where.exe npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
    echo npm.cmd not found. Install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies - first run only...
    call npm.cmd install
    if !errorlevel! neq 0 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

echo Building static web export...
>>"%LOG%" echo npm.cmd run build:web
call npm.cmd run build:web
if !errorlevel! neq 0 (
    echo Build failed. See the errors above and "%LOG%"
    pause
    exit /b 1
)

echo.
echo Serving out-web/  (Ctrl+C to stop)
echo.
>>"%LOG%" echo npm.cmd run preview:web
call npm.cmd run preview:web
set "APP_EXIT=!errorlevel!"
pause
exit /b !APP_EXIT!

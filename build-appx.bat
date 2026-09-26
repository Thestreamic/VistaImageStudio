@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Vista Image Studio - Build Windows APPX

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

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~f0' -ErrorAction SilentlyContinue" >nul 2>nul

set "LOG=%~dp0build-appx.log"
> "%LOG%" echo ===== %DATE% %TIME% =====
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
set "npm_config_devdir="

echo ============================================================
echo   Vista Image Studio - Build .appx
echo ============================================================
echo.
echo   Needs Windows SDK. The .exe installer does not.
echo   Log: "%LOG%"
echo.

where.exe npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
    echo npm.cmd not found. Install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm.cmd install
    if !errorlevel! neq 0 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

REM electron-builder.yml packs out, dist-electron, and package.json only.
REM The docs folder is not copied into the .appx.
echo Building .appx ...
>>"%LOG%" echo npm.cmd run package:appx
call npm.cmd run package:appx
if !errorlevel! neq 0 (
    echo.
    echo APPX build failed. Use build-exe.bat for the .exe instead.
    echo See "%LOG%"
    pause
    exit /b 1
)

echo.
echo Done. Look in the "dist" folder for the .appx
>>"%LOG%" echo DONE
if exist "dist" explorer "dist"
pause
exit /b 0

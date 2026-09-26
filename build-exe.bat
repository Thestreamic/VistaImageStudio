@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Vista Image Studio - Build Windows Installer

REM Keep the console open when Explorer / another app starts this via cmd /c
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

set "LOG=%~dp0build-exe.log"
> "%LOG%" echo ===== %DATE% %TIME% =====
>>"%LOG%" echo script=%~f0
>>"%LOG%" echo cwd=%CD%

set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
set "npm_config_devdir="

echo ============================================================
echo   Vista Image Studio - Build Distributable .exe
echo ============================================================
echo.
echo   Log: "%LOG%"
echo.

where.exe node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is required first. Run run-app.bat once to install it, then re-run this.
    >>"%LOG%" echo ERROR: node not found
    pause
    exit /b 1
)

where.exe npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
    echo npm.cmd not found. Reinstall Node.js from https://nodejs.org
    >>"%LOG%" echo ERROR: npm.cmd not found
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    >>"%LOG%" echo npm.cmd install
    call npm.cmd install
    if !errorlevel! neq 0 (
        echo npm install failed. See the errors above and "%LOG%"
        >>"%LOG%" echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

REM electron-builder.yml packs out, dist-electron, and package.json only.
REM The docs folder is not copied into the .exe.
echo Closing any running Vista Image Studio so the installer can replace files...
>>"%LOG%" echo node scripts/unlock-dist.mjs
call node scripts/unlock-dist.mjs
>>"%LOG%" echo npm.cmd run package
echo Building renderer + packaging Windows installer ^(NSIS + portable^)...
echo This can take a few minutes on first run.
echo.
call npm.cmd run package >>"%LOG%" 2>&1
if !errorlevel! neq 0 (
    echo.
    echo Build failed. Last lines from "%LOG%":
    echo.
    powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 40"
    echo.
    >>"%LOG%" echo ERROR: package failed errorlevel=!errorlevel!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Done. Installer and portable .exe are in the "dist" folder.
echo ============================================================
>>"%LOG%" echo DONE
if exist "dist" explorer "dist"
pause
exit /b 0

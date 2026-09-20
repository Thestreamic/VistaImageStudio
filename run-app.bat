@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Vista Image Studio - Setup and Launch

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

REM Strip Mark of the Web from this folder so Windows does not silently block launch
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~f0' -ErrorAction SilentlyContinue; Get-ChildItem -LiteralPath '%~dp0' -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>nul

set "LOG=%~dp0run-app.log"
> "%LOG%" echo ===== %DATE% %TIME% =====
>>"%LOG%" echo script=%~f0
>>"%LOG%" echo cwd=%CD%
>>"%LOG%" echo cmdline=%cmdcmdline%

REM Prefer the real Node install even in stripped app environments
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
set "npm_config_devdir="

echo ============================================================
echo   Vista Image Studio - One-Click Setup and Launch
echo ============================================================
echo.
echo   Log: "%LOG%"
echo.

REM ── 1. Check for Node.js, install silently if missing ─────────────────
where.exe node >nul 2>nul
if %errorlevel% neq 0 (
    echo [1/4] Node.js not found. Downloading installer...
    >>"%LOG%" echo [1/4] Node.js missing, downloading...
    set "NODE_MSI=%TEMP%\vista-node-installer.msi"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi' -OutFile '%NODE_MSI%'"
    if not exist "%NODE_MSI%" (
        echo.
        echo   Could not download Node.js automatically.
        echo   Please install it manually from https://nodejs.org ^(LTS version^)
        echo   then re-run this script.
        >>"%LOG%" echo ERROR: Node.js download failed
        pause
        exit /b 1
    )
    echo       Installing Node.js LTS silently, this takes a minute...
    msiexec /i "%NODE_MSI%" /qn /norestart
    del "%NODE_MSI%" >nul 2>nul
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    where.exe node >nul 2>nul
    if !errorlevel! neq 0 (
        echo.
        echo   Node.js was installed but is not on PATH yet.
        echo   Close this window, open a new Command Prompt, and run this script again.
        >>"%LOG%" echo ERROR: Node.js installed but not on PATH
        pause
        exit /b 1
    )
) else (
    echo [1/4] Node.js found:
)
for /f "delims=" %%V in ('node -v') do set "NODE_VER=%%V"
echo       %NODE_VER%
>>"%LOG%" echo [1/4] node=%NODE_VER%

REM ── 2. Verify npm came with it ──────────────────────────────────────────
where.exe npm.cmd >nul 2>nul
if %errorlevel% neq 0 (
    echo   npm.cmd not found even though Node.js is installed. Reinstall Node.js from https://nodejs.org
    >>"%LOG%" echo ERROR: npm.cmd not found
    pause
    exit /b 1
)
echo [2/4] npm version:
for /f "delims=" %%V in ('npm.cmd -v') do set "NPM_VER=%%V"
echo       %NPM_VER%
>>"%LOG%" echo [2/4] npm=%NPM_VER%

REM ── 3. Install project dependencies (first run only) ────────────────────
if not exist "node_modules" (
    echo [3/4] Installing dependencies - first run only, a few minutes...
    >>"%LOG%" echo [3/4] npm.cmd install
    call npm.cmd install
    if !errorlevel! neq 0 (
        echo.
        echo   npm install failed. See the errors above and "%LOG%"
        >>"%LOG%" echo ERROR: npm install failed
        pause
        exit /b 1
    )
    >>"%LOG%" echo [3/4] npm install ok
) else (
    echo [3/4] Dependencies already installed. Skipping.
    >>"%LOG%" echo [3/4] node_modules present
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo       Electron binary missing - downloading now...
    >>"%LOG%" echo electron install.js
    if exist "node_modules\electron\install.js" (
        call node "node_modules\electron\install.js"
        if !errorlevel! neq 0 (
            echo Electron failed to download. Delete node_modules and re-run this script.
            >>"%LOG%" echo ERROR: electron install.js failed
            pause
            exit /b 1
        )
    ) else (
        echo Electron is not installed. Delete node_modules and re-run this script.
        >>"%LOG%" echo ERROR: electron package missing
        pause
        exit /b 1
    )
)

REM ── 4. Launch the app in dev mode (renderer + Electron shell) ───────────
echo [4/4] Stopping leftover Next.js / Electron from a previous run...
>>"%LOG%" echo [4/4] stop leftover next/electron
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-leftover-dev.ps1" >>"%LOG%" 2>&1
timeout /t 1 /nobreak >nul

echo       Launching Vista Image Studio...
echo.
>>"%LOG%" echo [4/4] npm.cmd run dev:electron
call npm.cmd run dev:electron
set "APP_EXIT=!errorlevel!"
>>"%LOG%" echo [4/4] exit=!APP_EXIT!

echo.
if not "!APP_EXIT!"=="0" (
    echo Vista Image Studio exited with error code !APP_EXIT!.
    echo See "%LOG%"
) else (
    echo Vista Image Studio closed.
)
echo.
pause
exit /b !APP_EXIT!

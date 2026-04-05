@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                                                           ║
echo  ║   🌊  Kai-san Complete Auto Setup                         ║
echo  ║                                                           ║
echo  ║   This PC has NOTHING? No problem.                        ║
echo  ║   Everything installs automatically.                      ║
echo  ║                                                           ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

set "LOG=%USERPROFILE%\kai-san-setup.log"
echo [%date% %time%] Kai-san setup started > "%LOG%"

set INSTALLED=
set FAILED=

:: ═══════════════════════════════════════════════════════════
:: 0. WINGET — Windows Package Manager
:: ═══════════════════════════════════════════════════════════

echo [ 1/12] Checking winget (Windows Package Manager)...
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 winget not found. Installing via Microsoft Store...
    echo   If this fails, please install "App Installer" from Microsoft Store.
    powershell -Command "Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe" >nul 2>&1
    timeout /t 5 /nobreak >nul
    winget --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo   ❌ winget unavailable. Please install "App Installer" from Microsoft Store.
        echo   https://apps.microsoft.com/detail/9NBLGGH4NNS1
        echo   Then run this setup.bat again.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('winget --version 2^>nul') do echo   ✅ winget %%v

:: ═══════════════════════════════════════════════════════════
:: 1. GIT
:: ═══════════════════════════════════════════════════════════

echo [ 2/12] Checking Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 Installing Git...
    winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements --silent >> "%LOG%" 2>&1
    set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin"
    set "INSTALLED=!INSTALLED! Git"
    echo   ✅ Git installed
) else (
    for /f "tokens=*" %%v in ('git --version 2^>nul') do echo   ✅ %%v
)

:: ═══════════════════════════════════════════════════════════
:: 2. PYTHON
:: ═══════════════════════════════════════════════════════════

echo [ 3/12] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 Installing Python 3.12...
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent >> "%LOG%" 2>&1
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
    set "INSTALLED=!INSTALLED! Python"
    echo   ✅ Python installed
) else (
    for /f "tokens=*" %%v in ('python --version 2^>nul') do echo   ✅ %%v
)

:: ═══════════════════════════════════════════════════════════
:: 3. NODE.JS + NPM
:: ═══════════════════════════════════════════════════════════

echo [ 4/12] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 Installing Node.js LTS...
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent >> "%LOG%" 2>&1
    set "PATH=%PATH%;C:\Program Files\nodejs"
    set "INSTALLED=!INSTALLED! Node.js"
    echo   ✅ Node.js + npm installed
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo   ✅ Node.js %%v
)

:: ═══════════════════════════════════════════════════════════
:: 4. CLAUDE CODE CLI
:: ═══════════════════════════════════════════════════════════

echo [ 5/12] Checking Claude Code...
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 Installing Claude Code CLI...
    call npm install -g @anthropic-ai/claude-code >> "%LOG%" 2>&1
    if !errorlevel! equ 0 (
        set "INSTALLED=!INSTALLED! Claude"
        echo   ✅ Claude Code installed
    ) else (
        echo   ⚠️ Claude Code install failed. Will retry after restart.
        set "FAILED=!FAILED! Claude"
    )
) else (
    echo   ✅ Claude Code found
)

:: ═══════════════════════════════════════════════════════════
:: 5. OLLAMA (Local LLM)
:: ═══════════════════════════════════════════════════════════

echo [ 6/12] Checking Ollama...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 Installing Ollama...
    winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements --silent >> "%LOG%" 2>&1
    set "INSTALLED=!INSTALLED! Ollama"
    echo   ✅ Ollama installed
) else (
    echo   ✅ Ollama found
)

:: ═══════════════════════════════════════════════════════════
:: 6. GOOGLE CLOUD CLI (for Gmail)
:: ═══════════════════════════════════════════════════════════

echo [ 7/12] Checking Google Cloud CLI...
where gcloud >nul 2>&1
if %errorlevel% neq 0 (
    echo   📦 Installing Google Cloud CLI...
    winget install -e --id Google.CloudSDK --accept-source-agreements --accept-package-agreements --silent >> "%LOG%" 2>&1
    if !errorlevel! equ 0 (
        set "INSTALLED=!INSTALLED! GCloud"
        echo   ✅ Google Cloud CLI installed
    ) else (
        echo   ⚠️ Google CLI skipped (optional)
    )
) else (
    echo   ✅ Google Cloud CLI found
)

:: ═══════════════════════════════════════════════════════════
:: 7. CLONE KAI-SAN REPO
:: ═══════════════════════════════════════════════════════════

echo [ 8/12] Cloning Kai-san...
set "KAISANDIR=%USERPROFILE%\kai-san"
if exist "%KAISANDIR%\.git" (
    echo   📥 Updating existing kai-san...
    cd /d "%KAISANDIR%"
    git pull >> "%LOG%" 2>&1
    echo   ✅ kai-san updated
) else (
    echo   📥 Cloning kai-san (100MB)...
    git clone https://github.com/osamumiyashita/kai-san-jpr.git "%KAISANDIR%" >> "%LOG%" 2>&1
    if !errorlevel! equ 0 (
        set "INSTALLED=!INSTALLED! kai-san"
        echo   ✅ kai-san cloned
    ) else (
        echo   ❌ Clone failed. Check network and GitHub access.
        set "FAILED=!FAILED! clone"
    )
)

:: ═══════════════════════════════════════════════════════════
:: 8. PYTHON PACKAGES
:: ═══════════════════════════════════════════════════════════

echo [ 9/12] Installing Python packages...
python -m pip install --upgrade pip >> "%LOG%" 2>&1
python -m pip install duckdb cryptography requests xlwings janome numpy pandas scipy >> "%LOG%" 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Python packages installed
) else (
    echo   ⚠️ Some packages may have failed. Check log.
)

:: ═══════════════════════════════════════════════════════════
:: 9. NPM INSTALL (kai-san-chat)
:: ═══════════════════════════════════════════════════════════

echo [10/12] Installing kai-san-chat dependencies...
if exist "%KAISANDIR%\.claude\kai-san-chat\package.json" (
    cd /d "%KAISANDIR%\.claude\kai-san-chat"
    call npm install >> "%LOG%" 2>&1
    echo   ✅ kai-san-chat packages installed
) else (
    echo   ⚠️ kai-san-chat not found. Skipping npm install.
)

:: ═══════════════════════════════════════════════════════════
:: 10. HTTPS CERTS
:: ═══════════════════════════════════════════════════════════

echo [11/12] Setting up HTTPS certs...
if exist "%KAISANDIR%\.claude\kai-san-chat\setup-certs.bat" (
    cd /d "%KAISANDIR%\.claude\kai-san-chat"
    call setup-certs.bat >> "%LOG%" 2>&1
    echo   ✅ HTTPS certs ready
) else (
    echo   ⚠️ setup-certs.bat not found. Skipping.
)

:: ═══════════════════════════════════════════════════════════
:: 11. OLLAMA MODEL
:: ═══════════════════════════════════════════════════════════

echo [12/12] Pulling Ollama model...
where ollama >nul 2>&1
if %errorlevel% equ 0 (
    echo   📦 Pulling gemma3:4b (free local LLM)...
    start /b ollama serve >nul 2>&1
    timeout /t 3 /nobreak >nul
    ollama pull gemma3:4b >> "%LOG%" 2>&1
    if !errorlevel! equ 0 (
        echo   ✅ gemma3:4b ready
    ) else (
        echo   ⚠️ Model pull failed. Run "ollama pull gemma3:4b" later.
    )
) else (
    echo   ⚠️ Ollama not in PATH yet. Restart and run "ollama pull gemma3:4b"
)

:: ═══════════════════════════════════════════════════════════
:: LICENSE KEY
:: ═══════════════════════════════════════════════════════════

echo.
echo  ════════════════════════════════════════════════════
echo.
set /p "LICENSEKEY=  🔑 License Key (paste from email, or press Enter to skip): "
if not "%LICENSEKEY%"=="" (
    echo %LICENSEKEY%> "%KAISANDIR%\.claude\kai-san-chat\license.key"
    echo   ✅ License key saved
) else (
    echo   ⏭️  No key entered. Enter it later in kai-san-chat.
)

:: ═══════════════════════════════════════════════════════════
:: CREATE DESKTOP SHORTCUT
:: ═══════════════════════════════════════════════════════════

echo.
echo   Creating desktop shortcut...
powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\Desktop\Kai-san.lnk'); $SC.TargetPath = '%KAISANDIR%\.claude\kai-san-chat\start.bat'; $SC.WorkingDirectory = '%KAISANDIR%\.claude\kai-san-chat'; $SC.Description = 'Start Kai-san Chat'; $SC.Save()" >nul 2>&1
echo   ✅ "Kai-san" shortcut on Desktop

:: ═══════════════════════════════════════════════════════════
:: SUMMARY
:: ═══════════════════════════════════════════════════════════

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║  ✅ Setup Complete!                                       ║
echo  ╠═══════════════════════════════════════════════════════════╣
if defined INSTALLED (
echo  ║  Installed: %INSTALLED%
)
if defined FAILED (
echo  ║  ⚠️ Failed: %FAILED%
echo  ║  → Restart terminal, then run setup.bat again
)
echo  ║                                                           ║
echo  ║  ⚡ IMPORTANT: Restart this terminal first!               ║
echo  ║     (PATH needs to refresh for new tools)                 ║
echo  ║                                                           ║
echo  ║  Then:                                                    ║
echo  ║    1. Double-click "Kai-san" on Desktop                   ║
echo  ║       → Browser opens kai-san-chat                        ║
echo  ║    2. Or: claude                                          ║
echo  ║       → Login with Anthropic account                      ║
echo  ║                                                           ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.
echo  Log: %LOG%
echo.

echo [%date% %time%] Setup completed >> "%LOG%"
echo   Installed: %INSTALLED% >> "%LOG%"
echo   Failed: %FAILED% >> "%LOG%"

pause

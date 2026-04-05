@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   Kai-san 自動セットアップ
echo   J-Phoenix Research Inc.
echo ============================================================
echo.
echo   所要時間: 約5〜10分
echo   あとは自動で進みます。エラーが出たら画面を修さんに送ってください。
echo.

set PASS=0
set FAIL=0
set SKIP=0
set TOTAL=8

:: ============================================================
:: 容量チェック
:: ============================================================
echo [準備] ディスク容量を確認中...
for /f "tokens=3" %%a in ('dir %SystemDrive%\ ^| findstr /C:"bytes free"') do set FREE=%%a
echo   空き容量: %FREE% bytes
echo.

:: ============================================================
:: [1/8] Git
:: ============================================================
echo [1/%TOTAL%] Git を確認中...
git --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('git --version') do echo   ✓ 既にインストール済み: %%v
    set /a SKIP+=1
) else (
    echo   ✗ 未インストール — wingetでインストールします...
    winget install Git.Git --accept-package-agreements --accept-source-agreements >nul 2>&1
    if !errorlevel!==0 (
        echo   ✓ Git インストール完了
        set /a PASS+=1
    ) else (
        echo   ✗ 自動インストール失敗。手動で https://git-scm.com/download/win からインストールしてください。
        set /a FAIL+=1
    )
)
echo.

:: ============================================================
:: [2/8] Node.js
:: ============================================================
echo [2/%TOTAL%] Node.js を確認中...
node --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('node --version') do echo   ✓ 既にインストール済み: %%v
    set /a SKIP+=1
) else (
    echo   ✗ 未インストール — wingetでインストールします...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements >nul 2>&1
    if !errorlevel!==0 (
        echo   ✓ Node.js インストール完了
        set /a PASS+=1
    ) else (
        echo   ✗ 自動インストール失敗。手動で https://nodejs.org/ からLTS版をインストールしてください。
        set /a FAIL+=1
    )
)
echo.

:: ============================================================
:: [3/8] Python
:: ============================================================
echo [3/%TOTAL%] Python を確認中...
python --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('python --version') do echo   ✓ 既にインストール済み: %%v
    set /a SKIP+=1
) else (
    echo   ✗ 未インストール — wingetでインストールします...
    winget install Python.Python.3.13 --accept-package-agreements --accept-source-agreements >nul 2>&1
    if !errorlevel!==0 (
        echo   ✓ Python インストール完了
        echo   ※ コマンドプロンプトを開き直すと認識されます
        set /a PASS+=1
    ) else (
        echo   ✗ 自動インストール失敗。
        echo     手動: https://python.org/downloads/ → ★「Add python.exe to PATH」に必ずチェック★
        set /a FAIL+=1
    )
)
echo.

:: ============================================================
:: [4/8] Claude CLI
:: ============================================================
echo [4/%TOTAL%] Claude CLI を確認中...
claude --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('claude --version') do echo   ✓ 既にインストール済み: %%v
    set /a SKIP+=1
) else (
    echo   ✗ 未インストール — npmでインストールします...
    npm --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo   ✗ npmが見つかりません。Node.js を先にインストールしてください。
        set /a FAIL+=1
    ) else (
        npm install -g @anthropic-ai/claude-code >nul 2>&1
        if !errorlevel!==0 (
            echo   ✓ Claude CLI インストール完了
            set /a PASS+=1
        ) else (
            echo   ✗ インストール失敗。管理者として実行してください。
            set /a FAIL+=1
        )
    )
)
echo.

:: ============================================================
:: [5/8] pip ライブラリ
:: ============================================================
echo [5/%TOTAL%] pip ライブラリ（duckdb, cryptography）を確認中...
python -c "import duckdb; import cryptography" >nul 2>&1
if %errorlevel%==0 (
    echo   ✓ 既にインストール済み
    set /a SKIP+=1
) else (
    echo   インストール中...
    pip install duckdb cryptography >nul 2>&1
    if !errorlevel!==0 (
        echo   ✓ ライブラリ インストール完了
        set /a PASS+=1
    ) else (
        echo   ✗ インストール失敗。python / pip が認識されていない可能性があります。
        set /a FAIL+=1
    )
)
echo.

:: ============================================================
:: [6/8] Ollama
:: ============================================================
echo [6/%TOTAL%] Ollama を確認中...（オプション）
ollama --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('ollama --version') do echo   ✓ 既にインストール済み: %%v
    set /a SKIP+=1
) else (
    echo   ✗ 未インストール — wingetでインストールします...
    winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements >nul 2>&1
    if !errorlevel!==0 (
        echo   ✓ Ollama インストール完了
        set /a PASS+=1
    ) else (
        echo   △ 自動インストール失敗（オプションなので続行します）
        echo     手動: https://ollama.com/download
        set /a SKIP+=1
    )
)
echo.

:: ============================================================
:: [7/8] GoGCLI
:: ============================================================
echo [7/%TOTAL%] GoGCLI を確認中...（オプション）
if exist "%USERPROFILE%\gogcli\gog.exe" (
    echo   ✓ 既にインストール済み: %USERPROFILE%\gogcli\gog.exe
    set /a SKIP+=1
) else (
    echo   △ 未インストール（オプション）
    echo     修さんからgog.exeを受け取り、%USERPROFILE%\gogcli\ に配置してください。
    if not exist "%USERPROFILE%\gogcli" mkdir "%USERPROFILE%\gogcli"
    echo     フォルダを作成しました: %USERPROFILE%\gogcli\
    set /a SKIP+=1
)
echo.

:: ============================================================
:: [8/8] git clone — Kai-san本体
:: ============================================================
echo [8/%TOTAL%] Kai-san 本体を確認中...
if exist "%USERPROFILE%\.claude\rules\kai-constitution.md" (
    echo   ✓ 既にインストール済み。最新版に更新します...
    cd /d "%USERPROFILE%\.claude"
    git pull >nul 2>&1
    if !errorlevel!==0 (
        echo   ✓ 最新版に更新完了
    ) else (
        echo   △ 更新失敗（ローカル変更がある可能性）
    )
    set /a SKIP+=1
) else (
    echo   インストール中（git clone）...
    git clone https://github.com/osamumiyashita/jpr-home-claude-source.git "%USERPROFILE%\.claude" 2>&1
    if !errorlevel!==0 (
        echo   ✓ Kai-san インストール完了！
        set /a PASS+=1
    ) else (
        echo   ✗ インストール失敗。
        echo     確認事項:
        echo       1. GitHubの招待メールで「Accept invitation」をクリックしましたか？
        echo       2. インターネットに接続されていますか？
        echo       3. 修さん（miyashita@j-phoenix.com）に連絡してください
        set /a FAIL+=1
    )
)
echo.

:: ============================================================
:: 結果サマリー
:: ============================================================
echo ============================================================
echo   セットアップ結果
echo ============================================================
echo.
echo   新規インストール: %PASS% 件
echo   既にインストール済: %SKIP% 件
echo   失敗:             %FAIL% 件
echo.

if %FAIL%==0 (
    echo   ============================================
    echo   ✓ セットアップ完了！
    echo   ============================================
    echo.
    echo   次のステップ:
    echo     1. コマンドプロンプトを閉じて開き直す
    echo     2. claude login でログイン
    echo     3. claude で起動 → Kai-sanが応答します
    echo.
) else (
    echo   ============================================
    echo   △ 一部失敗がありました
    echo   ============================================
    echo.
    echo   画面のスクリーンショットを修さんに送ってください。
    echo   miyashita@j-phoenix.com
    echo.
)

echo   J-Phoenix Research Inc.
echo   miyashita@j-phoenix.com
echo.
pause

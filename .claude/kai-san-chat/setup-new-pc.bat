@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Kai-san セットアップ — 新規PC用 (Windows 11)
echo   GitHubアカウントがあるだけの状態から全部入れます
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: ============================================================
:: Step 1: Git インストール
:: ============================================================
echo [1/7] Git をインストールしています...
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   → Git は既にインストール済みです
    git --version
) else (
    echo   → winget で Git をインストールします
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ winget失敗。手動でインストールしてください: https://git-scm.com/download/win
        pause
        exit /b 1
    )
    echo   → Git インストール完了。PATHを反映するためにこのバッチを再実行してください。
    echo   → 一度このウィンドウを閉じて、もう一度 setup-new-pc.bat を実行してください。
    pause
    exit /b 0
)

:: ============================================================
:: Step 2: Node.js インストール (kai-san-chat用)
:: ============================================================
echo.
echo [2/7] Node.js をインストールしています...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   → Node.js は既にインストール済みです
    node --version
) else (
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ winget失敗。手動: https://nodejs.org/
        pause
        exit /b 1
    )
    echo   → Node.js インストール完了。再実行が必要です。
    pause
    exit /b 0
)

:: ============================================================
:: Step 3: Python インストール (hooks/PF用)
:: ============================================================
echo.
echo [3/7] Python をインストールしています...
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   → Python は既にインストール済みです
    python --version
) else (
    winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ winget失敗。手動: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo   → Python インストール完了。再実行が必要です。
    pause
    exit /b 0
)

:: ============================================================
:: Step 4: Ollama インストール (ローカルLLM、Layer 1用)
:: ============================================================
echo.
echo [4/7] Ollama をインストールしています...
where ollama >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   → Ollama は既にインストール済みです
    ollama --version
) else (
    winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ winget失敗。手動: https://ollama.com/download
        pause
        exit /b 1
    )
    echo   → Ollama インストール完了。再実行が必要です。
    pause
    exit /b 0
)

:: ============================================================
:: Step 5: Claude Code CLI インストール
:: ============================================================
echo.
echo [5/7] Claude Code CLI をインストールしています...
where claude >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   → Claude Code は既にインストール済みです
    claude --version
) else (
    echo   → npm で Claude Code をインストールします
    npm install -g @anthropic-ai/claude-code
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ npm install失敗。Node.jsが正しくインストールされているか確認してください。
        pause
        exit /b 1
    )
    echo   → Claude Code インストール完了
)

:: ============================================================
:: Step 6: GitHub認証 + リポジトリ clone
:: ============================================================
echo.
echo [6/7] GitHubにログインしてリポジトリをcloneします...

:: GitHub CLI (gh) インストール
where gh >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   → GitHub CLI をインストールします
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ winget失敗。手動: https://cli.github.com/
        pause
        exit /b 1
    )
    echo   → GitHub CLI インストール完了。再実行が必要です。
    pause
    exit /b 0
)

:: GitHub認証チェック
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   ★ GitHubにログインしてください。ブラウザが開きます。
    echo   ★ 「Login with a web browser」を選んでEnterを押してください。
    echo.
    gh auth login --web --git-protocol https
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ ログイン失敗。もう一度試してください。
        pause
        exit /b 1
    )
)
echo   → GitHub認証OK

:: .claude をclone
set CLAUDE_DIR=%USERPROFILE%\.claude
if exist "%CLAUDE_DIR%\.git" (
    echo   → %CLAUDE_DIR% は既にclone済みです
) else (
    echo   → .claude リポジトリをcloneします...
    if exist "%CLAUDE_DIR%" (
        echo   → 既存の .claude フォルダをバックアップします
        ren "%CLAUDE_DIR%" ".claude.bak.%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%"
    )
    git clone https://github.com/osamumiyashita/jpr-home-claude-source.git "%CLAUDE_DIR%"
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ clone失敗。GitHubの認証を確認してください。
        pause
        exit /b 1
    )
    echo   → .claude clone完了
)

:: kai-san-chat をclone
set KSC_DIR=%CLAUDE_DIR%\kai-san-chat
if exist "%KSC_DIR%\.git" (
    echo   → kai-san-chat は既にclone済みです
) else (
    echo   → kai-san-chat リポジトリをcloneします...
    git clone https://github.com/osamumiyashita/kai-san-chat.git "%KSC_DIR%"
    if !ERRORLEVEL! NEQ 0 (
        echo   ★ clone失敗。
        pause
        exit /b 1
    )
    echo   → kai-san-chat clone完了
)

:: ============================================================
:: Step 7: 依存関係インストール + Ollamaモデル取得
:: ============================================================
echo.
echo [7/7] 依存関係をインストールしています...

:: kai-san-chat の npm install
echo   → kai-san-chat の npm install...
cd /d "%KSC_DIR%"
call npm install
echo   → npm install完了

:: Python依存 (あれば)
echo   → Python依存パッケージをインストール...
pip install duckdb janome xlwings 2>nul
echo   → pip install完了

:: Ollama モデル取得
echo   → Ollama モデルをダウンロードします (数分かかります)...
echo   → qwen2.5:7b (日本語対応、Layer 1用)
ollama pull qwen2.5:7b
echo   → Ollama モデル取得完了

:: ============================================================
:: 完了
:: ============================================================
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   セットアップ完了！
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   インストール済み:
echo     [x] Git
echo     [x] Node.js
echo     [x] Python
echo     [x] Ollama + qwen2.5:7b
echo     [x] Claude Code CLI
echo     [x] GitHub CLI
echo.
echo   リポジトリ:
echo     [x] %CLAUDE_DIR%  (jpr-home-claude-source)
echo     [x] %KSC_DIR%     (kai-san-chat)
echo.
echo   次のステップ:
echo     1. Claude Code を起動:  claude
echo        → ブラウザでAnthropicにログイン (初回のみ)
echo     2. kai-san-chat を起動: %KSC_DIR%\start.bat
echo.
echo   ★ Claude MAXプランが必要です (定額、従量課金なし)
echo.
pause

@echo off
chcp 65001 >/dev/null
title Kai-san Deploy — JPR
echo ============================================
echo   Kai-san Deploy (JPR)
echo   git clone → ~/.claude/ → 完了
echo ============================================
echo.

git --version >/dev/null 2>&1 || (
    echo [ERROR] Gitがインストールされていません
    echo https://git-scm.com/download/win からインストールしてください
    pause
    exit /b 1
)

if exist "%USERPROFILE%\.claude\.git" (
    echo [UPDATE] 既存環境を更新中...
    cd /d "%USERPROFILE%\.claude"
    git pull origin main
    echo [OK] 更新完了
) else (
    echo [INSTALL] 新規デプロイ中...
    git clone -b main https://github.com/osamumiyashita/jpr-home-claude-source.git "%USERPROFILE%\.claude"
    echo [OK] デプロイ完了
)

echo.
echo ============================================
echo   完了！ Claudeを起動すればKai-sanが動きます
echo ============================================
pause

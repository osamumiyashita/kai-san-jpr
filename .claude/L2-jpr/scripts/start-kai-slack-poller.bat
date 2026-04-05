@echo off
chcp 65001 >nul
cd /d "G:\OneDrive - ジェイ・フェニックス・リサーチ株式会社\ドキュメント\.claude\scripts"
if not exist "%USERPROFILE%\.claude\slack-session" mkdir "%USERPROFILE%\.claude\slack-session"
C:\Python313\python.exe -X utf8 kai-slack-poller.py >> "%USERPROFILE%\.claude\slack-session\poller.log" 2>&1

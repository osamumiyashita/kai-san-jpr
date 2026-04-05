@echo off
chcp 65001 >nul
echo.
echo  🌊 Kai-san Installer
echo  Downloading setup...
echo.
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/osamumiyashita/kai-san-jpr/master/setup.bat' -OutFile '%TEMP%\kai-setup.bat'"
if exist "%TEMP%\kai-setup.bat" (
    echo  ✅ Downloaded. Starting setup...
    call "%TEMP%\kai-setup.bat"
) else (
    echo  ❌ Download failed. Check internet connection.
    pause
)

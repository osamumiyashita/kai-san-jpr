@echo off
chcp 65001 >/dev/null 2>&1
call "C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvarsall.bat" x64 >/dev/null 2>&1
echo ENV_LOADED
where cl.exe

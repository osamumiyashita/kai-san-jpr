@echo off
chcp 65001 >/dev/null 2>&1
call "C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvarsall.bat" x64 >/dev/null 2>&1
if errorlevel 1 (
    echo ERROR: vcvarsall failed
    exit /b 1
)
echo VS18 Insiders environment loaded
where cl.exe 2>/dev/null
echo ---

cd /d "C:\Users\宮下修\.claude\kai-san-chat\corpus"
echo === Building corpus_config ===
python -c "from setuptools import setup; from Cython.Build import cythonize; setup(ext_modules=cythonize('corpus_config.py', compiler_directives={'language_level': '3'}), script_args=['build_ext', '--inplace'])" 2>&1
echo RESULT=%errorlevel%
echo ---
dir *.pyd 2>/dev/null

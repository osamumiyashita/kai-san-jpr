#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cython_build.py — Cython ビルドスクリプト（VS環境直接設定版）
VS18 Insiders の cl.exe を直接参照してビルドする。
"""
import subprocess
import os
import sys
import io
import shutil
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HOME = Path(os.path.expanduser("~"))
GOD_DIR = HOME / ".claude" / "kai-san-chat"
HUMAN_DIR = HOME / "kai-san" / ".claude" / "kai-san-chat"


def find_msvc():
    """Find MSVC compiler and set environment."""
    # Try VS18 Insiders first
    vs_bases = [
        Path("C:/Program Files/Microsoft Visual Studio/18/Insiders"),
        Path("C:/Program Files/Microsoft Visual Studio/2022/Enterprise"),
        Path("C:/Program Files (x86)/Microsoft Visual Studio/2019/BuildTools"),
    ]

    for vs in vs_bases:
        msvc_dir = vs / "VC" / "Tools" / "MSVC"
        if not msvc_dir.exists():
            continue
        versions = sorted(msvc_dir.iterdir(), reverse=True)
        if not versions:
            continue
        msvc = versions[0]
        cl = msvc / "bin" / "Hostx64" / "x64" / "cl.exe"
        if cl.exists():
            print(f"Found cl.exe: {cl}")
            return msvc, vs
    return None, None


def setup_env(msvc_path, vs_path):
    """Set up environment variables for MSVC compilation."""
    env = os.environ.copy()

    # Windows SDK
    sdk_base = Path("C:/Program Files (x86)/Windows Kits/10")
    sdk_versions = sorted(
        [d.name for d in (sdk_base / "Include").iterdir() if d.is_dir()],
        reverse=True
    )
    sdk_ver = sdk_versions[0] if sdk_versions else "10.0.19041.0"
    print(f"SDK version: {sdk_ver}")

    msvc_str = str(msvc_path)
    sdk_str = str(sdk_base)

    # PATH
    extra_paths = [
        os.path.join(msvc_str, "bin", "Hostx64", "x64"),
        os.path.join(sdk_str, "bin", sdk_ver, "x64"),
    ]
    env["PATH"] = ";".join(extra_paths) + ";" + env["PATH"]

    # INCLUDE
    env["INCLUDE"] = ";".join([
        os.path.join(msvc_str, "include"),
        os.path.join(sdk_str, "Include", sdk_ver, "ucrt"),
        os.path.join(sdk_str, "Include", sdk_ver, "shared"),
        os.path.join(sdk_str, "Include", sdk_ver, "um"),
        os.path.join(sdk_str, "Include", sdk_ver, "winrt"),
    ])

    # LIB
    env["LIB"] = ";".join([
        os.path.join(msvc_str, "lib", "x64"),
        os.path.join(sdk_str, "Lib", sdk_ver, "ucrt", "x64"),
        os.path.join(sdk_str, "Lib", sdk_ver, "um", "x64"),
    ])

    # KEY: Tell setuptools to use SDK environment as-is (skip vswhere detection)
    env["DISTUTILS_USE_SDK"] = "1"
    env["MSSdk"] = "1"

    return env


def build_one(py_file, dest_dir, env):
    """Compile one .py -> .pyd"""
    if not py_file.exists():
        print(f"  SKIP: {py_file.name} not found")
        return False

    module = py_file.stem
    work_dir = py_file.parent

    # Use a temp directory for build to avoid polluting God dir
    import tempfile
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"cython_{module}_"))
    tmp_src = tmp_dir / py_file.name
    shutil.copy2(py_file, tmp_src)

    # Write setup.py in tmp
    setup_content = (
        "from setuptools import setup, Extension\n"
        "from Cython.Build import cythonize\n"
        f"setup(ext_modules=cythonize('{py_file.name}', "
        "compiler_directives={'language_level': '3'}), "
        "script_args=['build_ext', '--inplace'])\n"
    )
    setup_file = tmp_dir / f"_setup_{module}.py"
    setup_file.write_text(setup_content, encoding="utf-8")

    try:
        result = subprocess.run(
            [sys.executable, str(setup_file)],
            capture_output=True, text=True,
            cwd=str(tmp_dir), env=env, timeout=120
        )

        if result.returncode != 0:
            print(f"  ERROR: {result.stderr[-300:]}")
            return False

        # Find .pyd in tmp dir
        for pyd in tmp_dir.glob(f"{module}*.pyd"):
            dest_dir.mkdir(parents=True, exist_ok=True)
            dst = dest_dir / pyd.name
            shutil.copy2(pyd, dst)
            print(f"  OK: {py_file.name} -> {dst.name}")
            return True

        print(f"  WARNING: No .pyd produced for {module}")
        return False

    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT: {py_file.name}")
        return False
    finally:
        # Clean tmp dir entirely (safe - it's in TEMP)
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    print("=== Cython Build: God -> Human (.pyd) ===\n")

    msvc, vs = find_msvc()
    if not msvc:
        print("ERROR: No MSVC compiler found")
        sys.exit(1)

    env = setup_env(msvc, vs)

    # Verify cl.exe works
    cl_path = msvc / "bin" / "Hostx64" / "x64" / "cl.exe"
    result = subprocess.run([str(cl_path)], capture_output=True, text=True, env=env)
    if "Microsoft" not in (result.stderr or ""):
        print(f"ERROR: cl.exe not working: {result.stderr[:200]}")
        sys.exit(1)
    print("cl.exe verified OK\n")

    targets = [
        (GOD_DIR / "corpus" / "corpus_config.py", HUMAN_DIR / "corpus"),
        (GOD_DIR / "corpus" / "build_all.py", HUMAN_DIR / "corpus"),
        (GOD_DIR / "corpus" / "build_company.py", HUMAN_DIR / "corpus"),
        (GOD_DIR / "corpus" / "build_corpus.py", HUMAN_DIR / "corpus"),
        (GOD_DIR / "corpus" / "query_corpus.py", HUMAN_DIR / "corpus"),
        (GOD_DIR / "corpus" / "encrypt_corpus.py", HUMAN_DIR / "corpus"),
        (GOD_DIR / "slack_search_github.py", HUMAN_DIR),
        (HUMAN_DIR / "security" / "guardian.py", HUMAN_DIR / "security"),
    ]

    ok = 0
    ng = 0
    for src, dst in targets:
        print(f"[BUILD] {src.name}")
        if build_one(src, dst, env):
            ok += 1
        else:
            ng += 1

    print(f"\nDone: {ok} success / {ng} fail")


if __name__ == "__main__":
    main()

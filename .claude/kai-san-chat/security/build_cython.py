#!/usr/bin/env python3
"""
build_cython.py — Cython ビルドスクリプト
VS2019 BuildTools を使って .py → .pyd に変換
"""
import subprocess, sys, os, shutil
from pathlib import Path

HOME = Path(os.path.expanduser("~"))
GOD_DIR = HOME / ".claude" / "kai-san-chat"
HUMAN_DIR = HOME / "kai-san" / ".claude" / "kai-san-chat"

VCVARSALL = r"C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"

# Files to compile
TARGETS = [
    GOD_DIR / "corpus" / "build_all.py",
    GOD_DIR / "corpus" / "build_company.py",
    GOD_DIR / "corpus" / "build_corpus.py",
    GOD_DIR / "corpus" / "corpus_config.py",
    GOD_DIR / "corpus" / "query_corpus.py",
    GOD_DIR / "corpus" / "encrypt_corpus.py",
    GOD_DIR / "slack_search_github.py",
]

def build_one(py_file: Path, dest_dir: Path):
    """Compile a single .py to .pyd"""
    if not py_file.exists():
        print(f"  SKIP (not found): {py_file.name}")
        return False

    module = py_file.stem
    work_dir = py_file.parent

    # Write temp setup.py
    setup_py = work_dir / f"_setup_{module}.py"
    setup_py.write_text(f"""
from setuptools import setup, Extension
from Cython.Build import cythonize
setup(
    ext_modules=cythonize(
        Extension("{module}", [r"{py_file}"]),
        compiler_directives={{"language_level": "3"}},
    ),
    script_args=["build_ext", "--inplace"],
)
""", encoding="utf-8")

    # Build command with VS environment
    cmd = f'call "{VCVARSALL}" x64 >/dev/null 2>&1 && cd /d "{work_dir}" && python "{setup_py}" 2>&1'

    try:
        result = subprocess.run(
            ["cmd", "/c", cmd],
            capture_output=True, text=True, timeout=120,
            cwd=str(work_dir),
        )
        print(f"  stdout: {result.stdout[-200:]}" if result.stdout else "  (no stdout)")
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr[-300:]}")
            return False

        # Find and move .pyd
        for pyd in work_dir.glob(f"{module}*.pyd"):
            dst = dest_dir / pyd.name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(pyd, dst)
            pyd.unlink()  # Clean from source
            print(f"  ✅ {py_file.name} → {dst.name}")
            return True

        print(f"  WARNING: No .pyd found for {module}")
        return False

    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT: {py_file.name}")
        return False
    finally:
        # Cleanup
        setup_py.unlink(missing_ok=True)
        for ext in [".c", ".html"]:
            c = (work_dir / module).with_suffix(ext)
            c.unlink(missing_ok=True) if c.exists() else None
        # Clean build/ dir
        build_dir = work_dir / "build"
        if build_dir.exists():
            shutil.rmtree(build_dir, ignore_errors=True)


def main():
    print("=== Cython Build: 神 → 暗号人間 (.pyd) ===\n")

    if not Path(VCVARSALL).exists():
        print(f"ERROR: VS Build Tools not found at {VCVARSALL}")
        sys.exit(1)

    success = 0
    fail = 0

    for target in TARGETS:
        rel = target.relative_to(GOD_DIR)
        dest = HUMAN_DIR / rel.parent
        print(f"[BUILD] {rel}")
        if build_one(target, dest):
            success += 1
        else:
            fail += 1

    # Also build guardian.py → .pyd
    guardian = HUMAN_DIR / "security" / "guardian.py"
    if guardian.exists():
        print(f"[BUILD] security/guardian.py")
        if build_one(guardian, HUMAN_DIR / "security"):
            success += 1
            # Remove source guardian.py after successful compile
            # guardian.py.unlink()  # Uncomment when confirmed working
        else:
            fail += 1

    print(f"\n完了: {success} success / {fail} fail")


if __name__ == "__main__":
    main()

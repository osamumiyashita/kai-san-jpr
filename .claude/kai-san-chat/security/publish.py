#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish.py — 神PC → 暗号人間 変換パイプライン
==================================================
神 (~/.claude/kai-san-chat/) の平文ファイルを
暗号人間 (~/kai-san/.claude/kai-san-chat/) に変換する。

処理:
  1. .py  → Cython コンパイル → .pyd (ソース消滅)
  2. .md  → Fernet 暗号化 → .md.enc
  3. .duckdb → Fernet 暗号化 → .duckdb.enc
  4. .js/.html/.css → そのままコピー (フロントエンドは平文)
  5. .pem/.json → 除外 (PC固有、配布しない)

使い方:
  python publish.py                    # 全ビルド
  python publish.py --encrypt-only     # 暗号化のみ (Cythonスキップ)
  python publish.py --cython-only      # Cythonのみ
  python publish.py --status           # 状態確認
  python publish.py --clean            # 暗号人間をクリーンアップ

依存:
  pip install cryptography cython
  Visual Studio Build Tools (Cython用)
"""

import sys
import os
import io
import shutil
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ═══════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════

HOME = Path(os.path.expanduser("~"))

# 神 (source of truth, 平文)
GOD_DIR = HOME / ".claude" / "kai-san-chat"

# 暗号人間 (destination, encrypted)
HUMAN_DIR = HOME / "kai-san" / ".claude" / "kai-san-chat"

# セキュリティ
SECURITY_DIR = HUMAN_DIR / "security"
KEY_FILE = SECURITY_DIR / ".publish_key"
MANIFEST_FILE = HUMAN_DIR / "manifest.json"

# ═══════════════════════════════════════════════════════════════
# FERNET ENCRYPTION
# ═══════════════════════════════════════════════════════════════

try:
    from cryptography.fernet import Fernet
    HAS_FERNET = True
except ImportError:
    HAS_FERNET = False
    print("WARNING: cryptography not installed. pip install cryptography")


def get_or_create_key() -> bytes:
    """Get existing Fernet key or create a new one."""
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes().strip()
    key = Fernet.generate_key()
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    KEY_FILE.write_bytes(key)
    print(f"  New publish key created: {KEY_FILE}")
    return key


def encrypt_file(src: Path, dst: Path, fernet: "Fernet") -> int:
    """Encrypt a single file. Returns encrypted size."""
    data = src.read_bytes()
    encrypted = fernet.encrypt(data)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(encrypted)
    return len(encrypted)


# ═══════════════════════════════════════════════════════════════
# CYTHON COMPILATION
# ═══════════════════════════════════════════════════════════════

def setup_vs_env():
    """Activate Visual Studio Build Tools environment."""
    vcvars = Path(r"C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat")
    if not vcvars.exists():
        # Try Build Tools
        vcvars = Path(r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat")
    if not vcvars.exists():
        print("  ERROR: Visual Studio Build Tools not found")
        return False
    return True


def cython_compile(py_file: Path, output_dir: Path) -> bool:
    """Compile a .py file to .pyd via Cython."""
    import subprocess
    import tempfile

    # Create a temporary setup.py
    module_name = py_file.stem
    setup_content = f"""
from setuptools import setup
from Cython.Build import cythonize

setup(
    ext_modules=cythonize(
        r"{py_file.as_posix()}",
        compiler_directives={{'language_level': '3'}},
    ),
    script_args=['build_ext', '--inplace'],
)
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, dir=str(py_file.parent)) as f:
        f.write(setup_content)
        setup_py = f.name

    try:
        # Run cython compilation
        result = subprocess.run(
            [sys.executable, setup_py],
            capture_output=True, text=True,
            cwd=str(py_file.parent),
            timeout=120
        )
        if result.returncode != 0:
            print(f"  ERROR compiling {py_file.name}: {result.stderr[:200]}")
            return False

        # Find the generated .pyd file
        for f in py_file.parent.glob(f"{module_name}*.pyd"):
            dst = output_dir / f.name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)
            f.unlink()  # Clean up from source dir
            print(f"  + {py_file.name} -> {dst.name} (Cython compiled)")
            return True

        # Also check for .so (Linux/Mac)
        for f in py_file.parent.glob(f"{module_name}*.so"):
            dst = output_dir / f.name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)
            f.unlink()
            print(f"  + {py_file.name} -> {dst.name} (Cython compiled)")
            return True

        print(f"  WARNING: No .pyd generated for {py_file.name}")
        return False

    finally:
        # Clean up temp files
        os.unlink(setup_py)
        for ext in ['.c', '.html']:
            c_file = py_file.with_suffix(ext)
            if c_file.exists():
                c_file.unlink()


# ═══════════════════════════════════════════════════════════════
# FILE CLASSIFICATION
# ═══════════════════════════════════════════════════════════════

# 除外パターン (神にだけ存在すべきもの)
EXCLUDE_PATTERNS = {
    "node_modules", ".git", "__pycache__", "chat-history",
    "deploy.cache.json", "key.pem", "cert.pem", "cert.pfx",
    "deploy.json", "package-lock.json", ".corpus_key",
    ".bak.", "kai-chat.log",
}

# Cython対象 (.py → .pyd)
CYTHON_TARGETS = {
    # corpus/ Python files
    "build_all.py", "build_company.py", "build_corpus.py",
    "corpus_config.py", "query_corpus.py", "encrypt_corpus.py",
    # security/ Python files
    "guardian.py", "license_check.py",
    # root Python files
    "slack_search_github.py",
}

# 暗号化対象 (.md/.duckdb → .enc)
ENCRYPT_EXTENSIONS = {".md", ".duckdb"}

# 平文コピー対象 (フロントエンド)
PLAINTEXT_EXTENSIONS = {".js", ".html", ".css", ".json", ".ico", ".bat", ".sh", ".vbs", ".yml"}

# 平文コピー必須ファイル (起動に必要)
PLAINTEXT_MUST_COPY = {
    "server.js", "chat-api.js", "navigator-api.js", "deploy.js",
    "feedback-api.js", "fs-api.js", "pty-handler.js", "rpa-api.js",
    "view-api.js", "package.json", "start.bat", "start.sh",
    "start-hidden.vbs", "setup-new-pc.bat", "kai.ico", "DEPLOY.md",
}


def should_exclude(filepath: Path) -> bool:
    """Check if file should be excluded."""
    name = filepath.name
    parts = filepath.parts
    for pattern in EXCLUDE_PATTERNS:
        if pattern in name or pattern in parts:
            return True
    return False


def classify_file(filepath: Path) -> str:
    """Classify file: 'cython' | 'encrypt' | 'copy' | 'skip'"""
    if should_exclude(filepath):
        return "skip"

    name = filepath.name
    ext = filepath.suffix.lower()

    # Already encrypted files → skip
    if name.endswith(".enc"):
        return "skip"

    # Cython targets
    if name in CYTHON_TARGETS and ext == ".py":
        return "cython"

    # Encrypt targets
    if ext in ENCRYPT_EXTENSIONS:
        return "encrypt"

    # Plaintext copy
    if ext in PLAINTEXT_EXTENSIONS or name in PLAINTEXT_MUST_COPY:
        return "copy"

    # publish.py itself → skip (stays in security/)
    if name == "publish.py":
        return "skip"

    return "skip"


# ═══════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════

def collect_god_files() -> list[tuple[Path, str]]:
    """Collect all files from 神 with classification."""
    results = []
    for f in GOD_DIR.rglob("*"):
        if f.is_dir():
            continue
        classification = classify_file(f)
        if classification != "skip":
            results.append((f, classification))
    return sorted(results, key=lambda x: x[0].name)


def compute_relative(filepath: Path) -> Path:
    """Get path relative to GOD_DIR."""
    return filepath.relative_to(GOD_DIR)


def publish_all(encrypt_only=False, cython_only=False):
    """Main publish pipeline: 神 → 暗号人間"""
    print("=" * 60)
    print("publish.py — 神 → 暗号人間 変換パイプライン")
    print("=" * 60)
    print(f"  神:     {GOD_DIR}")
    print(f"  人間:   {HUMAN_DIR}")
    print(f"  時刻:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    if not GOD_DIR.exists():
        print("ERROR: 神ディレクトリが見つかりません")
        sys.exit(1)

    files = collect_god_files()
    print(f"対象ファイル: {len(files)} 件")
    print()

    # Initialize Fernet
    fernet = None
    if not cython_only:
        if not HAS_FERNET:
            print("ERROR: pip install cryptography")
            sys.exit(1)
        key = get_or_create_key()
        fernet = Fernet(key)

    manifest = {
        "published_at": datetime.now().isoformat(),
        "god_dir": str(GOD_DIR),
        "files": {},
    }

    stats = {"cython": 0, "encrypt": 0, "copy": 0, "skip": 0, "error": 0}

    for filepath, action in files:
        rel = compute_relative(filepath)

        if action == "cython" and not encrypt_only:
            print(f"[CYTHON] {rel}")
            dst_dir = HUMAN_DIR / rel.parent
            success = cython_compile(filepath, dst_dir)
            if success:
                stats["cython"] += 1
                manifest["files"][str(rel)] = "cython"
            else:
                stats["error"] += 1
                # Fallback: encrypt the .py instead
                print(f"  FALLBACK: encrypting {rel} instead")
                dst = HUMAN_DIR / (str(rel) + ".enc")
                encrypt_file(filepath, dst, fernet)
                stats["encrypt"] += 1
                manifest["files"][str(rel)] = "encrypt-fallback"

        elif action == "encrypt" and not cython_only:
            dst = HUMAN_DIR / (str(rel) + ".enc")
            size = encrypt_file(filepath, dst, fernet)
            print(f"[ENCRYPT] {rel} -> {rel}.enc ({size // 1024}KB)")
            stats["encrypt"] += 1
            manifest["files"][str(rel)] = "encrypted"

        elif action == "copy" and not cython_only:
            dst = HUMAN_DIR / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(filepath, dst)
            print(f"[COPY]    {rel}")
            stats["copy"] += 1
            manifest["files"][str(rel)] = "plaintext"

    # Write manifest
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print("=" * 60)
    print(f"完了!")
    print(f"  Cython:  {stats['cython']} files")
    print(f"  暗号化:  {stats['encrypt']} files")
    print(f"  コピー:  {stats['copy']} files")
    print(f"  エラー:  {stats['error']} files")
    print(f"  マニフェスト: {MANIFEST_FILE}")
    print(f"  鍵: {KEY_FILE}")
    print("=" * 60)


def show_status():
    """Show current state of 暗号人間."""
    print("=== 暗号人間 状態 ===\n")

    if not HUMAN_DIR.exists():
        print("暗号人間ディレクトリが存在しません")
        return

    enc_count = len(list(HUMAN_DIR.rglob("*.enc")))
    pyd_count = len(list(HUMAN_DIR.rglob("*.pyd")))
    js_count = len(list(HUMAN_DIR.rglob("*.js")))
    py_count = len(list(HUMAN_DIR.rglob("*.py")))
    html_count = len(list(HUMAN_DIR.rglob("*.html")))

    print(f"  .enc (暗号化):     {enc_count}")
    print(f"  .pyd (Cython):     {pyd_count}")
    print(f"  .js  (平文):       {js_count}")
    print(f"  .html (平文):      {html_count}")
    print(f"  .py  (平文Python): {py_count}  ← これは0が理想")
    print(f"  鍵:  {'あり' if KEY_FILE.exists() else 'なし'}")

    if MANIFEST_FILE.exists():
        m = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
        print(f"  最終publish: {m.get('published_at', 'unknown')}")

    # Security check: .py files should not exist in human dir
    if py_count > 1:  # publish.py itself is OK
        print(f"\n  ⚠️  WARNING: {py_count} .py files found in 暗号人間!")
        print("  平文Pythonはセキュリティリスクです。Cythonビルドを確認してください。")


def clean():
    """Clean 暗号人間 (keep structure, remove files)."""
    print("暗号人間をクリーンアップ中...")
    for f in HUMAN_DIR.rglob("*"):
        if f.is_file() and f.name != "publish.py":
            f.unlink()
            print(f"  - {f}")
    print("Done.")


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="神 → 暗号人間 変換パイプライン")
    parser.add_argument("--encrypt-only", action="store_true", help="暗号化のみ (Cythonスキップ)")
    parser.add_argument("--cython-only", action="store_true", help="Cythonのみ")
    parser.add_argument("--status", action="store_true", help="状態確認")
    parser.add_argument("--clean", action="store_true", help="暗号人間をクリーンアップ")
    args = parser.parse_args()

    if args.status:
        show_status()
    elif args.clean:
        clean()
    else:
        publish_all(
            encrypt_only=args.encrypt_only,
            cython_only=args.cython_only,
        )


if __name__ == "__main__":
    main()

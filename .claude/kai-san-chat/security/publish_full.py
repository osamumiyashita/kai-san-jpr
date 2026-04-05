#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish_full.py — 神 ~/.claude/ → 人間 ~/kai-san/.claude/ 完全変換
==================================================
5層(A-E)の分類に従い、神の全資産を暗号人間に変換する。

Usage:
  python publish_full.py                        # 全Layer (A-E) をOsamu向けに構築
  python publish_full.py --target client         # クライアント向け (A,C,D,E)
  python publish_full.py --target employee       # 社員向け (A,B,C,D,E)
  python publish_full.py --status                # 状態確認
  python publish_full.py --encrypt-only          # 暗号化のみ (Cythonスキップ)
"""

import sys
import os
import io
import shutil
import argparse
import json
import fnmatch
from pathlib import Path
from datetime import datetime

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HOME = Path(os.path.expanduser("~"))
GOD = HOME / ".claude"
HUMAN = HOME / "kai-san" / ".claude"
SECURITY = HUMAN / "kai-san-chat" / "security"
KEY_FILE = SECURITY / ".publish_key"

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("ERROR: pip install cryptography")
    sys.exit(1)


def get_key():
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes().strip()
    key = Fernet.generate_key()
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    KEY_FILE.write_bytes(key)
    return key


def encrypt_and_copy(src: Path, dst_dir: Path, fernet, suffix=".enc"):
    """Encrypt src → dst_dir/name.enc"""
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / (src.name + suffix)
    data = src.read_bytes()
    dst.write_bytes(fernet.encrypt(data))
    return dst


def copy_plain(src: Path, dst_dir: Path):
    """Copy file as-is."""
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    shutil.copy2(src, dst)
    return dst


def should_skip(name):
    """Files to always skip."""
    skips = {
        "__pycache__", ".git", "node_modules", ".bak.",
        "deploy.cache.json", ".corpus_key", ".publish_key",
        ".license", ".tamper_log.json", ".guardian_state.json",
    }
    for s in skips:
        if s in name:
            return True
    return False


def match_patterns(name, patterns):
    """Check if name matches any glob pattern."""
    for p in patterns:
        if fnmatch.fnmatch(name, p):
            return True
    return False


def process_folder(god_folder, human_folder, fernet, include=None,
                   include_pattern=None, include_all=False, stats=None):
    """
    Process a single folder: encrypt .md/.duckdb, compile .py concept,
    copy .js/.html/.css/.json.
    """
    if stats is None:
        stats = {"enc": 0, "copy": 0, "skip": 0}

    src = GOD / god_folder
    if not src.exists():
        print(f"  SKIP (not found): {god_folder}")
        return stats

    for item in sorted(src.rglob("*")):
        if item.is_dir():
            continue
        if should_skip(str(item)):
            stats["skip"] += 1
            continue

        rel = item.relative_to(src)
        name = rel.name

        # Filter by include list
        if not include_all:
            if include and name not in include and str(rel) not in include:
                # Check if parent folder is included
                parent_match = False
                for inc in (include or []):
                    if inc.endswith("/") and str(rel).startswith(inc):
                        parent_match = True
                        break
                if not parent_match:
                    if include_pattern:
                        if not match_patterns(name, include_pattern):
                            stats["skip"] += 1
                            continue
                    else:
                        stats["skip"] += 1
                        continue

        dst_dir = HUMAN / god_folder / rel.parent
        ext = item.suffix.lower()

        # Decide action
        if ext in (".md", ".duckdb"):
            encrypt_and_copy(item, dst_dir, fernet)
            print(f"  [ENC] {god_folder}/{rel}")
            stats["enc"] += 1
        elif ext == ".py":
            # .py → encrypt (Cython build is separate step)
            encrypt_and_copy(item, dst_dir, fernet)
            print(f"  [ENC] {god_folder}/{rel}")
            stats["enc"] += 1
        elif ext in (".js", ".html", ".css", ".json", ".bat", ".sh",
                      ".vbs", ".ps1", ".ico", ".yml", ".yaml", ".jsonl"):
            copy_plain(item, dst_dir)
            print(f"  [CPY] {god_folder}/{rel}")
            stats["copy"] += 1
        else:
            # Unknown ext → encrypt to be safe
            encrypt_and_copy(item, dst_dir, fernet)
            print(f"  [ENC] {god_folder}/{rel} (unknown ext)")
            stats["enc"] += 1

    return stats


def create_empty_folders(folders):
    """Create Layer E empty folders."""
    for folder in folders:
        path = HUMAN / folder
        path.mkdir(parents=True, exist_ok=True)
        # Create .gitkeep
        gitkeep = path / ".gitkeep"
        if not gitkeep.exists():
            gitkeep.write_text("")
        print(f"  [DIR] {folder}/")


def build_layer_a(fernet, stats):
    """Layer A: JPR Meta — common to all."""
    print("\n" + "=" * 50)
    print("LAYER A: JPR Meta (全員共通)")
    print("=" * 50)

    # Rules (specific files)
    a_rules = [
        "gcc-guideline.md", "concept-registry.md", "hccp-rule.md",
        "coding-style.md", "security.md", "a4-print-css-mandatory.md",
        "flex-fit-page-mandatory.md", "html-minimal-radius.md",
        "patterns.md", "testing.md", "performance.md", "git-workflow.md",
        "hooks.md", "agents.md", "GLOBAL_RULES.md",
        "ksc-natural-language-layer.md", "prompt-composition-theorem.md",
        "strategic-navigator.md", "ksc-navigator-spec.md",
        "x-onboarding-process.md",
    ]
    process_folder("rules", "rules", fernet, include=a_rules, stats=stats)

    # Commands (patterns)
    a_cmd_patterns = [
        "tse-ir-*", "rate.md", "html*.md", "pdf-*.md", "plan.md",
        "verify*.md", "check-quarterly.md", "create-ir*.md",
        "analyze-market.md", "edinet-*.md", "kabutan-*.md",
        "duck-*.md", "what-next.md", "goal-prompt.md",
    ]
    process_folder("commands", "commands", fernet, include_pattern=a_cmd_patterns, stats=stats)

    # Skills (all)
    process_folder("skills", "skills", fernet, include_all=True, stats=stats)

    # Core agents
    a_agents = ["quality-san.md", "data-team-san.md", "wacc-ai.md"]
    process_folder("agents", "agents", fernet, include=a_agents, stats=stats)

    # Core hooks
    a_hooks = [
        "user-prompt-unified.py", "session-start-fx.py",
        "what-next-trigger.py", "four-zero-gate.py",
        "security-gate.py", "confidentiality-gate.py",
        "safety-backup-check.py", "session-logger.ps1",
    ]
    process_folder("hooks", "hooks", fernet, include=a_hooks, stats=stats)

    # Core py/
    a_py = [
        "build/a4_css_pf.py", "calc/", "search/", "validate/",
        "sync/claude_clean.py", "kai_paths.py", "registry.json",
    ]
    process_folder("py", "py", fernet, include=a_py, stats=stats)


def build_layer_b(fernet, stats):
    """Layer B: JPR Specific — employees + agencies only."""
    print("\n" + "=" * 50)
    print("LAYER B: JPR Specific (社員+代理店)")
    print("=" * 50)

    # 海憲法 rules
    b_rules = [
        "kai-constitution.md", "kai-constitution-dispatch.md",
        "kai-unified-memory.md", "kai-memory-strategy.md",
        "supreme-rules.md", "duckdb-queue-control.md",
        "nittoc-ir-collaboration.md", "jpr-master-file-gateway.md",
        "dropbox-access-control.md", "claude-source-of-truth.md",
        "memory-ttl-enforcement.md", "memory-auto-decrypt.md",
        "edinet-code-format.md", "session-recording.md",
        "abbreviations.md", "layer-quality-gate.md",
        "superpowers-kai-bridge.md", "_index.md",
        "knowledge/",
    ]
    process_folder("rules", "rules", fernet, include=b_rules, stats=stats)

    # JPR-internal commands
    b_cmd_patterns = [
        "kai*.md", "claude-clean.md", "session-*.md", "auto-save*.md",
        "dispatch-*.md", "consolidate-*.md", "3what*.md",
        "slack*.md", "resize-*.md", "folder-search.md",
        "obsidian-*.md", "fresh-restart.md", "done.md", "pf-health.md",
    ]
    process_folder("commands", "commands", fernet, include_pattern=b_cmd_patterns, stats=stats)

    # JPR agents
    b_agents = [
        "nittoc-san.md", "integrated-report-san.md", "ir-report-san.md",
        "haba-san.md", "sentinel-dag.md", "slack-agent.md",
    ]
    process_folder("agents", "agents", fernet, include=b_agents, stats=stats)

    # JPR hooks (remaining)
    b_hooks = [
        "bash-guard.py", "bus-queue-write.py", "gogcli-trigger.py",
        "quarterly-freshness-trigger.py", "neural-fire.py.bak.20260329",
        "kc-display-enforcer.py", "memory-first-detector.py",
        "monolith-guard.py", "pf-architecture-check.py",
        "rules-size-guard.py", "self-preservation-killer.py",
        "session-start-bus.py", "session-start-env-detect.py",
        "session-start-slack.py",
    ]
    process_folder("hooks", "hooks", fernet, include=b_hooks, stats=stats)

    # bash-force
    process_folder("bash-force", "bash-force", fernet, include_all=True, stats=stats)

    # L2-jpr
    process_folder("L2-jpr", "L2-jpr", fernet, include_all=True, stats=stats)

    # Internal py/ folders
    b_py = ["batch/", "chat/", "detect/", "hooks/", "neural/",
            "rpa/", "sales/", "sync/"]
    process_folder("py", "py", fernet, include=b_py, stats=stats)


def build_layer_c(fernet, stats):
    """Layer C: Shared Data — EDINET all-company, common data."""
    print("\n" + "=" * 50)
    print("LAYER C: Shared Data (全クライアント共通)")
    print("=" * 50)

    # edinet_all.duckdb is already in kai-san-chat/corpus/ (from publish.py)
    # Here we handle overlays/meta and any other shared data
    process_folder("kai-san-chat/overlays/meta", "kai-san-chat/overlays/meta",
                   fernet, include_all=True, stats=stats)


def build_layer_d(fernet, stats):
    """Layer D: Client-specific data."""
    print("\n" + "=" * 50)
    print("LAYER D: Client Data (クライアント固有)")
    print("=" * 50)

    # Company DuckDBs are already in kai-san-chat/corpus/companies/ (from publish.py)
    # Here we handle any additional client-specific overlays
    src = GOD / "kai-san-chat" / "overlays" / "client-dispatch" / "personas"
    if src.exists():
        process_folder("kai-san-chat/overlays/client-dispatch/personas",
                       "kai-san-chat/overlays/client-dispatch/personas",
                       fernet, include_all=True, stats=stats)
    else:
        print("  (No client personas yet)")


def build_layer_e(stats):
    """Layer E: PC-specific empty folders."""
    print("\n" + "=" * 50)
    print("LAYER E: PC-Local (空フォルダ)")
    print("=" * 50)

    folders = [
        "kai-san-chat/overlays/client-dispatch/brain",
        "kai-san-chat/overlays/client-dispatch/input",
        "kai-san-chat/overlays/client-dispatch/output",
        "memory",
        "projects",
        "sessions",
        "cache",
    ]
    create_empty_folders(folders)


def create_claude_md(target):
    """Create minimal CLAUDE.md for human environment."""
    content = f"""# Kai-san (海) — 暗号人間環境
# Generated: {datetime.now().isoformat()}
# Target: {target}

## This is NOT 神. This is the encrypted human simulation.

All .md.enc files: decrypt with vault.pyd
All .duckdb.enc files: decrypt with encrypt_corpus.pyd
All .py are compiled to .pyd (Cython binary, no source)

## Startup
Run: kai-san-chat/start.bat

## License
License file: kai-san-chat/security/.license
Guardian: kai-san-chat/security/guardian.pyd
"""
    dst = HUMAN / "CLAUDE.md"
    dst.write_text(content, encoding="utf-8")
    print(f"\n  [CLAUDE.md] created for target={target}")


def main():
    parser = argparse.ArgumentParser(description="神→人間 完全変換 (5層)")
    parser.add_argument("--target", default="osamu",
                        choices=["osamu", "employee", "agency", "client"],
                        help="配布先 (default: osamu)")
    parser.add_argument("--encrypt-only", action="store_true")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()

    if args.status:
        print("=== 暗号人間 状態 ===")
        enc = len(list(HUMAN.rglob("*.enc")))
        pyd = len(list(HUMAN.rglob("*.pyd")))
        py = len([f for f in HUMAN.rglob("*.py") if "security" not in str(f)])
        md = len(list(HUMAN.rglob("*.md")))
        print(f"  .enc: {enc}, .pyd: {pyd}, .py(risk): {py}, .md(plain): {md}")
        return

    print("=" * 60)
    print(f"publish_full.py — 神 → 暗号人間 (target: {args.target})")
    print(f"  神:   {GOD}")
    print(f"  人間: {HUMAN}")
    print(f"  時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    key = get_key()
    fernet = Fernet(key)
    stats = {"enc": 0, "copy": 0, "skip": 0}

    # Determine which layers to build
    layer_map = {
        "osamu":    ["A", "B", "C", "D", "E"],
        "employee": ["A", "B", "C", "D", "E"],
        "agency":   ["A", "B", "C", "D", "E"],
        "client":   ["A", "C", "D", "E"],
    }
    layers = layer_map[args.target]

    if "A" in layers:
        build_layer_a(fernet, stats)
    if "B" in layers:
        build_layer_b(fernet, stats)
    if "C" in layers:
        build_layer_c(fernet, stats)
    if "D" in layers:
        build_layer_d(fernet, stats)
    if "E" in layers:
        build_layer_e(stats)

    create_claude_md(args.target)

    # Write manifest
    manifest = {
        "target": args.target,
        "layers": layers,
        "published_at": datetime.now().isoformat(),
        "stats": stats,
    }
    manifest_path = HUMAN / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"完了! (target: {args.target})")
    print(f"  暗号化: {stats['enc']} files")
    print(f"  コピー: {stats['copy']} files")
    print(f"  スキップ: {stats['skip']} files")
    print(f"  Layers: {', '.join(layers)}")
    print("=" * 60)


if __name__ == "__main__":
    main()

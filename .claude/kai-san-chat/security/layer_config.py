#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
layer_config.py — 5層分類定義
==================================================
神の ~/.claude/ を A-E の5層に分類する。

A: JPR Meta        — GCC/MVC/SG100Y フレームワーク（全員共通）
B: JPR Specific    — JPR内部ツール（社員+代理店のみ、クライアント不要）
C: JPR→全Client   — EDINET全社/FactSet等（全クライアント共通データ）
D: JPR→特定Client — 個社EDINET DuckDB, Enterprise DB（クライアント固有）
E: PC-Specific     — 空フォルダ。各PCで自動生成される

配布マトリクス:
  Osamu (MSI kai-san): A,B,C,D,E（全部。但し神ではない）
  JPR社員:             A,B,C,D + E(空)
  JPR代理店:           A,B,C,D(代理店担当分) + E(空)
  クライアント:        A,C,D(自社分) + E(空)
"""

from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# Layer A: JPR Meta — 全員が受け取る共通フレームワーク
# ═══════════════════════════════════════════════════════════════

LAYER_A = {
    "name": "meta",
    "description": "GCC/MVC/SG100Y framework — common to ALL",
    "recipients": ["osamu", "employee", "agency", "client"],
    "folders": {
        # Rules (GCC, coding, security — not JPR-internal)
        "rules": {
            "include": [
                "gcc-guideline.md",
                "concept-registry.md",
                "hccp-rule.md",
                "coding-style.md",
                "security.md",
                "a4-print-css-mandatory.md",
                "flex-fit-page-mandatory.md",
                "html-minimal-radius.md",
                "patterns.md",
                "testing.md",
                "performance.md",
                "git-workflow.md",
                "hooks.md",
                "agents.md",
                "GLOBAL_RULES.md",
                "ksc-natural-language-layer.md",
                "prompt-composition-theorem.md",
                "strategic-navigator.md",
                "ksc-navigator-spec.md",
                "x-onboarding-process.md",
            ],
        },
        # Commands (client-facing)
        "commands": {
            "include_pattern": [
                "tse-ir-*",          # IR評価系
                "rate.md",           # SG100Y評価
                "html*.md",          # HTML生成系
                "pdf-*.md",          # PDF変換系
                "plan.md",           # 計画
                "verify*.md",        # 検証
                "check-quarterly.md",
                "create-ir*.md",     # IR作成
                "analyze-market.md",
                "edinet-*.md",       # EDINET系
                "kabutan-*.md",      # 株探系
                "duck-*.md",         # DuckDB操作
                "what-next.md",
                "goal-prompt.md",
            ],
        },
        # Skills (client-facing)
        "skills": {
            "include_all": True,  # All skills are meta
        },
        # Core py/ Pure Functions
        "py": {
            "include": [
                "build/a4_css_pf.py",
                "calc/wacc_calculator.py",
                "calc/mvc_calculator.py",
                "calc/four_zero_decomposer.py",
                "calc/pf_fisher_rao.py",
                "calc/pf_riemannian_sgd.py",
                "calc/pf_symplectic_mvc.py",
                "calc/pf_typed_chain.py",
                "search/fire10.py",
                "search/engine_v2.py",
                "validate/html_validator.py",
                "sync/claude_clean.py",
                "kai_paths.py",
                "registry.json",
            ],
        },
        # Agents (client-facing only)
        "agents": {
            "include": [
                "quality-san.md",
                "data-team-san.md",
                "wacc-ai.md",
            ],
        },
        # Hooks (core functionality)
        "hooks": {
            "include": [
                "user-prompt-unified.py",
                "session-start-fx.py",
                "what-next-trigger.py",
                "four-zero-gate.py",
                "security-gate.py",
                "confidentiality-gate.py",
                "safety-backup-check.py",
                "session-logger.ps1",
            ],
        },
    },
    "encryption": "fernet",  # .md → .md.enc, .py → .pyd
}

# ═══════════════════════════════════════════════════════════════
# Layer B: JPR Specific — JPR社員と代理店のみ
# ═══════════════════════════════════════════════════════════════

LAYER_B = {
    "name": "jpr",
    "description": "JPR internal tools — employees and agencies only",
    "recipients": ["osamu", "employee", "agency"],
    "folders": {
        "rules": {
            "include": [
                # 海憲法（内部運用）
                "kai-constitution.md",
                "kai-constitution-dispatch.md",
                "kai-unified-memory.md",
                "kai-memory-strategy.md",
                "supreme-rules.md",
                "duckdb-queue-control.md",
                "nittoc-ir-collaboration.md",
                "jpr-master-file-gateway.md",
                "dropbox-access-control.md",
                "claude-source-of-truth.md",
                "memory-ttl-enforcement.md",
                "memory-auto-decrypt.md",
                "edinet-code-format.md",
                "session-recording.md",
                "abbreviations.md",
                "layer-quality-gate.md",
                "superpowers-kai-bridge.md",
                "_index.md",
                # knowledge/
                "knowledge/",  # All 101 docs
            ],
        },
        "commands": {
            "include_pattern": [
                "kai*.md",           # Kai管理系
                "claude-clean.md",
                "session-*.md",
                "auto-save*.md",
                "dispatch-*.md",
                "consolidate-*.md",
                "what-i-did*.md",
                "3what*.md",
                "slack*.md",
                "resize-*.md",
                "folder-search.md",
                "obsidian-*.md",
                "fresh-restart.md",
                "done.md",
                "pf-health.md",
            ],
        },
        "agents": {
            "include": [
                "nittoc-san.md",
                "integrated-report-san.md",
                "ir-report-san.md",
                "haba-san.md",
                "sentinel-dag.md",
                "slack-agent.md",
                "gmail-*.md",
                "x-blog-*.md",
            ],
        },
        # Internal py/
        "py": {
            "include": [
                "batch/",
                "chat/",
                "detect/",
                "hooks/",
                "moltbook/",
                "neural/",
                "rpa/",
                "sales/",
                "sync/",
            ],
        },
        # bash-force (革命軍)
        "bash-force": {
            "include_all": True,
        },
        # L2-jpr
        "L2-jpr": {
            "include_all": True,
        },
    },
    "encryption": "fernet+cython",
}

# ═══════════════════════════════════════════════════════════════
# Layer C: JPR→全Client共通 — EDINET全社DB等
# ═══════════════════════════════════════════════════════════════

LAYER_C = {
    "name": "shared-data",
    "description": "EDINET all-company data, FactSet — all clients",
    "recipients": ["osamu", "employee", "agency", "client"],
    "folders": {
        "corpus": {
            "include": [
                "edinet_all.duckdb",       # 全社EDINETコーパス
                "corpus_config.py",         # → .pyd
                "query_corpus.py",          # → .pyd
                "encrypt_corpus.py",        # → .pyd
            ],
        },
        "overlays/meta": {
            "include_all": True,           # gcc-framework.md等
        },
    },
    "encryption": "fernet+cython",
    "update_frequency": "daily_auto_clone",
}

# ═══════════════════════════════════════════════════════════════
# Layer D: JPR→特定Client — 個社データ
# ═══════════════════════════════════════════════════════════════

LAYER_D = {
    "name": "client-data",
    "description": "Client-specific EDINET DuckDB, Enterprise DB",
    "recipients": ["osamu", "employee", "agency_per_client", "client_own"],
    "folders": {
        "corpus/companies": {
            "note": "Per-client DuckDB, e.g. 1929_日特建設.duckdb",
            "source": "Generated from G: drive via DuckDB mesh",
            "update_frequency": "every_10_minutes",
            "share_frequency": "daily_auto_clone",
        },
        "overlays/client-dispatch": {
            "include": [
                "personas/",    # Client-specific personas
            ],
        },
    },
    "encryption": "fernet",
}

# ═══════════════════════════════════════════════════════════════
# Layer E: PC-Specific — 各PCで生成
# ═══════════════════════════════════════════════════════════════

LAYER_E = {
    "name": "pc-local",
    "description": "Empty folders, created per PC. Never cloned.",
    "recipients": ["all"],
    "folders": {
        "overlays/client-dispatch/brain":  {"empty": True},
        "overlays/client-dispatch/input":  {"empty": True},
        "overlays/client-dispatch/output": {"empty": True},
        "memory":                          {"empty": True},
        "projects":                        {"empty": True},
        "sessions":                        {"empty": True},
        "cache":                           {"empty": True},
    },
    "encryption": "none",
    "git": "gitignored",
}

# ═══════════════════════════════════════════════════════════════
# Distribution Matrix
# ═══════════════════════════════════════════════════════════════

DISTRIBUTION = {
    "osamu": {
        "layers": ["A", "B", "C", "D", "E"],
        "note": "All layers. ~/kai-san/ is simulation, not 神",
    },
    "employee": {
        "layers": ["A", "B", "C", "D", "E"],
        "license": "employee (永久¥0)",
    },
    "agency": {
        "layers": ["A", "B", "C", "D"],
        "note": "D = agency担当クライアント分のみ",
        "license": "invited (永久¥0)",
    },
    "client": {
        "layers": ["A", "C", "D", "E"],
        "note": "D = 自社分のみ. B(JPR内部)は含まない",
        "license": "trial→paid (月額)",
    },
}

ALL_LAYERS = {
    "A": LAYER_A,
    "B": LAYER_B,
    "C": LAYER_C,
    "D": LAYER_D,
    "E": LAYER_E,
}

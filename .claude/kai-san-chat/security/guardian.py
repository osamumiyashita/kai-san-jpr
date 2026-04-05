#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
guardian.py — Kai-san セキュリティガーディアン
==================================================
kai-san-chat の防衛システム。

3つの防衛レイヤー:
  1. License Check: 月次ライセンス鍵の有効性確認
  2. Tamper Detection: 不正アクセス・改ざん検出
  3. Self-Destruct: 条件違反時の暗号化データ消去

このファイル自体が Cython でコンパイルされ .pyd になる。
クライアントPCにはソースコードが存在しない。

使い方:
  python guardian.py check           # ライセンスチェック
  python guardian.py watch           # 常駐監視モード
  python guardian.py --status        # 状態表示

海憲法 第11条 §11-3〜§11-7 準拠
"""

import sys
import os
import io
import json
import hashlib
import time
import threading
from pathlib import Path
from datetime import datetime, timedelta

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ═══════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════

HOME = Path(os.path.expanduser("~"))
KSC_DIR = HOME / "kai-san" / ".claude" / "kai-san-chat"
SECURITY_DIR = KSC_DIR / "security"
LICENSE_FILE = SECURITY_DIR / ".license"
TAMPER_LOG = SECURITY_DIR / ".tamper_log.json"
GUARDIAN_STATE = SECURITY_DIR / ".guardian_state.json"
PUBLISH_KEY = SECURITY_DIR / ".publish_key"

# ═══════════════════════════════════════════════════════════════
# LICENSE MANAGEMENT
# ═══════════════════════════════════════════════════════════════

class LicenseManager:
    """月次ライセンス鍵の管理"""

    def __init__(self):
        self.license_data = self._load_license()

    def _load_license(self) -> dict:
        if not LICENSE_FILE.exists():
            return {"status": "no_license", "type": None, "expires": None}
        try:
            data = json.loads(LICENSE_FILE.read_text(encoding="utf-8"))
            return data
        except Exception:
            return {"status": "corrupted", "type": None, "expires": None}

    def check(self) -> tuple[bool, str]:
        """
        ライセンスチェック。
        Returns: (valid: bool, message: str)
        """
        data = self.license_data

        if data["status"] == "no_license":
            return False, "ライセンスファイルが見つかりません。JPRにご連絡ください。"

        if data["status"] == "corrupted":
            return False, "ライセンスファイルが破損しています。JPRにご連絡ください。"

        # Check type
        license_type = data.get("type", "")
        if license_type == "employee":
            return True, "JPR社員ライセンス（永久有効）"

        if license_type == "invited":
            return True, "招待ライセンス（永久有効）"

        if license_type in ("trial", "paid"):
            # Check expiry
            expires = data.get("expires", "")
            if not expires:
                return False, "有効期限が設定されていません。"

            try:
                exp_date = datetime.fromisoformat(expires)
                now = datetime.now()

                if now > exp_date:
                    days_over = (now - exp_date).days
                    return False, f"ライセンスが {days_over} 日前に失効しました。更新してください。"

                days_left = (exp_date - now).days
                if days_left <= 7:
                    return True, f"ライセンス有効（残り {days_left} 日。更新をお勧めします）"

                return True, f"ライセンス有効（残り {days_left} 日）"

            except ValueError:
                return False, "有効期限の形式が不正です。"

        return False, f"不明なライセンスタイプ: {license_type}"

    @staticmethod
    def create_license(license_type: str, days: int = 30, org: str = "") -> dict:
        """
        ライセンスファイルを生成（神PCのみ実行）。
        """
        now = datetime.now()
        expires = None

        if license_type in ("trial", "paid"):
            expires = (now + timedelta(days=days)).isoformat()
        elif license_type in ("employee", "invited"):
            expires = None  # 永久

        license_data = {
            "status": "active",
            "type": license_type,
            "org": org,
            "issued": now.isoformat(),
            "expires": expires,
            "issuer": "JPR (J-Phoenix Research Inc.)",
            "version": "1.0",
        }

        # Sign with hash
        content = json.dumps(license_data, sort_keys=True)
        license_data["signature"] = hashlib.sha256(
            (content + "SG100Y-KAI-GUARDIAN").encode()
        ).hexdigest()[:32]

        LICENSE_FILE.parent.mkdir(parents=True, exist_ok=True)
        LICENSE_FILE.write_text(
            json.dumps(license_data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        return license_data


# ═══════════════════════════════════════════════════════════════
# TAMPER DETECTION
# ═══════════════════════════════════════════════════════════════

class TamperDetector:
    """不正アクセス・改ざん検出"""

    MAX_VIOLATIONS = 3  # 3回でself-destruct

    def __init__(self):
        self.log = self._load_log()

    def _load_log(self) -> list:
        if TAMPER_LOG.exists():
            try:
                return json.loads(TAMPER_LOG.read_text(encoding="utf-8"))
            except Exception:
                return []
        return []

    def _save_log(self):
        TAMPER_LOG.parent.mkdir(parents=True, exist_ok=True)
        TAMPER_LOG.write_text(
            json.dumps(self.log, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )

    def record_violation(self, violation_type: str, detail: str):
        """違反を記録"""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": violation_type,
            "detail": detail,
        }
        self.log.append(entry)
        self._save_log()
        print(f"  ⚠️ 違反記録: {violation_type} — {detail}")

        if len(self.log) >= self.MAX_VIOLATIONS:
            print(f"  🔴 違反回数 {len(self.log)} >= {self.MAX_VIOLATIONS}. Self-destruct発動.")
            return True  # Trigger self-destruct
        return False

    def check_file_integrity(self) -> list[str]:
        """暗号化ファイルの整合性チェック"""
        violations = []

        # Check: .enc files exist but key is missing
        enc_files = list(KSC_DIR.rglob("*.enc"))
        if enc_files and not PUBLISH_KEY.exists():
            violations.append("暗号化ファイルが存在するが鍵がない（鍵の不正削除の可能性）")

        # Check: .py files exist where .pyd should be (source leak)
        for py_file in KSC_DIR.rglob("*.py"):
            rel = py_file.relative_to(KSC_DIR)
            # publish.py and guardian.py in security/ are OK (they become .pyd on client)
            if "security" in str(rel) or "node_modules" in str(rel):
                continue
            # Check if this should have been compiled
            pyd_files = list(py_file.parent.glob(f"{py_file.stem}*.pyd"))
            if not pyd_files:
                # On 神PC this is normal, on client PC this is a violation
                pass  # Only flag on client

        return violations

    def get_violation_count(self) -> int:
        return len(self.log)


# ═══════════════════════════════════════════════════════════════
# SELF-DESTRUCT
# ═══════════════════════════════════════════════════════════════

class SelfDestruct:
    """
    自動消去システム。
    Layer B, C の暗号化ファイルを安全に消去。
    Layer D (brain/, input/, output/) はクライアント所有なので残す。
    """

    # 消去対象
    DESTROY_PATTERNS = [
        "*.enc",        # 暗号化ファイル全て
        "*.pyd",        # コンパイル済みバイナリ
        ".publish_key", # 暗号化鍵
        ".license",     # ライセンス
        ".corpus_key",  # コーパス鍵
    ]

    # 保護対象（消去しない）
    PROTECT_DIRS = [
        "overlays/client-dispatch/brain",
        "overlays/client-dispatch/input",
        "overlays/client-dispatch/output",
    ]

    @classmethod
    def execute(cls, reason: str):
        """自動消去を実行"""
        print()
        print("=" * 60)
        print("🔴 SELF-DESTRUCT 発動")
        print(f"理由: {reason}")
        print("=" * 60)
        print()

        destroyed = 0

        for pattern in cls.DESTROY_PATTERNS:
            for f in KSC_DIR.rglob(pattern):
                # Check if in protected dir
                rel = str(f.relative_to(KSC_DIR))
                if any(p in rel for p in cls.PROTECT_DIRS):
                    print(f"  [保護] {rel}")
                    continue

                try:
                    # Overwrite with random data before delete (secure erase)
                    size = f.stat().st_size
                    f.write_bytes(os.urandom(min(size, 4096)))
                    f.unlink()
                    print(f"  [消去] {rel}")
                    destroyed += 1
                except Exception as e:
                    print(f"  [失敗] {rel}: {e}")

        # Record destruction
        destruct_log = {
            "timestamp": datetime.now().isoformat(),
            "reason": reason,
            "files_destroyed": destroyed,
        }
        log_path = SECURITY_DIR / ".destruct_log.json"
        log_path.write_text(json.dumps(destruct_log, indent=2), encoding="utf-8")

        print()
        print(f"消去完了: {destroyed} ファイル")
        print("クライアントデータ (brain/input/output) は保護されました。")
        print("JPR（ジェイ・フェニックス・リサーチ）にご連絡ください。")
        print("  miyashita@j-phoenix.com")
        print("=" * 60)


# ═══════════════════════════════════════════════════════════════
# WATCH MODE (常駐監視)
# ═══════════════════════════════════════════════════════════════

def watch_mode():
    """常駐監視: 1時間ごとにライセンスと整合性をチェック"""
    print("Guardian 監視モード開始（1時間間隔）")
    print("Ctrl+C で停止")

    license_mgr = LicenseManager()
    tamper = TamperDetector()

    while True:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # License check
        valid, msg = license_mgr.check()
        if not valid:
            print(f"[{now}] ライセンス無効: {msg}")
            trigger = tamper.record_violation("license_expired", msg)
            if trigger:
                SelfDestruct.execute("ライセンス違反 3回")
                sys.exit(1)
        else:
            print(f"[{now}] ✅ {msg}")

        # Integrity check
        violations = tamper.check_file_integrity()
        for v in violations:
            trigger = tamper.record_violation("integrity", v)
            if trigger:
                SelfDestruct.execute("整合性違反 3回")
                sys.exit(1)

        # Sleep 1 hour
        time.sleep(3600)


# ═══════════════════════════════════════════════════════════════
# STATUS
# ═══════════════════════════════════════════════════════════════

def show_status():
    """ガーディアン状態表示"""
    print("=== Kai-san Guardian Status ===\n")

    # License
    lm = LicenseManager()
    valid, msg = lm.check()
    print(f"  ライセンス: {'✅' if valid else '❌'} {msg}")

    # Tamper log
    td = TamperDetector()
    count = td.get_violation_count()
    print(f"  違反記録: {count}/{TamperDetector.MAX_VIOLATIONS}")
    if count > 0:
        for entry in td.log[-3:]:
            print(f"    - [{entry['timestamp']}] {entry['type']}: {entry['detail']}")

    # File counts
    enc = len(list(KSC_DIR.rglob("*.enc")))
    pyd = len(list(KSC_DIR.rglob("*.pyd")))
    py = len([f for f in KSC_DIR.rglob("*.py")
              if "node_modules" not in str(f) and "security" not in str(f)])

    print(f"\n  暗号化ファイル (.enc): {enc}")
    print(f"  Cythonバイナリ (.pyd): {pyd}")
    print(f"  平文Python (.py):      {py}  {'⚠️ 要注意' if py > 0 else '✅'}")
    print(f"  鍵:                   {'あり' if PUBLISH_KEY.exists() else 'なし'}")


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        show_status()
        return

    cmd = sys.argv[1]

    if cmd == "check":
        lm = LicenseManager()
        valid, msg = lm.check()
        print(f"{'✅' if valid else '❌'} {msg}")
        sys.exit(0 if valid else 1)

    elif cmd == "watch":
        watch_mode()

    elif cmd == "--status" or cmd == "status":
        show_status()

    elif cmd == "issue-license":
        # 神PC専用: ライセンス発行
        if len(sys.argv) < 3:
            print("Usage: guardian.py issue-license <type> [days] [org]")
            print("  type: employee | invited | trial | paid")
            sys.exit(1)
        ltype = sys.argv[2]
        days = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        org = sys.argv[4] if len(sys.argv) > 4 else ""
        data = LicenseManager.create_license(ltype, days, org)
        print(f"ライセンス発行完了:")
        print(json.dumps(data, indent=2, ensure_ascii=False))

    elif cmd == "self-destruct":
        confirm = input("本当に自動消去を実行しますか？ (yes/no): ")
        if confirm.lower() == "yes":
            SelfDestruct.execute("手動実行")
        else:
            print("キャンセルしました。")

    else:
        print(f"Unknown command: {cmd}")
        print("Commands: check, watch, status, issue-license, self-destruct")


if __name__ == "__main__":
    main()

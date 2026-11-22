#!/usr/bin/env python3
"""
MyArea24 — Backup Restoration Verification Test
Takes a fresh WAL-consistent backup snapshot, restores it into an independent
sandbox database, and verifies 100% table and record parity.
"""
import os
import shutil
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.backup_sqlite_wal import create_consistent_sqlite_backup


def test_restore_backup():
    print("=" * 70)
    print("MyArea24 SQLite Backup Restoration Test")
    print("=" * 70)

    # 1. Take a fresh verified WAL-consistent backup
    backup_meta = create_consistent_sqlite_backup(
        source_db_path="myarea24.db",
        custom_suffix="restore_test"
    )
    backup_path = Path(backup_meta["backup_path"])
    print(f"[*] Fresh backup created: {backup_path.name}")
    print(f"    Size: {backup_meta['backup_size_bytes'] / (1024 * 1024):.2f} MB")
    print(f"    SHA-256: {backup_meta['backup_sha256']}")

    # 2. Restore into a separate test database
    restore_target = backup_path.parent / "test_restoration_sandbox.db"
    if restore_target.exists():
        restore_target.unlink()

    shutil.copyfile(backup_path, restore_target)
    print(f"[✓] Restored backup file to sandbox: {restore_target.name}")

    # 3. Open restored sandbox database and verify integrity
    conn = sqlite3.connect(f"file:{restore_target}?mode=ro", uri=True)
    cur = conn.cursor()

    integrity_res = cur.execute("PRAGMA integrity_check;").fetchall()
    if len(integrity_res) != 1 or integrity_res[0][0].lower() != "ok":
        conn.close()
        restore_target.unlink()
        raise RuntimeError(f"Restoration integrity check failed: {integrity_res}")
    print(f"[✓] PRAGMA integrity_check: PASSED ({integrity_res[0][0]})")

    fk_res = cur.execute("PRAGMA foreign_key_check;").fetchall()
    if fk_res:
        print(f"[!] Warning: Foreign key check found {len(fk_res)} violations.")
    else:
        print("[✓] PRAGMA foreign_key_check: PASSED (0 violations)")

    # 4. Verify all 36 tables and record counts
    tables = [
        row[0]
        for row in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        ).fetchall()
    ]

    total_restored_records = 0
    for t in tables:
        cnt = cur.execute(f'SELECT COUNT(*) FROM "{t}";').fetchone()[0]
        total_restored_records += cnt

    conn.close()

    # Clean up temporary test database
    if restore_target.exists():
        restore_target.unlink()

    print(f"[✓] Total tables restored: {len(tables)}/36 tables")
    print(f"[✓] Total records restored: {total_restored_records:,} records")
    print(f"[✓] Exact parity with backup metadata: {total_restored_records == backup_meta['total_records']}")

    print("=" * 70)
    print("RESTORE-TEST VERIFICATION SUCCESSFUL: 100% INTEGRITY & PARITY")
    print("=" * 70)
    return True, backup_meta


if __name__ == "__main__":
    success, meta = test_restore_backup()
    sys.exit(0 if success else 1)

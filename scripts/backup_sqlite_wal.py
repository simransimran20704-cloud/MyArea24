#!/usr/bin/env python3
"""
MyArea24 — Consistent SQLite WAL Backup & Integrity Verification Engine
Safely flushes uncommitted WAL pages and produces an atomic, standalone,
fully-verified SQLite backup snapshot without interrupting active readers.
"""
import datetime
import hashlib
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


def compute_file_sha256(filepath: str) -> str:
    """Computes SHA-256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def create_consistent_sqlite_backup(
    source_db_path: str = "myarea24.db",
    backup_dir: str = "backups",
    custom_suffix: str = "",
) -> Dict[str, Any]:
    """
    Creates an atomic, consistent SQLite backup accounting for WAL mode:
    1. Flushes WAL journal to main DB file via PRAGMA wal_checkpoint(TRUNCATE).
    2. Utilizes SQLite Online Backup API (sqlite3.Connection.backup) for page-level consistency.
    3. Verifies backup via PRAGMA integrity_check and foreign key validation.
    4. Confirms 100% row count match across all tables.
    """
    source_path = Path(source_db_path).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source database not found at {source_path}")

    backup_directory = Path(backup_dir).resolve()
    backup_directory.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = f"_{custom_suffix}" if custom_suffix else ""
    backup_filename = f"myarea24_backup_consistent_{timestamp}{suffix}.db"
    backup_path = backup_directory / backup_filename

    print(f"[*] Initiating WAL-consistent SQLite backup...")
    print(f"    Source: {source_path}")
    print(f"    Destination: {backup_path}")

    # 1. Connect to source database
    src_conn = sqlite3.connect(source_path)
    src_cur = src_conn.cursor()

    # Determine journal mode and checkpoint WAL if in WAL mode
    journal_mode = src_cur.execute("PRAGMA journal_mode;").fetchone()[0].upper()
    print(f"    Active SQLite Journal Mode: {journal_mode}")

    if journal_mode == "WAL":
        try:
            # Checkpoint WAL pages into main DB file
            checkpoint_res = src_cur.execute("PRAGMA wal_checkpoint(TRUNCATE);").fetchone()
            print(f"    [✓] WAL checkpoint executed (busy={checkpoint_res[0]}, log={checkpoint_res[1]}, checkpointed={checkpoint_res[2]}).")
        except Exception as e:
            print(f"    [!] Notice on WAL checkpoint (proceeding with online backup API): {e}")

    # Gather source table counts
    src_tables = [
        row[0]
        for row in src_cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        ).fetchall()
    ]
    src_counts: Dict[str, int] = {}
    total_src_records = 0
    for tbl in src_tables:
        cnt = src_cur.execute(f'SELECT COUNT(*) FROM "{tbl}";').fetchone()[0]
        src_counts[tbl] = cnt
        total_src_records += cnt

    # 2. Execute atomic Online Backup API
    dest_conn = sqlite3.connect(backup_path)
    try:
        src_conn.backup(dest_conn, pages=250)
    finally:
        dest_conn.close()
        src_conn.close()

    backup_size_bytes = backup_path.stat().st_size
    backup_sha256 = compute_file_sha256(str(backup_path))
    print(f"    [✓] Online backup snapshot written ({backup_size_bytes / (1024 * 1024):.2f} MB).")
    print(f"    SHA-256: {backup_sha256}")

    # 3. Independent Verification Phase on Backup File
    print(f"[*] Verifying backup snapshot integrity...")
    verify_conn = sqlite3.connect(f"file:{backup_path}?mode=ro", uri=True)
    verify_cur = verify_conn.cursor()

    # PRAGMA integrity_check
    integrity_result = verify_cur.execute("PRAGMA integrity_check;").fetchall()
    is_integrity_ok = len(integrity_result) == 1 and integrity_result[0][0].lower() == "ok"
    if not is_integrity_ok:
        verify_conn.close()
        raise RuntimeError(f"Backup integrity check failed: {integrity_result}")
    print(f"    [✓] PRAGMA integrity_check: PASSED (ok)")

    # PRAGMA foreign_key_check
    fk_violations = verify_cur.execute("PRAGMA foreign_key_check;").fetchall()
    if fk_violations:
        print(f"    [!] Foreign key check notice: {len(fk_violations)} violations detected.")
    else:
        print(f"    [✓] PRAGMA foreign_key_check: PASSED (0 violations)")

    # Verify table count and record parity
    backup_tables = [
        row[0]
        for row in verify_cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        ).fetchall()
    ]
    if len(backup_tables) != len(src_tables):
        verify_conn.close()
        raise RuntimeError(f"Table count mismatch: source has {len(src_tables)}, backup has {len(backup_tables)}")

    discrepancies: List[Tuple[str, int, int]] = []
    total_backup_records = 0
    for tbl in backup_tables:
        b_cnt = verify_cur.execute(f'SELECT COUNT(*) FROM "{tbl}";').fetchone()[0]
        total_backup_records += b_cnt
        if b_cnt != src_counts.get(tbl, -1):
            discrepancies.append((tbl, src_counts.get(tbl, -1), b_cnt))

    verify_conn.close()

    if discrepancies:
        raise RuntimeError(f"Record count parity mismatch in backup: {discrepancies}")

    print(f"    [✓] Record parity confirmed: 100% match across {len(backup_tables)} tables ({total_backup_records:,} records).")
    print(f"[+] BACKUP VERIFICATION SUCCESSFUL: Ready for safe archiving.")

    return {
        "status": "SUCCESS",
        "backup_path": str(backup_path),
        "backup_filename": backup_filename,
        "backup_size_bytes": backup_size_bytes,
        "backup_sha256": backup_sha256,
        "total_tables": len(backup_tables),
        "total_records": total_backup_records,
        "timestamp": timestamp,
    }


if __name__ == "__main__":
    src_db = sys.argv[1] if len(sys.argv) > 1 else "myarea24.db"
    try:
        res = create_consistent_sqlite_backup(source_db_path=src_db)
        print("\nRestoration Command:")
        print(f"  Copy-Item \"{res['backup_path']}\" -Destination \"{src_db}\"")
        sys.exit(0)
    except Exception as exc:
        print(f"[-] Backup failed: {exc}", file=sys.stderr)
        sys.exit(1)

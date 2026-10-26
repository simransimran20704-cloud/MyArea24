"""
MyArea24 — SQLite to Neon Cloud PostgreSQL Migration Tool
Transfers all tables and data from local SQLite to Neon PostgreSQL via
Neon's high-speed authenticated HTTPS SQL endpoint, completely immune to
local ISP/VPN port 5432 blocking.
"""

import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import json
import sqlite3
import datetime
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql
from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from backend.app.database.models import Base

# Automatically load NEON_DATABASE_URL from .env if present
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("NEON_DATABASE_URL="):
                os.environ.setdefault("NEON_DATABASE_URL", line.split("=", 1)[1].strip("'\""))

NEON_CONN_STR = os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL", "")
if not NEON_CONN_STR or not NEON_CONN_STR.startswith("postgres"):
    print("[!] Error: NEON_DATABASE_URL environment variable is required.")
    sys.exit(1)

host_part = NEON_CONN_STR.split("@")[-1].split("/")[0].replace("-pooler", "")
NEON_SQL_URL = f"https://{host_part}/sql"

MIGRATION_ORDER = [
    "users",
    "data_sources",
    "data_sync_logs",
    "intelligence_insights",
    "intelligence_signals",
    "emergency_facilities",
    "businesses",
    "products",
    "service_listings",
    "events",
    "orders",
    "order_items",
    "service_bookings",
    "otp_tokens",
    "air_quality_observations",
    "analytics_events",
    "civic_bulletins",
    "community_signals",
    "customer_enquiries",
    "government_notices",
    "mandi_prices",
    "offers",
    "saved_items",
    "traffic_observations",
    "weather_observations",
]

def neon_query(sql: str, params: Optional[list] = None) -> Dict[str, Any]:
    payload = {"query": sql}
    if params:
        payload["params"] = params
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        NEON_SQL_URL,
        data=body,
        headers={
            "Neon-Connection-String": NEON_CONN_STR,
            "Content-Type": "application/json",
            "User-Agent": "MyArea24-Neon-Migrator/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode("utf-8")
        print(f"\n[!] Neon SQL Error on query: {sql[:140]}...\n    Error: {err_msg}", flush=True)
        raise RuntimeError(f"Neon SQL Error: {err_msg}") from he

def format_sql_value(val: Any, col_type: Any) -> str:
    if val is None or val == "":
        if not isinstance(col_type, (String, Text)):
            return "NULL"
        if val is None:
            return "NULL"
    if isinstance(col_type, Boolean):
        return "TRUE" if bool(val) else "FALSE"
    if isinstance(col_type, (Integer, Float)):
        try:
            return str(int(val) if isinstance(col_type, Integer) else float(val))
        except Exception:
            return "NULL"
    if isinstance(col_type, JSON):
        if isinstance(val, (dict, list)):
            s = json.dumps(val).replace("'", "''")
            return f"'{s}'"
        s = str(val).replace("'", "''")
        return f"'{s}'"
    s = str(val)
    if isinstance(col_type, String) and col_type.length and not isinstance(col_type, Text):
        s = s[:col_type.length]
    s = s.replace("'", "''")
    return f"'{s}'"

def run_migration(source_db_path="myarea24.db", clean=False, audit_only=False):
    print("=" * 64)
    print("MYAREA24 -> NEON CLOUD POSTGRESQL LIVE MIGRATION")
    print("=" * 64)
    print(f"[*] Source Database: {os.path.abspath(source_db_path)}")
    print(f"[*] Target Neon Host: ep-crimson-silence-b4ulh0m8.c-6.us-east-2.aws.neon.tech")
    print(f"[*] Clean target mode: {clean}")
    print(f"[*] Audit only mode: {audit_only}")

    # 1. Verify Neon connectivity
    v_res = neon_query("SELECT version();")
    print(f"[+] Connected to Neon! Version: {v_res['rows'][0]['version']}")

    # 2. Initialize PostGIS
    neon_query("CREATE EXTENSION IF NOT EXISTS postgis;")
    print("[+] PostGIS extension verified on Neon PostgreSQL.")

    # 3. Read tables and counts from SQLite
    src_conn = sqlite3.connect(source_db_path)
    src_cur = src_conn.cursor()

    # Discover tables
    all_src_tables = [
        r[0] for r in src_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';").fetchall()
    ]
    print(f"[*] Discovered {len(all_src_tables)} tables in SQLite database.")

    tables_to_migrate = [t for t in MIGRATION_ORDER if t in all_src_tables]
    for t in all_src_tables:
        if t not in tables_to_migrate and t != "alembic_version":
            tables_to_migrate.append(t)

    if not audit_only:
        # 4. Create Tables on Neon
        print("\n[*] Initializing target schema on Neon PostgreSQL...")
        for t in Base.metadata.sorted_tables:
            table_name = t.name
            if clean:
                neon_query(f'DROP TABLE IF EXISTS "{table_name}" CASCADE;')
            ddl = str(CreateTable(t).compile(dialect=postgresql.dialect())).strip()
            ddl_if_not_exists = ddl.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1)
            try:
                neon_query(ddl_if_not_exists)
            except Exception as e:
                print(f"    [!] Notice creating '{table_name}': {e}")
        print("[+] Neon schema initialization complete.")

        # 5. Migrate Data Table by Table
        print("\n[*] Migrating table data...")
        migrated_counts = {}

        for table_name in tables_to_migrate:
            # Check source count
            src_count = src_cur.execute(f'SELECT COUNT(*) FROM "{table_name}";').fetchone()[0]
            if src_count == 0:
                migrated_counts[table_name] = 0
                print(f"    [-] '{table_name}': 0 rows (Skipped empty table)")
                continue

            # Get column names
            src_cur.execute(f'SELECT * FROM "{table_name}" LIMIT 0;')
            col_names = [d[0] for d in src_cur.description]
            quoted_cols = ", ".join([f'"{c}"' for c in col_names])

            if clean:
                neon_query(f'TRUNCATE TABLE "{table_name}" CASCADE;')

            # Read all rows
            rows = src_cur.execute(f'SELECT * FROM "{table_name}";').fetchall()
            batch_size = 250
            inserted_for_table = 0

            # Get column types from SQLAlchemy metadata
            col_types = {}
            if table_name in Base.metadata.tables:
                col_types = {c.name: c.type for c in Base.metadata.tables[table_name].columns}

            for i in range(0, len(rows), batch_size):
                chunk = rows[i:i + batch_size]
                values_clauses = []
                for row in chunk:
                    val_strs = [format_sql_value(v, col_types.get(col_names[idx])) for idx, v in enumerate(row)]
                    values_clauses.append(f"({', '.join(val_strs)})")

                insert_sql = f'INSERT INTO "{table_name}" ({quoted_cols}) VALUES {", ".join(values_clauses)} ON CONFLICT DO NOTHING;'
                neon_query(insert_sql)
                inserted_for_table += len(chunk)

            migrated_counts[table_name] = inserted_for_table
            print(f"    [+] Migrated '{table_name}': {inserted_for_table:,} / {src_count:,} rows", flush=True)

    # 6. Reset PostgreSQL Serial Sequences
    print("\n[*] Synchronizing PostgreSQL sequence counters on Neon...")
    for table_name in tables_to_migrate:
        table_obj = Base.metadata.tables.get(table_name)
        if table_obj is not None and "id" in table_obj.c:
            col = table_obj.c["id"]
            if isinstance(col.type, Integer):
                try:
                    seq_sql = (
                        f"SELECT setval(pg_get_serial_sequence('\"{table_name}\"', 'id'), "
                        f"COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM \"{table_name}\";"
                    )
                    neon_query(seq_sql)
                except Exception as e:
                    print(f"    [!] Sequence sync note for '{table_name}': {e}")

    # 7. Verification: Compare Counts
    print("\n[*] Auditing post-migration target record counts on Neon...")
    discrepancies = []
    total_migrated = 0

    for table_name in tables_to_migrate:
        neon_res = neon_query(f'SELECT COUNT(*) as cnt FROM "{table_name}";')
        neon_count = int(neon_res["rows"][0]["cnt"])
        expected = src_cur.execute(f'SELECT COUNT(*) FROM "{table_name}";').fetchone()[0]
        total_migrated += neon_count

        if neon_count != expected:
            discrepancies.append((table_name, expected, neon_count))
            print(f"    [-] DISCREPANCY in '{table_name}': expected {expected:,}, got {neon_count:,}")
        else:
            print(f"    [✓] '{table_name}': {neon_count:,} rows (Exact match)")

    src_conn.close()

    if discrepancies:
        print(f"\n[!] Migration finished with {len(discrepancies)} discrepancies: {discrepancies}")
        sys.exit(1)

    print("\n" + "=" * 64)
    print(f"[✓] MIGRATION TO NEON COMPLETE: 100% PARITY! ({total_migrated:,} rows in Neon)")
    print("=" * 64)

if __name__ == "__main__":
    clean_flag = "--clean" in sys.argv
    audit_flag = "--audit-only" in sys.argv
    run_migration(clean=clean_flag, audit_only=audit_flag)

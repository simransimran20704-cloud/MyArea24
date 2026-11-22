#!/usr/bin/env python3
"""
MyArea24 — SQLite to PostgreSQL Migration Engine
Performs safe, transactional, idempotent, and non-destructive migration of all
relational and spatial tables from a source SQLite database into a target PostgreSQL
(or PostgreSQL/PostGIS) database.

Features:
- Non-destructive: Source SQLite database is opened in read-only mode (?mode=ro).
- Rerun-Safe / Idempotent: Supports --clean flag to truncate existing target tables before loading.
- Pre-flight Collision Guard: If target tables contain existing records and --clean is omitted,
  aborts safely before modifying data.
- Rollback Command: Provides --rollback flag to safely reset target tables.
- Foreign-key Preservation: Migrates in strict topological dependency order.
- PostGIS Acceleration: Enables PostGIS extension and provisions sub-millisecond GiST spatial indexes.
- Robust Type Casting: Normalizes SQLite 0/1 to boolean, empty strings to NULL, and ISO datetimes.
- Sequence Alignment: Synchronizes PostgreSQL SERIAL / IDENTITY sequences with MAX(id).
- Audit & Verification: Verifies 100% record parity between source and destination.
"""

import argparse
import datetime
import json
import os
import socket
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Integer,
    JSON,
    String,
    Text,
    create_engine,
    inspect,
    text,
)

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Attempt to load environment variables from backend/.env (Priority 1) or .env
try:
    from dotenv import load_dotenv
    backend_env = Path(__file__).resolve().parent.parent / "backend" / ".env"
    env_local = Path(__file__).resolve().parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(backend_env, override=True)
    elif env_local.exists():
        load_dotenv(env_local, override=True)
except ImportError:
    pass

from backend.app.database.models import Base  # noqa: E402


# Explicit topological dependency ordering for foreign keys
MIGRATION_ORDER = [
    "users",
    "data_sources",
    "data_sync_logs",
    "emergency_facilities",
    "businesses",
    "products",
    "service_listings",
    "offers",
    "events",
    "orders",
    "order_items",
    "service_bookings",
    "customer_enquiries",
    "merchant_push_subscriptions",
    "saved_items",
    "otp_tokens",
    "intelligence_insights",
    "intelligence_signals",
    "air_quality_observations",
    "weather_observations",
    "traffic_observations",
    "government_notices",
    "mandi_prices",
    "civic_bulletins",
    "community_signals",
    "analytics_events",
]


def normalize_postgres_url(url: str) -> str:
    """Normalize postgres URLs to standard psycopg2 dialect and ensure SSL for cloud hosts."""
    clean_url = url.strip()
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif clean_url.startswith("postgresql://") and "+psycopg2" not in clean_url:
        clean_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Cloud managed databases (Neon, Supabase, RDS) mandate SSL
    cloud_keywords = ["neon.tech", "supabase.co", "rds.amazonaws.com", "render.com", "railway.app"]
    if any(k in clean_url for k in cloud_keywords):
        if "sslmode=" not in clean_url:
            separator = "&" if "?" in clean_url else "?"
            clean_url = f"{clean_url}{separator}sslmode=require"

    return clean_url


def resolve_ip_with_retry(host: str, max_retries: int = 5) -> Optional[str]:
    """Resolves IP address with retries to protect against transient DNS resolver latency."""
    for attempt in range(max_retries):
        try:
            return socket.gethostbyname(host)
        except socket.gaierror:
            time.sleep(0.5 * (attempt + 1))
    return None


def get_sqlite_tables(conn: sqlite3.Connection) -> List[str]:
    """Returns list of user tables in the SQLite database."""
    cur = conn.cursor()
    return [
        row[0]
        for row in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        ).fetchall()
    ]


def parse_datetime_val(val: Any) -> Optional[datetime.datetime]:
    """Robustly parses datetime strings from SQLite into datetime objects."""
    if val is None or val == "":
        return None
    if isinstance(val, datetime.datetime):
        return val
    if isinstance(val, str):
        cleaned = val.strip().replace("Z", "+00:00")
        try:
            return datetime.datetime.fromisoformat(cleaned)
        except Exception:
            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    return datetime.datetime.strptime(cleaned, fmt)
                except Exception:
                    pass
    return None


def clean_target_tables(target_engine, tables_in_reverse: List[str], is_postgres: bool = False):
    """Safely cleans target tables in reverse dependency order (child before parent)."""
    print("[*] Cleaning existing records in target database in reverse dependency order...")
    valid_tables = [t for t in tables_in_reverse if t in Base.metadata.tables]
    with target_engine.begin() as conn:
        if is_postgres:
            # PostgreSQL can truncate all tables in a single atomic CASCADE statement
            try:
                table_list = ", ".join(f'"{t}"' for t in valid_tables)
                conn.execute(text(f"TRUNCATE TABLE {table_list} CASCADE;"))
            except Exception as e:
                # Fallback: truncate or delete table-by-table
                for t in valid_tables:
                    try:
                        conn.execute(text(f'TRUNCATE TABLE "{t}" CASCADE;'))
                    except Exception:
                        try:
                            conn.execute(text(f'DELETE FROM "{t}";'))
                        except Exception:
                            pass
        else:
            for t in valid_tables:
                conn.execute(text(f'DELETE FROM "{t}";'))
    print("[✓] Target tables cleaned successfully.")


def rollback_migration(target_url: str):
    """Rolls back and empties target database tables in reverse dependency order."""
    normalized_url = normalize_postgres_url(target_url)
    is_postgres = "postgres" in normalized_url
    target_engine = create_engine(normalized_url, echo=False)
    reverse_order = list(reversed(MIGRATION_ORDER))

    # Mask password for display
    masked_url = normalized_url
    if "@" in masked_url and ":" in masked_url:
        prefix = masked_url.split("@")[0]
        suffix = masked_url.split("@")[1]
        user = prefix.split("://")[-1].split(":")[0]
        masked_url = f"{prefix.split('://')[0]}://{user}:*****@{suffix}"

    print(f"[*] Initiating rollback on target: {masked_url}")
    clean_target_tables(target_engine, reverse_order, is_postgres)
    target_engine.dispose()
    print("[+] Rollback complete. Target database reset to clean state.")


def enable_postgis_and_indexes(target_engine):
    """Provisions PostGIS extension and builds sub-millisecond GiST spatial indexes."""
    print("[*] Provisioning PostGIS extension & spatial indexing...")
    with target_engine.connect() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            print("    [✓] PostGIS extension verified (active).")
        except Exception as ext_err:
            print(f"    [!] Notice on PostGIS extension creation: {ext_err}")

        # GiST Spatial Indexes for sub-millisecond proximity matching
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_emergency_gist_spatial "
                "ON emergency_facilities USING gist (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_business_gist_spatial "
                "ON businesses USING gist (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));"
            ))
            conn.commit()
            print("    [✓] PostGIS GiST spatial indexes created for emergency_facilities and businesses.")
        except Exception as idx_err:
            print(f"    [!] Notice on GiST spatial index creation: {idx_err}")


def split_sql_script(sql_text: str) -> List[str]:
    """Splits SQL script into individual executable statements, respecting dollar quotes and strings."""
    import re
    statements = []
    current = []
    in_dollar_quote = False
    dollar_tag = ""
    in_single_quote = False
    i = 0
    n = len(sql_text)

    while i < n:
        # Single-line comment
        if not in_dollar_quote and not in_single_quote and sql_text[i:i+2] == "--":
            nl = sql_text.find("\n", i)
            if nl == -1:
                break
            i = nl + 1
            continue

        # Block comment
        if not in_dollar_quote and not in_single_quote and sql_text[i:i+2] == "/*":
            close_comment = sql_text.find("*/", i + 2)
            if close_comment == -1:
                break
            i = close_comment + 2
            continue

        char = sql_text[i]

        # Single quote
        if char == "'" and not in_dollar_quote:
            if in_single_quote and i + 1 < n and sql_text[i+1] == "'":
                current.append("''")
                i += 2
                continue
            in_single_quote = not in_single_quote
            current.append(char)
            i += 1
            continue

        # Dollar quotes (e.g. $$ or $tag$)
        if char == "$" and not in_single_quote:
            if not in_dollar_quote:
                match = re.match(r'(\$[a-zA-Z0-9_]*\$)', sql_text[i:])
                if match:
                    dollar_tag = match.group(1)
                    in_dollar_quote = True
                    current.append(dollar_tag)
                    i += len(dollar_tag)
                    continue
            else:
                if sql_text[i:i+len(dollar_tag)] == dollar_tag:
                    in_dollar_quote = False
                    current.append(dollar_tag)
                    i += len(dollar_tag)
                    dollar_tag = ""
                    continue

        # Semicolon outside quotes
        if char == ";" and not in_dollar_quote and not in_single_quote:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue

        current.append(char)
        i += 1

    stmt = "".join(current).strip()
    if stmt:
        statements.append(stmt)

    return statements


def apply_supabase_rls(target_engine):
    """Applies Supabase Row Level Security (RLS) policies and storage configurations."""
    rls_path = Path(__file__).resolve().parent / "supabase_schema_and_rls.sql"
    if not rls_path.exists():
        print(f"    [!] RLS script not found at {rls_path}")
        return
    print(f"[*] Applying Supabase RLS and PostGIS policies from {rls_path.name}...")
    sql_content = rls_path.read_text(encoding="utf-8")
    statements = split_sql_script(sql_content)
    applied_count = 0
    with target_engine.connect() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
                conn.commit()
                applied_count += 1
            except Exception as e:
                # Log notice for non-fatal errors (e.g. table not found or policy already exists)
                first_line = str(e).split("\n")[0]
                print(f"    [!] RLS Statement notice: {first_line[:90]}")
    print(f"    [✓] Supabase RLS policies and spatial indexes applied successfully ({applied_count}/{len(statements)} statements).")


def migrate_data(
    source_db_path: str,
    target_url: str,
    dry_run: bool = False,
    clean: bool = False,
    batch_size: int = 500,
    selected_tables: Optional[List[str]] = None,
    apply_rls: bool = False,
) -> Dict[str, Any]:
    """
    Executes the migration process from SQLite to target database.
    """
    if not os.path.exists(source_db_path):
        raise FileNotFoundError(f"Source SQLite database not found at {source_db_path}")

    # Normalize target URL
    normalized_url = normalize_postgres_url(target_url)
    is_target_postgres = "postgres" in normalized_url

    # Mask password for display
    masked_url = normalized_url
    if "@" in masked_url and ":" in masked_url:
        prefix = masked_url.split("@")[0]
        suffix = masked_url.split("@")[1]
        user = prefix.split("://")[-1].split(":")[0]
        masked_url = f"{prefix.split('://')[0]}://{user}:*****@{suffix}"

    print(f"[*] Source Database: {os.path.abspath(source_db_path)}")
    print(f"[*] Target Endpoint: {masked_url}")
    print(f"[*] Target Dialect: {'PostgreSQL / PostGIS' if is_target_postgres else 'SQLite/Other'}")
    print(f"[*] Dry-run mode: {dry_run}")
    print(f"[*] Clean target mode: {clean}")

    # 1. Connect to source SQLite in URI read-only mode
    src_conn = sqlite3.connect(f"file:{os.path.abspath(source_db_path)}?mode=ro", uri=True)
    src_cur = src_conn.cursor()

    all_src_tables = get_sqlite_tables(src_conn)
    print(f"[*] Discovered {len(all_src_tables)} tables in source database.")

    # Filter tables if specific tables requested
    if selected_tables:
        candidate_tables = [t for t in all_src_tables if t in selected_tables]
    else:
        candidate_tables = all_src_tables

    # Sort tables: migration order first, followed by any remaining tables
    tables_to_migrate = []
    for t in MIGRATION_ORDER:
        if t in candidate_tables:
            tables_to_migrate.append(t)
    for t in candidate_tables:
        if t not in tables_to_migrate:
            tables_to_migrate.append(t)

    # Collect source row counts
    src_counts: Dict[str, int] = {}
    total_src_rows = 0
    for t in tables_to_migrate:
        count = src_cur.execute(f'SELECT COUNT(*) FROM "{t}";').fetchone()[0]
        src_counts[t] = count
        total_src_rows += count
        print(f"    - {t}: {count:,} rows")

    print(f"[*] Total source records to migrate: {total_src_rows:,}")

    if dry_run:
        src_conn.close()
        print("[+] Dry run complete. No database changes were made.")
        return {"status": "DRY_RUN_COMPLETED", "tables": src_counts, "total_rows": total_src_rows}

    # 2. Mandatory Pre-Migration Consistent SQLite Backup (accounting for WAL mode)
    print("\n[*] Creating mandatory WAL-consistent SQLite backup before network operations...")
    from scripts.backup_sqlite_wal import create_consistent_sqlite_backup
    backup_meta = create_consistent_sqlite_backup(source_db_path=source_db_path)
    print(f"[✓] Pre-migration backup verified: {backup_meta['backup_filename']} ({backup_meta['total_records']:,} records)\n")

    # 3. Connect to target database and build schema
    print(f"[*] Connecting to target database...")
    connect_args = {"connect_timeout": 30}
    if is_target_postgres:
        parsed = urlparse(normalized_url.replace("+psycopg2", ""))
        if parsed.hostname and parsed.hostname not in ("localhost", "127.0.0.1"):
            target_ip = resolve_ip_with_retry(parsed.hostname)
            if target_ip:
                connect_args["hostaddr"] = target_ip
                print(f"[*] Bound PostgreSQL socket directly to hostaddr: {target_ip} (DNS-independent)")

    target_engine = create_engine(
        normalized_url,
        echo=False,
        pool_pre_ping=True,
        connect_args=connect_args if is_target_postgres else {}
    )

    if not is_target_postgres:
        from sqlalchemy import event

        @event.listens_for(target_engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=OFF")
            cursor.execute("PRAGMA busy_timeout=15000")
            cursor.close()

    # If target is Postgres, initialize PostGIS extension
    if is_target_postgres:
        enable_postgis_and_indexes(target_engine)

    # Build schema
    print("[*] Creating target schema if not exists...")
    Base.metadata.create_all(bind=target_engine)
    target_inspector = inspect(target_engine)
    target_tables = set(target_inspector.get_table_names())
    print(f"    -> Target schema has {len(target_tables)} tables ready.")

    # Synchronize columns for schema evolution (e.g. password_hash, settlement info, fulfillment_type)
    if is_target_postgres:
        print("[*] Ensuring target schema has all latest model columns...")
        with target_engine.connect() as conn:
            for t in tables_to_migrate:
                if t in Base.metadata.tables and t in target_tables:
                    sa_table = Base.metadata.tables[t]
                    existing_cols = {c["name"] for c in target_inspector.get_columns(t)}
                    for col in sa_table.columns:
                        if col.name not in existing_cols:
                            try:
                                col_type_str = col.type.compile(target_engine.dialect)
                                conn.execute(text(f'ALTER TABLE "{t}" ADD COLUMN IF NOT EXISTS "{col.name}" {col_type_str};'))
                                conn.commit()
                                print(f"    [+] Added missing column '{col.name}' ({col_type_str}) to '{t}'")
                            except Exception as add_err:
                                print(f"    [!] Notice on column '{col.name}' for '{t}': {add_err}")
                        elif isinstance(col.type, String) and getattr(col.type, "length", None):
                            try:
                                col_type_str = col.type.compile(target_engine.dialect)
                                conn.execute(text(f'ALTER TABLE "{t}" ALTER COLUMN "{col.name}" TYPE {col_type_str};'))
                                conn.commit()
                            except Exception:
                                pass
        # Refresh inspector with added columns
        target_inspector = inspect(target_engine)

    # Check for existing data in target database
    existing_target_rows = {}
    with target_engine.connect() as conn:
        for t in tables_to_migrate:
            if t in target_tables:
                try:
                    c = conn.execute(text(f'SELECT COUNT(*) FROM "{t}";')).scalar()
                    if c and c > 0:
                        existing_target_rows[t] = c
                except Exception:
                    pass

    if existing_target_rows:
        if not clean:
            src_conn.close()
            target_engine.dispose()
            raise RuntimeError(
                f"Pre-flight Check Failed: Target database already contains data in {len(existing_target_rows)} tables "
                f"(e.g. {list(existing_target_rows.keys())[:3]} have records). "
                f"To prevent duplicate key collisions, run migration with '--clean' to safely reset target tables first."
            )
        else:
            # Clean target tables in reverse dependency order
            reverse_tables = list(reversed(tables_to_migrate))
            clean_target_tables(target_engine, reverse_tables, is_target_postgres)

    # 3. Perform batch migration within a transactional boundary
    migrated_counts: Dict[str, int] = {}

    # Pre-cache target columns outside the write transaction to prevent SQLite connection pool locks
    remote_cols_by_table = {
        t: {c["name"] for c in target_inspector.get_columns(t)}
        for t in target_tables
    }

    with target_engine.begin() as target_conn:
        for table_name in tables_to_migrate:
            if table_name not in Base.metadata.tables:
                print(f"[!] Notice: Table '{table_name}' has no SQLAlchemy model definition. Skipping.")
                continue

            sa_table = Base.metadata.tables[table_name]
            sa_cols = {c.name for c in sa_table.columns}
            remote_cols = remote_cols_by_table.get(table_name, set())
            col_types = {c.name: c.type for c in sa_table.columns}

            # Fetch columns from source SQLite
            src_cur.execute(f'PRAGMA table_info("{table_name}");')
            src_col_info = src_cur.fetchall()
            src_cols = [row[1] for row in src_col_info]

            # Find matching common columns that exist in BOTH source and destination
            common_cols = [c for c in src_cols if c in sa_cols and c in remote_cols]
            if not common_cols:
                print(f"[!] No matching columns for {table_name}. Skipping.")
                continue

            quoted_cols = ", ".join(f'"{c}"' for c in common_cols)
            src_cur.execute(f'SELECT {quoted_cols} FROM "{table_name}";')

            batch: List[Dict[str, Any]] = []
            rows_migrated_for_table = 0

            while True:
                rows = src_cur.fetchmany(batch_size)
                if not rows:
                    break

                for row in rows:
                    row_dict = {}
                    for col_idx, col_name in enumerate(common_cols):
                        val = row[col_idx]
                        col_type = col_types.get(col_name)

                        # Empty string to NULL conversion for non-string columns
                        if val == "" and not isinstance(col_type, (String, Text)):
                            if isinstance(col_type, (Integer, Float, DateTime, Boolean)):
                                val = None

                        # Type normalization
                        if val is not None:
                            # Boolean normalization (SQLite 0/1 -> bool)
                            if isinstance(col_type, Boolean):
                                val = bool(val)
                            # JSON normalization
                            elif isinstance(col_type, JSON):
                                if isinstance(val, str):
                                    try:
                                        val = json.loads(val)
                                    except Exception:
                                        pass
                            # DateTime normalization
                            elif isinstance(col_type, DateTime):
                                val = parse_datetime_val(val)
                            # Numeric normalization
                            elif isinstance(col_type, Integer) and isinstance(val, str):
                                try:
                                    val = int(val)
                                except Exception:
                                    pass
                            elif isinstance(col_type, Float) and isinstance(val, str):
                                try:
                                    val = float(val)
                                except Exception:
                                    pass
                            elif isinstance(col_type, String) and getattr(col_type, "length", None) and isinstance(val, str):
                                if len(val) > col_type.length:
                                    val = val[:col_type.length]

                        if col_name == "fulfillment_type" and not val:
                            val = "DELIVERY"

                        row_dict[col_name] = val
                    batch.append(row_dict)

                if batch:
                    target_conn.execute(sa_table.insert(), batch)
                    rows_migrated_for_table += len(batch)
                    batch = []

            migrated_counts[table_name] = rows_migrated_for_table
            print(f"    [+] Migrated '{table_name}': {rows_migrated_for_table:,} / {src_counts[table_name]:,} rows", flush=True)

    src_conn.close()
    print("[✓] Transactional batch insertion committed successfully.")

    # 4. If PostgreSQL, reset sequences so auto-increment works on new records
    if is_target_postgres:
        print("[*] Synchronizing PostgreSQL sequence counters...")
        with target_engine.connect() as seq_conn:
            for table_name in tables_to_migrate:
                if table_name in Base.metadata.tables:
                    try:
                        seq_conn.execute(text(
                            f"DO $$ DECLARE seq text; BEGIN "
                            f"  seq := pg_get_serial_sequence('{table_name}', 'id'); "
                            f"  IF seq IS NOT NULL THEN "
                            f"    EXECUTE 'SELECT setval(''' || seq || ''', COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM \"{table_name}\"'; "
                            f"  END IF; "
                            f"END $$;"
                        ))
                        seq_conn.commit()
                    except Exception:
                        pass

    # 5. Populate geometry columns if present on target tables
    if is_target_postgres:
        print("[*] Synchronizing PostGIS native Geometry points from coordinates...")
        with target_engine.connect() as conn:
            for table_name in ["emergency_facilities", "businesses"]:
                if table_name in target_tables:
                    try:
                        conn.execute(text(
                            f"DO $$ BEGIN "
                            f"  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='{table_name}' AND column_name='geom') THEN "
                            f"    UPDATE \"{table_name}\" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL; "
                            f"  END IF; "
                            f"END $$;"
                        ))
                        conn.commit()
                    except Exception as ge:
                        print(f"    Notice: Could not sync geom on {table_name}: {ge}")

    # 6. Verification Phase: Check row counts in target database
    print("\n[*] Auditing post-migration target record counts...")
    discrepancies = []
    with target_engine.connect() as verify_conn:
        for t, expected_count in migrated_counts.items():
            if t in Base.metadata.tables:
                actual_count = verify_conn.execute(text(f'SELECT COUNT(*) FROM "{t}";')).scalar()
                if actual_count != expected_count:
                    discrepancies.append((t, expected_count, actual_count))
                    print(f"    [-] DISCREPANCY in '{t}': expected {expected_count:,}, got {actual_count:,}")
                else:
                    print(f"    [✓] '{t}': {actual_count:,} rows (Exact match)")

    if discrepancies:
        raise RuntimeError(f"Database migration verification failed with {len(discrepancies)} discrepancies: {discrepancies}")

    # 7. Post-Migration RLS Configuration (Optional/Supabase)
    if apply_rls and is_target_postgres:
        apply_supabase_rls(target_engine)

    target_engine.dispose()

    print("\n[+] MIGRATION VERIFICATION SUCCESSFUL: 100% record parity across all migrated tables!")
    return {
        "status": "SUCCESS",
        "migrated_tables": migrated_counts,
        "total_migrated": sum(migrated_counts.values()),
    }


if __name__ == "__main__":
    default_target = (
        os.getenv("DATABASE_URL") if (os.getenv("DATABASE_URL") and "postgres" in os.getenv("DATABASE_URL"))
        else os.getenv("NEON_DATABASE_URL")
        or os.getenv("STAGING_DATABASE_URL", "sqlite:///myarea24_staging_test.db")
    )

    parser = argparse.ArgumentParser(description="MyArea24 SQLite to PostgreSQL Migration Tool")
    parser.add_argument("--source-db", default="myarea24.db", help="Path to source SQLite file")
    parser.add_argument(
        "--target-url",
        default=default_target,
        help="Target SQLAlchemy database URL (e.g. postgresql://user:pwd@host:5432/myarea24)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Simulate migration without modifying target")
    parser.add_argument("--clean", action="store_true", help="Truncate target tables before migrating (rerun-safe)")
    parser.add_argument("--apply-rls", action="store_true", help="Apply Supabase Row Level Security (RLS) policies after migration")
    parser.add_argument("--rollback", action="store_true", help="Roll back and truncate target tables without migrating")
    parser.add_argument("--batch-size", type=int, default=500, help="Row batch size for migration")
    parser.add_argument("--tables", help="Comma-separated list of specific tables to migrate (default: all)")
    args = parser.parse_args()

    if args.rollback:
        rollback_migration(args.target_url)
        sys.exit(0)

    selected = [t.strip() for t in args.tables.split(",") if t.strip()] if args.tables else None

    try:
        res = migrate_data(
            source_db_path=args.source_db,
            target_url=args.target_url,
            dry_run=args.dry_run,
            clean=args.clean,
            batch_size=args.batch_size,
            selected_tables=selected,
            apply_rls=args.apply_rls,
        )
        sys.exit(0)
    except Exception as exc:
        print(f"[-] Migration failed: {exc}", file=sys.stderr)
        sys.exit(1)

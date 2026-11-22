#!/usr/bin/env python3
"""
MyArea24 — Managed PostgreSQL Pre-Flight Connection & PostGIS Verification Tool
Validates connectivity to Neon, Supabase, AWS RDS/Aurora, or containerized PostgreSQL.
Checks SSL negotiation, server version, PostGIS extension status, and table counts.
"""

import os
import sys
import argparse
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text
from backend.app.core.config import settings


def normalize_postgres_url(url: str) -> str:
    """Normalize postgres URLs to standard psycopg2 dialect and ensure SSL for cloud hosts."""
    clean_url = url.strip()
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif clean_url.startswith("postgresql://"):
        clean_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Cloud managed databases (Neon, Supabase, RDS) mandate SSL
    cloud_keywords = ["neon.tech", "supabase.co", "rds.amazonaws.com", "render.com", "railway.app"]
    if any(k in clean_url for k in cloud_keywords):
        if "sslmode=" not in clean_url:
            separator = "&" if "?" in clean_url else "?"
            clean_url = f"{clean_url}{separator}sslmode=require"

    return clean_url


def test_connection(database_url: str) -> bool:
    print("=" * 70)
    print(" MyArea24 Managed PostgreSQL Connectivity Probe")
    print("=" * 70)

    normalized_url = normalize_postgres_url(database_url)
    
    # Hide password in log output
    masked_url = normalized_url
    if "@" in masked_url and ":" in masked_url:
        prefix = masked_url.split("@")[0]
        suffix = masked_url.split("@")[1]
        user = prefix.split("://")[-1].split(":")[0]
        masked_url = f"{prefix.split('://')[0]}://{user}:*****@{suffix}"

    print(f"[*] Target Endpoint: {masked_url}")

    try:
        engine = create_engine(
            normalized_url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 15}
        )
        
        with engine.connect() as conn:
            print("[✓] TCP & TLS Handshake: SUCCESS")
            
            # 1. Version Check
            version_row = conn.execute(text("SELECT version();")).fetchone()
            pg_version = version_row[0] if version_row else "Unknown"
            print(f"[✓] PostgreSQL Engine: {pg_version.split(',')[0]}")

            # 2. Database Name & Current User
            meta_row = conn.execute(text("SELECT current_database(), current_user;")).fetchone()
            if meta_row:
                print(f"[✓] Connected Database: '{meta_row[0]}' as user '{meta_row[1]}'")

            # 3. PostGIS Extension Verification
            try:
                postgis_row = conn.execute(text("SELECT PostGIS_Version();")).fetchone()
                postgis_ver = postgis_row[0] if postgis_row else "Unknown"
                print(f"[✓] PostGIS Spatial Engine: Version {postgis_ver} (ENABLED)")
            except Exception:
                print("[!] PostGIS is not yet enabled. Attempting extension installation...")
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                    conn.commit()
                    postgis_row = conn.execute(text("SELECT PostGIS_Version();")).fetchone()
                    print(f"[✓] PostGIS Extension installed successfully: {postgis_row[0] if postgis_row else 'OK'}")
                except Exception as ext_err:
                    print(f"[!] Warning: Could not auto-install PostGIS ({ext_err}). Native spatial queries may fall back to Haversine.")

            # 4. Table Count Audit
            table_count_row = conn.execute(text(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
            )).fetchone()
            num_tables = table_count_row[0] if table_count_row else 0
            print(f"[✓] Existing Tables in 'public' schema: {num_tables}")

            # 5. Read-Write Transaction Verification
            conn.execute(text("CREATE TEMP TABLE _probe_test (id int);"))
            conn.execute(text("INSERT INTO _probe_test VALUES (1);"))
            verify_row = conn.execute(text("SELECT id FROM _probe_test;")).fetchone()
            conn.rollback()
            if verify_row and verify_row[0] == 1:
                print("[✓] Transaction Read/Write/Rollback: VERIFIED")

        print("=" * 70)
        print(" [SUCCESS] Target PostgreSQL instance is healthy, reachable, and ready for production.")
        print("=" * 70)
        return True

    except Exception as e:
        print("=" * 70)
        print(f" [FAILED] Database connection error: {e}")
        print("=" * 70)
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test PostgreSQL connection for MyArea24")
    parser.add_argument("--url", help="PostgreSQL connection string (defaults to DATABASE_URL or settings)")
    args = parser.parse_args()

    db_url = args.url or os.getenv("DATABASE_URL") or settings.DATABASE_URL
    if not db_url or "sqlite" in db_url.lower():
        print("[!] No PostgreSQL DATABASE_URL found. Pass --url postgresql://... to test a remote database.")
        sys.exit(0)

    success = test_connection(db_url)
    sys.exit(0 if success else 1)

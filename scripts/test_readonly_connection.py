#!/usr/bin/env python3
"""
MyArea24 — Strictly Read-Only Database Connection Verifier
Reloads FastAPI Settings from backend/.env and executes 'SELECT 1;' and 'SELECT version();' only.
Never logs, prints, or exposes the password or raw connection URI.
"""
import os
import re
import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Ensure fresh reload of backend/.env
backend_env = BASE_DIR / "backend" / ".env"
if backend_env.exists():
    os.environ["DOTENV_FILE"] = str(backend_env)

# Import FastAPI settings (forcing fresh instance)
from backend.app.core.config import _dotenv_path, settings
from sqlalchemy import create_engine, text

def mask_url(url: str) -> str:
    """Masks credentials for safe logging."""
    if not url:
        return "[NOT SET]"
    return re.sub(r':([^:@]+)@', ':*****@', url)

def test_connection():
    loaded_file = _dotenv_path
    print(f"FastAPI Config Source: {loaded_file}")

    db_url = (settings.DATABASE_URL or "").strip()
    if not db_url or "YOUR-PASSWORD" in db_url or "[YOUR-" in db_url:
        print("1. Connection: Failed")
        print("2. Result of queries:")
        print("   - SELECT 1;: Not executed")
        print("   - SELECT version();: Not executed")
        print("3. Error message: DATABASE_URL still contains unconfigured template placeholders in backend/.env.")
        return False

    if db_url.startswith("sqlite"):
        print("1. Connection: Failed")
        print("2. Result of queries:")
        print("   - SELECT 1;: Not executed")
        print("   - SELECT version();: Not executed")
        print("3. Error message: DATABASE_URL is configured for local SQLite, not PostgreSQL.")
        return False

    # Normalize url for psycopg2
    clean_url = db_url
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif clean_url.startswith("postgresql://") and "+psycopg2" not in clean_url:
        clean_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    if "sslmode=" not in clean_url:
        sep = "&" if "?" in clean_url else "?"
        clean_url = f"{clean_url}{sep}sslmode=require"

    masked = mask_url(clean_url)
    print(f"Target Endpoint (Masked): {masked}")

    try:
        engine = create_engine(
            clean_url,
            connect_args={"connect_timeout": 10},
            pool_pre_ping=True,
            echo=False,
        )
        with engine.connect() as conn:
            # Query 1: SELECT 1;
            q1_res = conn.execute(text("SELECT 1;")).scalar()
            # Query 2: SELECT version();
            q2_res = conn.execute(text("SELECT version();")).scalar()

            if q1_res == 1 and q2_res:
                print("1. Connection: Successful")
                print("2. Result of queries:")
                print(f"   - SELECT 1;: {q1_res} (Success)")
                print(f"   - SELECT version();: {q2_res.strip()} (Success)")
                print("3. Error message: None")
                engine.dispose()
                return True
            else:
                print("1. Connection: Failed")
                print("2. Result of queries:")
                print(f"   - SELECT 1;: {q1_res}")
                print(f"   - SELECT version();: {q2_res}")
                print("3. Error message: Queries returned unexpected results.")
                engine.dispose()
                return False
    except Exception as exc:
        err_msg = str(exc)
        safe_err = re.sub(r':([^:@\s]+)@', ':*****@', err_msg)
        first_line = safe_err.split("\n")[0]
        print("1. Connection: Failed")
        print("2. Result of queries:")
        print("   - SELECT 1;: Failed to execute")
        print("   - SELECT version();: Failed to execute")
        print(f"3. Error message: {first_line}")
        return False

if __name__ == "__main__":
    ok = test_connection()
    sys.exit(0 if ok else 1)

    ok = test_connection()
    sys.exit(0 if ok else 1)

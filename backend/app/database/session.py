import logging
import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Normalize database URL (e.g. postgres:// or postgresql:// -> postgresql+psycopg2:// for SQLAlchemy compatibility)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

is_sqlite = db_url.startswith("sqlite")

# Anchor SQLite relative paths to the canonical project directory
if is_sqlite and ":memory:" not in db_url and not db_url.startswith("sqlite:////"):
    # Strip sqlite prefix to get the filename (e.g. myarea24.db)
    rel_part = db_url.replace("sqlite:///./", "").replace("sqlite:///", "")
    # Check if rel_part is already an absolute path (e.g. on Windows C:/...)
    if not (len(rel_part) > 2 and rel_part[1] == ":"):
        repo_dir = Path(__file__).resolve().parent.parent.parent.parent
        canonical_path = (repo_dir / rel_part).resolve()
        db_url = f"sqlite:///{canonical_path.as_posix()}"

engine_kwargs: dict = {
    "echo": False,
    "pool_pre_ping": True,
}

if is_sqlite:
    # check_same_thread=False allows FastAPI multi-threading; timeout=5.0 waits up to 5s on locks
    from sqlalchemy.pool import QueuePool
    engine_kwargs["connect_args"] = {
        "check_same_thread": False,
        "timeout": 5.0,
    }
    engine_kwargs["poolclass"] = QueuePool
    engine_kwargs["pool_size"] = 15
    engine_kwargs["max_overflow"] = 25
    engine_kwargs["pool_timeout"] = 30
    engine_kwargs["pool_recycle"] = 1800
else:
    # Production PostgreSQL connection pool configuration
    # On serverless platforms (e.g. Vercel) or when explicitly configured, use NullPool to prevent connection exhaustion
    if (settings.DB_POOL_CLASS or "").lower() == "nullpool" or os.getenv("VERCEL"):
        from sqlalchemy.pool import NullPool
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
        engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
        engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE

try:
    engine = create_engine(db_url, **engine_kwargs)
    with engine.connect() as probe_conn:
        pass
except Exception as conn_err:
    logger.warning(f"[session] Primary database connection failed ({conn_err}). Falling back to local SQLite...")
    is_sqlite = True
    repo_dir = Path(__file__).resolve().parent.parent.parent.parent
    canonical_path = (repo_dir / "myarea24.db").resolve()
    db_url = f"sqlite:///{canonical_path.as_posix()}"
    engine = create_engine(
        db_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"check_same_thread": False, "timeout": 5.0},
    )

# For SQLite: enable Write-Ahead Logging (WAL) and concurrency pragmas on connection
_sqlite_migrated = False

if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        global _sqlite_migrated
        cursor = dbapi_connection.cursor()
        try:
            # WAL allows multiple readers and one writer concurrently without blocking readers
            cursor.execute("PRAGMA journal_mode = WAL;")
            # busy_timeout: wait up to 5000ms for busy locks before failing
            cursor.execute("PRAGMA busy_timeout = 5000;")
            # synchronous=NORMAL balances performance and durability safely in WAL mode
            cursor.execute("PRAGMA synchronous = NORMAL;")
            # Enforce foreign key constraints
            cursor.execute("PRAGMA foreign_keys = ON;")
            # Allocate 64MB memory cache for SQLite queries
            cursor.execute("PRAGMA cache_size = -64000;")
            # WAL autocheckpoint at 1000 pages to prevent oversized WAL logs
            cursor.execute("PRAGMA wal_autocheckpoint = 1000;")

            if not _sqlite_migrated:
                _sqlite_migrated = True
                # Ensure password_hash column exists on users table for existing databases
                try:
                    table_info = cursor.execute("PRAGMA table_info(users);").fetchall()
                    cols = [c[1] for c in table_info] if table_info else []
                    if cols and "password_hash" not in cols:
                        cursor.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);")
                except Exception:
                    pass

                # Ensure compliance & settlement columns exist on businesses table for existing databases
                try:
                    b_info = cursor.execute("PRAGMA table_info(businesses);").fetchall()
                    b_cols = [c[1] for c in b_info] if b_info else []
                    if b_cols:
                        if "fssai_license_number" not in b_cols:
                            cursor.execute("ALTER TABLE businesses ADD COLUMN fssai_license_number VARCHAR(50);")
                        if "gstin" not in b_cols:
                            cursor.execute("ALTER TABLE businesses ADD COLUMN gstin VARCHAR(50);")
                        if "settlement_upi_id" not in b_cols:
                            cursor.execute("ALTER TABLE businesses ADD COLUMN settlement_upi_id VARCHAR(100);")
                        if "settlement_bank_account" not in b_cols:
                            cursor.execute("ALTER TABLE businesses ADD COLUMN settlement_bank_account VARCHAR(50);")
                        if "settlement_bank_ifsc" not in b_cols:
                            cursor.execute("ALTER TABLE businesses ADD COLUMN settlement_bank_ifsc VARCHAR(20);")
                except Exception:
                    pass

                # Ensure fulfillment_type exists on orders table for existing databases
                try:
                    o_info = cursor.execute("PRAGMA table_info(orders);").fetchall()
                    o_cols = [c[1] for c in o_info] if o_info else []
                    if o_cols and "fulfillment_type" not in o_cols:
                        cursor.execute("ALTER TABLE orders ADD COLUMN fulfillment_type VARCHAR(20) DEFAULT 'DELIVERY';")
                    cursor.execute("UPDATE orders SET fulfillment_type = 'DELIVERY' WHERE fulfillment_type IS NULL;")
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Could not set SQLite PRAGMA: {e}")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

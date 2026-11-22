"""
MyArea24 — System Telemetry, API Cost Monitoring, Caching & Health Router
"""

import datetime
import os
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.database.session import get_db
from backend.app.services.api_tracker_service import ApiTrackerService
from backend.app.services.telemetry_cache import telemetry_cache
from backend.app.core.config import settings
from backend.app.core.logging import logger

router = APIRouter(prefix="/api/v1/system", tags=["System Diagnostics, Costs & Cache Management"])

_APP_START_TIME = time.time()


@router.get("/api-costs", response_model=Dict[str, Any])
def get_api_usage_and_costs(
    days: int = Query(30, ge=1, le=365, description="Number of past days to aggregate"),
    db: Session = Depends(get_db),
):
    """
    Returns a comprehensive API usage and cost audit across all integrated providers.
    Includes request counts, tokens, estimated INR costs, and quota utilization.
    """
    return ApiTrackerService.get_cost_report(db, days=days)


@router.get("/cache-stats", response_model=Dict[str, Any])
def get_cache_statistics():
    """
    Returns in-memory cache health, active entries, hit rates, and configured category TTLs.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "stats": telemetry_cache.stats(),
    }


@router.post("/cache-refresh", response_model=Dict[str, Any])
def refresh_cache(
    category: Optional[str] = Query(None, description="Category to invalidate (e.g., weather, traffic, events) or None for all"),
):
    """
    Manually invalidates in-memory cached entries for immediate data synchronization.
    """
    if category:
        cleared = telemetry_cache.invalidate_category(category.lower())
        logger.info(f"[cache_management] Invalidated {cleared} entries for category '{category}'.")
        return {
            "success": True,
            "message": f"Successfully invalidated cache for '{category}'.",
            "cleared_entries": cleared,
        }
    else:
        telemetry_cache.clear()
        logger.info("[cache_management] Full cache flush executed.")
        return {
            "success": True,
            "message": "Entire in-memory cache successfully cleared.",
        }


@router.get("/health", response_model=Dict[str, Any])
def get_system_health(db: Session = Depends(get_db)):
    """
    Deep diagnostic endpoint verifying database connection, uptime, and environment status.
    """
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as ex:
        logger.error(f"[system_health] Database check failed: {ex}")

    uptime_sec = round(time.time() - _APP_START_TIME, 1)

    return {
        "status": "UP" if db_ok else "DEGRADED",
        "app_name": settings.APP_NAME,
        "app_env": settings.APP_ENV,
        "uptime_seconds": uptime_sec,
        "database_connected": db_ok,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }

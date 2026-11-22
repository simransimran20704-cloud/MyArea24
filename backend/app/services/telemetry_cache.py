"""
MyArea24 — In-Memory High-Performance TTL Telemetry Cache
Provides thread-safe, zero-cost memory caching for external third-party API telemetry
(WeatherAPI, OpenAQ, TomTom, Agmarknet Mandi, Events, and Fuel Prices).
Includes hit/miss rate tracking, category-specific TTLs, and cache invalidation hooks.
"""

import time
import threading
from typing import Any, Optional, Dict, Tuple


# Configurable Cache Refresh & Invalidation Intervals (Seconds)
CACHE_CATEGORY_TTLS: Dict[str, int] = {
    "weather": 1800,        # 30 minutes
    "traffic": 300,         # 5 minutes
    "air_quality": 1800,    # 30 minutes
    "mandi_prices": 3600,   # 1 hour
    "fuel_rates": 3600,     # 1 hour
    "events": 3600,         # 1 hour
    "businesses": 7200,     # 2 hours
    "emergency": 86400,     # 24 hours
    "default": 1800,        # 30 minutes
}


class TelemetryTTLCache:
    def __init__(self):
        self._cache: Dict[str, Tuple[float, Any, str]] = {}
        self._lock = threading.Lock()
        self._hits: int = 0
        self._misses: int = 0
        self._invalidations: int = 0

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                self._misses += 1
                return None
            expires_at, value, _ = entry
            if now > expires_at:
                del self._cache[key]
                self._misses += 1
                return None
            self._hits += 1
            return value

    def set(self, key: str, value: Any, category: str = "default", ttl_seconds: Optional[int] = None) -> None:
        effective_ttl = ttl_seconds if ttl_seconds is not None else CACHE_CATEGORY_TTLS.get(category, 1800)
        expires_at = time.time() + effective_ttl
        with self._lock:
            # Memory capacity guard (evict expired entries if over 3,000 keys)
            if len(self._cache) > 3000:
                now = time.time()
                keys_to_remove = [k for k, (exp, _, _) in self._cache.items() if now > exp]
                for k in keys_to_remove:
                    del self._cache[k]
                if len(self._cache) > 3000:
                    sorted_keys = sorted(self._cache.items(), key=lambda x: x[1][0])
                    for k, _ in sorted_keys[:300]:
                        del self._cache[k]
            self._cache[key] = (expires_at, value, category)

    def invalidate_category(self, category: str) -> int:
        """Purges all cached keys matching a specific category."""
        count = 0
        with self._lock:
            keys_to_remove = [k for k, (_, _, cat) in self._cache.items() if cat == category]
            for k in keys_to_remove:
                del self._cache[k]
                count += 1
            self._invalidations += count
        return count

    def clear(self) -> None:
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._invalidations += count

    def stats(self) -> Dict[str, Any]:
        now = time.time()
        with self._lock:
            active_count = sum(1 for exp, _, _ in self._cache.values() if now <= exp)
            total_requests = self._hits + self._misses
            hit_rate_pct = round((self._hits / max(1, total_requests)) * 100, 2)
            categories_count: Dict[str, int] = {}
            for exp, _, cat in self._cache.values():
                if now <= exp:
                    categories_count[cat] = categories_count.get(cat, 0) + 1

            return {
                "active_entries": active_count,
                "total_entries": len(self._cache),
                "cache_hits": self._hits,
                "cache_misses": self._misses,
                "hit_rate_pct": hit_rate_pct,
                "manual_invalidations": self._invalidations,
                "category_counts": categories_count,
                "configured_ttls_seconds": CACHE_CATEGORY_TTLS,
            }


# Singleton instance shared across FastAPI application lifecycle
telemetry_cache = TelemetryTTLCache()

import pytest
import time
from unittest.mock import patch, MagicMock
from backend.app.services.indian_spatial_service import (
    SpatialPlacesCache,
    global_places_cache,
    fetch_places_nearby,
)
from backend.app.services.emergency_poi_service import (
    sync_live_emergency_facilities,
    _emergency_spatial_cache,
    EMERGENCY_CACHE_TTL_SECONDS,
)


@pytest.mark.asyncio
async def test_spatial_places_cache_ttl_and_tiers():
    """Verify SpatialPlacesCache is configured with a 6-hour (21,600s) TTL and serves tier 1 & 2 matches."""
    cache = SpatialPlacesCache(maxsize=100, ttl_seconds=21600)
    assert cache.ttl == 21600, "Cache TTL must be at least 6 hours (21600 seconds)"

    dummy_payload = {
        "success": True,
        "source": "test",
        "roads": [{"name": "MG Road", "type": "primary", "lat": 28.6139, "lon": 77.2090}],
        "pois": [{"name": "AIIMS Hospital", "category": "hospital", "latitude": 28.5672, "longitude": 77.2100}],
        "businesses": [{"name": "Gupta Chemist", "category": "Pharmacies", "latitude": 28.6130, "longitude": 77.2095}],
    }

    # Seed cache
    await cache.set(28.6139, 77.2090, 3000, None, dummy_payload)

    # 1. Exact cell hit
    hit_exact = await cache.get(28.6139, 77.2090, 3000, None)
    assert hit_exact is not None
    assert hit_exact["cache_hit"] is True
    assert hit_exact["cache_tier"] == "memory_exact"

    # 2. Spatial proximity hit (< 45% radius drift = < 1.35 km)
    # Drift 0.003 degrees latitude (~330 meters)
    hit_prox = await cache.get(28.6169, 77.2090, 3000, None)
    assert hit_prox is not None
    assert hit_prox["cache_hit"] is True
    assert hit_prox["cache_tier"] == "memory_spatial_proximity"
    assert "spatial_drift_km" in hit_prox
    assert hit_prox["spatial_drift_km"] < 1.35


@pytest.mark.asyncio
async def test_fetch_places_nearby_uses_6hr_cache():
    """Verify fetch_places_nearby serves cached result without calling external Overpass."""
    lat, lon = 19.0760, 72.8777
    res1 = await fetch_places_nearby(lat, lon, radius_meters=2000)
    assert res1["success"] is True

    # Second call should be a cache hit
    res2 = await fetch_places_nearby(lat, lon, radius_meters=2000)
    assert res2["cache_hit"] is True


def test_emergency_poi_6hr_spatial_cache():
    """Verify emergency POI discovery caches 1-km bounding boxes for 6 hours."""
    assert EMERGENCY_CACHE_TTL_SECONDS == 21600

    mock_db = MagicMock()
    lat, lon = 12.9716, 77.5946
    grid_key = (round(lat, 2), round(lon, 2))

    # Clear test grid
    _emergency_spatial_cache.pop(grid_key, None)

    # First call will populate the cache timestamp
    with patch("httpx.Client") as mock_client:
        mock_instance = MagicMock()
        mock_instance.__enter__.return_value = mock_instance
        mock_instance.get.return_value.status_code = 200
        mock_instance.get.return_value.json.return_value = {"results": []}
        mock_instance.post.return_value.status_code = 200
        mock_instance.post.return_value.json.return_value = {"elements": []}
        mock_client.return_value = mock_instance

        sync_live_emergency_facilities(mock_db, lat, lon)
        assert grid_key in _emergency_spatial_cache

        # Reset mock call count
        mock_instance.get.reset_mock()
        mock_instance.post.reset_mock()

        # Second call within 6 hours must be skipped immediately
        res = sync_live_emergency_facilities(mock_db, lat, lon)
        assert res == 0
        assert mock_instance.get.call_count == 0
        assert mock_instance.post.call_count == 0

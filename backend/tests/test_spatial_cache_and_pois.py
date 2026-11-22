import pytest
import time
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.indian_spatial_service import (
    SpatialPlacesCache,
    fetch_places_nearby,
    haversine_km,
)
from backend.app.database.session import get_db, SessionLocal
from backend.app.database.models import Business, EmergencyFacility

client = TestClient(app)


@pytest.mark.asyncio
async def test_spatial_places_cache_exact_and_proximity():
    cache = SpatialPlacesCache(maxsize=100, ttl_seconds=3600)
    lat, lon = 28.6139, 77.2090
    radius = 4000

    test_data = {
        "success": True,
        "pois": [
            {
                "id": "test-p1",
                "name": "Connaught Hospital",
                "category": "hospital",
                "latitude": 28.6150,
                "longitude": 77.2100,
                "distanceKm": 0.15,
                "sublabel": "HOSPITAL • 0.15 km",
            }
        ],
        "roads": [{"name": "Barakhamba Road", "type": "primary", "lat": 28.6140, "lon": 77.2095}],
        "businesses": [
            {
                "id": "test-b1",
                "name": "Saravana Bhavan",
                "category": "Restaurants",
                "latitude": 28.6145,
                "longitude": 77.2092,
                "distance_km": 0.08,
            }
        ],
    }

    # Store in cache
    await cache.set(lat, lon, radius, None, test_data)

    # 1. Exact match hit
    hit_exact = await cache.get(lat, lon, radius, None)
    assert hit_exact is not None
    assert hit_exact["cache_hit"] is True
    assert hit_exact["cache_tier"] == "memory_exact"

    # 2. Spatial proximity hit: pan 500m away (well within 4000m * 0.45 = 1800m)
    pan_lat = lat + 0.003
    pan_lon = lon + 0.003
    hit_proximity = await cache.get(pan_lat, pan_lon, radius, None)
    assert hit_proximity is not None
    assert hit_proximity["cache_hit"] is True
    assert hit_proximity["cache_tier"] == "memory_spatial_proximity"
    assert "spatial_drift_km" in hit_proximity
    # Verified distance recalculation
    recalc_dist = hit_proximity["pois"][0]["distanceKm"]
    expected_dist = round(haversine_km(pan_lat, pan_lon, 28.6150, 77.2100), 2)
    assert recalc_dist == expected_dist


@pytest.mark.asyncio
async def test_fetch_places_nearby_with_db():
    db = SessionLocal()
    try:
        # Create a test emergency facility
        test_fac = EmergencyFacility(
            name="Test Metro Trauma Care",
            facility_type="Hospital",
            address="Connaught Place Outer Circle, New Delhi",
            latitude=28.6300,
            longitude=77.2180,
            phone="108",
            locality="Connaught Place",
            city="New Delhi",
            state="Delhi NCR",
        )
        db.add(test_fac)
        db.commit()
        db.refresh(test_fac)

        from backend.app.services.indian_spatial_service import global_places_cache
        global_places_cache.cache.clear()

        res = await fetch_places_nearby(28.6304, 77.2177, radius_meters=3000, db=db)
        assert res["success"] is True
        assert len(res["pois"]) > 0

        # Verify facility was resolved in database query
        found = any(p["name"] == "Test Metro Trauma Care" for p in res["pois"])
        assert found is True

        # Clean up
        db.delete(test_fac)
        db.commit()
    finally:
        db.close()


def test_places_nearby_api_endpoint():
    response = client.get("/api/v1/locations/places-nearby?lat=28.6139&lon=77.2090&radius=4000")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "pois" in data
    assert "roads" in data
    assert "businesses" in data

    # Plural alias test
    response_alias = client.get("/api/v1/location/places-nearby?lat=28.6139&lon=77.2090&radius=4000")
    assert response_alias.status_code == 200
    assert response_alias.json()["success"] is True

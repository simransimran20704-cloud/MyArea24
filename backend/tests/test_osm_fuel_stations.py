"""
Unit and Integration Tests for Dynamic Fuel & CNG Station Discovery
using OpenStreetMap Overpass API (amenity=fuel).
Verifies:
1. Strict CNG tag detection (never assuming every station has CNG).
2. Detail extraction (name, coords, address, fuels, hours, contact).
3. Selected-area and radius-based queries across India.
4. Database spatial caching in fuel_stations table.
5. Endpoints: /api/v1/fuel/stations and /api/v1/locations/places-nearby.
6. OpenStreetMap ODbL attribution and navigation links.
"""

import datetime
import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database.session import Base, engine, SessionLocal, get_db
from backend.app.database.models import FuelStationRecord
from backend.app.integrations.fuel.osm_fuel_client import (
    OsmFuelClient,
    OsmFuelStation,
    haversine_distance_km,
)
from backend.app.services.osm_fuel_station_service import (
    OsmFuelStationService,
    osm_fuel_station_service,
)

# Ensure tables exist in database
Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


MOCK_OSM_ELEMENTS = [
    {
        "type": "node",
        "id": 4122590190,
        "lat": 28.6288,
        "lon": 77.2102,
        "tags": {
            "amenity": "fuel",
            "brand": "Bharat Petroleum",
            "name": "Bharat Petroleum Petrol Pump",
            "addr:street": "Baba Kharak Singh Marg",
            "addr:city": "New Delhi",
            "addr:postcode": "110001",
            "opening_hours": "24/7",
            "phone": "+91-11-23344556",
            "fuel:petrol": "yes",
            "fuel:diesel": "yes",
        },
    },
    {
        "type": "node",
        "id": 5193360429,
        "lat": 28.6318,
        "lon": 77.2215,
        "tags": {
            "amenity": "fuel",
            "name": "Indraprastha Gas Limited CNG Station",
            "operator": "Indraprastha Gas Limited",
            "brand": "IGL",
            "addr:place": "Connaught Place",
            "addr:city": "New Delhi",
            "opening_hours": "06:00-23:00",
            "fuel:cng": "yes",
        },
    },
    {
        "type": "way",
        "id": 987654321,
        "center": {"lat": 28.6350, "lon": 77.2250},
        "tags": {
            "amenity": "fuel",
            "name": "Indian Oil Auto Care (Petrol, Diesel & CNG)",
            "brand": "Indian Oil",
            "addr:street": "Barakhamba Road",
            "addr:city": "New Delhi",
            "opening_hours": "24/7",
            "fuel:cng": "yes",
            "fuel:petrol": "yes",
            "fuel:diesel": "yes",
            "contact:phone": "+91-98110-24024",
        },
    },
]


def test_haversine_distance():
    # Distance between Connaught Place (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is ~2.4 km
    d = haversine_distance_km(28.6315, 77.2167, 28.6129, 77.2295)
    assert 2.0 <= d <= 3.0


def test_strict_cng_detection():
    osm_client = OsmFuelClient()

    # 1. Standard OMC petrol pump without CNG tags -> has_cng MUST be False
    bpcl = osm_client._parse_element(MOCK_OSM_ELEMENTS[0], 28.63, 77.21)
    assert bpcl is not None
    assert bpcl.has_cng is False
    assert bpcl.has_petrol is True
    assert bpcl.has_diesel is True
    assert "CNG" not in bpcl.fuel_types
    assert "Petrol" in bpcl.fuel_types
    assert "Diesel" in bpcl.fuel_types
    assert bpcl.brand == "Bharat Petroleum"
    assert bpcl.opening_hours == "24/7"
    assert bpcl.phone == "+91-11-23344556"

    # 2. IGL station with explicit CNG tag -> has_cng MUST be True, has_petrol MUST be False
    igl = osm_client._parse_element(MOCK_OSM_ELEMENTS[1], 28.63, 77.21)
    assert igl is not None
    assert igl.has_cng is True
    assert igl.has_petrol is False
    assert igl.fuel_types == ["CNG"]
    assert igl.opening_hours == "06:00-23:00"

    # 3. Hybrid station (IOCL with both Petrol/Diesel and CNG)
    iocl = osm_client._parse_element(MOCK_OSM_ELEMENTS[2], 28.63, 77.21)
    assert iocl is not None
    assert iocl.has_cng is True
    assert iocl.has_petrol is True
    assert iocl.has_diesel is True
    assert "CNG" in iocl.fuel_types
    assert "Petrol" in iocl.fuel_types
    assert "Diesel" in iocl.fuel_types


@pytest.mark.asyncio
async def test_fuel_station_service_caching_and_db(db_session):
    mock_client = OsmFuelClient()
    mock_client.fetch_nearby_fuel_stations = AsyncMock(return_value=[
        mock_client._parse_element(MOCK_OSM_ELEMENTS[0], 28.63, 77.21),
        mock_client._parse_element(MOCK_OSM_ELEMENTS[1], 28.63, 77.21),
        mock_client._parse_element(MOCK_OSM_ELEMENTS[2], 28.63, 77.21),
    ])

    service = OsmFuelStationService(client=mock_client)

    # 1. First fetch -> calls Overpass API and saves to database
    res = await service.get_fuel_stations(lat=28.63, lon=77.21, radius_km=5.0, db=db_session)
    assert res["success"] is True
    assert res["total"] == 3
    assert res["cached"] is False
    assert len(res["stations"]) == 3
    assert "attribution" in res
    assert "© OpenStreetMap contributors" in res["attribution"]

    # Verify rows in database
    db_rows = db_session.query(FuelStationRecord).filter(
        FuelStationRecord.osm_id.in_(["node:4122590190", "node:5193360429", "way:987654321"])
    ).all()
    assert len(db_rows) == 3

    # Check navigation link format
    st0 = res["stations"][0]
    assert "navigation_url" in st0
    assert "openstreetmap.org/directions" in st0["navigation_url"]
    assert "distance_km" in st0

    # 2. Second fetch -> hits Tier-2 database spatial cache (no client call)
    mock_client.fetch_nearby_fuel_stations.reset_mock()
    res2 = await service.get_fuel_stations(lat=28.63, lon=77.21, radius_km=5.0, db=db_session)
    assert res2["success"] is True
    assert res2["cached"] is True
    assert res2["total"] == 3
    mock_client.fetch_nearby_fuel_stations.assert_not_called()


def test_api_fuel_stations_endpoint(client, db_session):
    # Ensure fresh test records in DB
    existing = db_session.query(FuelStationRecord).filter(
        FuelStationRecord.osm_id.in_(["node:test_hp_101", "node:test_igl_102"])
    ).all()
    for e in existing:
        db_session.delete(e)
    db_session.commit()

    st1 = FuelStationRecord(
        osm_id="node:test_hp_101",
        name="HP Auto Care Centre Test",
        brand="Hindustan Petroleum",
        latitude=28.6280,
        longitude=77.2150,
        address="Connaught Circus, New Delhi",
        city="New Delhi",
        has_cng=False,
        has_petrol=True,
        has_diesel=True,
        fuel_types_json=json.dumps(["Petrol", "Diesel"]),
        opening_hours="24/7",
        phone="+91-11-23311223",
        source_provider="osm_overpass",
        last_synced_at=datetime.datetime.utcnow(),
    )
    st2 = FuelStationRecord(
        osm_id="node:test_igl_102",
        name="IGL CNG Filling Station Test",
        operator="IGL",
        latitude=28.6320,
        longitude=77.2180,
        address="Barakhamba Road, New Delhi",
        city="New Delhi",
        has_cng=True,
        has_petrol=False,
        has_diesel=False,
        fuel_types_json=json.dumps(["CNG"]),
        opening_hours="06:00-23:00",
        phone="+91-11-23322334",
        source_provider="osm_overpass",
        last_synced_at=datetime.datetime.utcnow(),
    )
    db_session.add(st1)
    db_session.add(st2)
    db_session.commit()

    # Clear service memory cache to force DB read
    osm_fuel_station_service._memory_cache.clear()

    # Query all fuel stations
    resp = client.get("/api/v1/fuel/stations?lat=28.63&lon=77.21&radius_km=5.0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["total"] >= 2
    names = [s["name"] for s in data["stations"]]
    assert any("HP Auto Care" in n for n in names)

    # Filter for CNG only
    resp_cng = client.get("/api/v1/fuel/stations?lat=28.63&lon=77.21&radius_km=5.0&fuel_type=cng")
    assert resp_cng.status_code == 200
    data_cng = resp_cng.json()
    assert data_cng["success"] is True
    assert all(s["has_cng"] is True for s in data_cng["stations"])


@pytest.mark.asyncio
async def test_places_nearby_fuel_integration(db_session):
    # Verify get_nearby_fuel_pois_for_spatial generates standard LiveNearbyPoi schema
    pois = await osm_fuel_station_service.get_nearby_fuel_pois_for_spatial(
        lat=28.63, lon=77.21, radius_meters=5000, db=db_session
    )
    assert len(pois) >= 2
    for p in pois:
        assert p["category"] == "fuel"
        assert "name" in p
        assert "distanceKm" in p
        assert "latitude" in p
        assert "longitude" in p
        assert "sublabel" in p
        assert "has_cng" in p
        if p["has_cng"]:
            assert "CNG" in p["sublabel"]

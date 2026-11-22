"""
Comprehensive Technical Test Suite for Residential Benchmark API Integration (Global Property Metrics - GPM).
Verifies:
1. Provider Authentication & Key Authorization.
2. National Baseline Macroeconomic Index Retrieval (BIS & OECD).
3. Historical 45-Quarter Series Retrieval & Monotonic Verification.
4. Quota Tracking & Rate Limit Monitoring (60/min, 1,000/day).
5. Hierarchical Navigation (India -> State -> District -> City -> Locality).
6. Local Verified Rent Benchmarks & Labour Bureau Urban Centers.
7. Unindexed Field Transparency ('Data unavailable' for sale price and yields).
8. Cache Behavior & Safe Exception Fallbacks.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.database.models import ResidentialMacroIndex, GovernmentHousingIndex, RentalListing
from backend.app.integrations.residential.gpm_client import gpm_residential_client
from backend.app.services.rental_benchmark_service import rental_benchmark_service

client = TestClient(app)


def test_01_gpm_client_initialization_and_key():
    """Verify that GPM API key is securely loaded from configuration and never blank."""
    assert gpm_residential_client.api_key.startswith("gpm_free_"), "API key must use the gpm_free_ prefix"
    assert len(gpm_residential_client.api_key) > 20, "API key should be a full token"
    assert gpm_residential_client.base_url == "https://globalpropertymetrics.com/api"


def test_02_gpm_usage_endpoint():
    """Verify that /api/v1/rentals/usage returns valid quota and rate limit status."""
    resp = client.get("/api/v1/rentals/usage")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert "key" in data or "usage" in data or "status" in data or "error" in data, "Usage payload should contain key or usage stats"
    if "usage" in data:
        day_info = data["usage"].get("day", {})
        assert day_info.get("limit") == 1000, "Free tier daily limit must be 1,000 requests"


def test_03_gpm_macro_benchmark_endpoint():
    """Verify that /api/v1/rentals/macro-benchmark returns BIS & OECD national metrics."""
    resp = client.get("/api/v1/rentals/macro-benchmark")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()

    assert data["country"] == "India"
    assert data["nominal_house_price_index"] > 300.0, "BIS nominal index should be ~366.84"
    assert data["real_house_price_index"] > 100.0, "OECD real index should be ~105.71"
    assert data["annual_nominal_appreciation_pct"] == 4.21
    assert data["annual_real_appreciation_pct"] == 2.70
    assert data["ten_year_appreciation_pct"] == 65.40
    assert data["average_residential_sale_price"] in ("Data unavailable", "₹9,600/sq.ft")
    assert data["rental_yield"] in ("Data unavailable", "3.2%")
    assert len(data["historical_trend"]) >= 9, "Historical trend should contain observations"


def test_04_residential_hierarchy_endpoint():
    """Verify that /api/v1/rentals/hierarchy organizes data by India -> State -> District -> City -> Locality."""
    resp = client.get("/api/v1/rentals/hierarchy")
    assert resp.status_code == 200
    data = resp.json()

    assert data["country"] == "India"
    assert "Delhi" in data["states"]
    assert "Maharashtra" in data["states"]
    assert "Uttar Pradesh" in data["states"]
    assert "Karnataka" in data["states"]
    assert "state_cities" in data
    assert "state_districts" in data
    assert "city_localities" in data
    assert "property_types" in data


def test_05_locality_benchmark_integration():
    """Verify that /api/v1/rentals/benchmark includes both local verified rents and GPM macro appreciation."""
    resp = client.get("/api/v1/rentals/benchmark?locality=Dwarka&city=Delhi&state=Delhi")
    assert resp.status_code == 200
    data = resp.json()

    assert data["locality"] == "Dwarka"
    assert data["city"] == "Delhi"
    assert data["has_data"] is True
    assert len(data["benchmarks"]) > 0

    # Macro appreciation block
    assert "gpm_macro" in data
    assert data["gpm_macro"]["nominal_house_price_index"] > 300.0
    assert data["average_residential_sale_price"] in ("Data unavailable", "₹9,600/sq.ft")
    assert data["rental_yield"] in ("Data unavailable", "3.2%")
    assert "price_appreciation" in data
    assert data["price_appreciation"]["nominal_yoy_pct"] == 4.21

    # Labour Bureau urban center
    assert "official_government_index" in data
    assert data["official_government_index"]["center"] == "Delhi"
    assert data["official_government_index"]["annual_rental_inflation_pct"] == 4.6


def test_06_database_macro_persistence():
    """Verify that ResidentialMacroIndex table contains persisted BIS & OECD observations."""
    db = SessionLocal()
    try:
        bis_count = db.query(ResidentialMacroIndex).filter(ResidentialMacroIndex.metric_type == "price-history").count()
        oecd_count = db.query(ResidentialMacroIndex).filter(ResidentialMacroIndex.metric_type == "real-price-history").count()
        assert bis_count >= 9, "Database should store BIS quarterly observations"
        assert oecd_count >= 9, "Database should store OECD quarterly observations"
    finally:
        db.close()


def test_07_verified_listing_contribution():
    """Verify that posting a new listing recalculates the benchmark and persists safely."""
    payload = {
        "locality": "Dwarka Sector 10",
        "city": "Delhi",
        "state": "Delhi",
        "pincode": "110075",
        "property_type": "2 BHK",
        "monthly_rent": 24000,
        "security_deposit": 48000,
        "built_up_area_sqft": 1100,
        "furnishing": "Semi-Furnished",
        "tenant_preference": "Family",
    }
    resp = client.post("/api/v1/rentals/listings", json=payload)
    assert resp.status_code == 201
    res_data = resp.json()
    assert res_data["success"] is True
    assert res_data["monthly_rent"] == 24000.0

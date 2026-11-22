import datetime
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.models import FuelPriceRecord
from backend.app.database.session import SessionLocal, engine, Base
from backend.app.integrations.fuel.india_petroleum import IndiaPetroleumClient
from backend.app.services.fuel_service import FuelPriceService, fuel_price_service
from backend.app.main import app

# Ensure table exists
Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def mock_upstream_latest():
    return {
        "success": True,
        "source_date": "2026-10-30",
        "source_posted_date": "2026-10-30",
        "attribution": "Petroleum Planning & Analysis Cell (PPAC), MoPNG, GoI",
        "latest_fetched_at": "2026-10-30T10:14:38.088Z",
        "prices": {
            "delhi": {
                "city_slug": "delhi",
                "city_name": "Delhi",
                "petrol": 102.12,
                "diesel": 95.20,
            },
            "mumbai": {
                "city_slug": "mumbai",
                "city_name": "Mumbai",
                "petrol": 111.21,
                "diesel": 97.83,
            },
            "chennai": {
                "city_slug": "chennai",
                "city_name": "Chennai",
                "petrol": 107.77,
                "diesel": 99.55,
            },
            "kolkata": {
                "city_slug": "kolkata",
                "city_name": "Kolkata",
                "petrol": 113.51,
                "diesel": 99.82,
            },
        },
    }


@pytest.fixture
def mock_upstream_cities():
    return [
        {"slug": "delhi", "name": "Delhi"},
        {"slug": "mumbai", "name": "Mumbai"},
        {"slug": "chennai", "name": "Chennai"},
        {"slug": "kolkata", "name": "Kolkata"},
    ]


@pytest.mark.asyncio
async def test_fuel_service_sync_and_persistence(db_session: Session, mock_upstream_latest):
    """Verify city-wise prices, fuel type, source date and last fetched timestamp are stored in DB."""
    mock_client = AsyncMock(spec=IndiaPetroleumClient)
    mock_client.fetch_latest_prices.return_value = mock_upstream_latest
    mock_client.provider_id = "india_petroleum_api"

    service = FuelPriceService(primary_provider=mock_client)
    res = await service.sync_and_store_latest(db_session)

    assert res["status"] == "success"
    assert res["records_stored"] == 8  # 4 cities * 2 fuels (petrol & diesel)
    assert res["source_date"] == "2026-10-30"

    # Query DB to verify stored records
    delhi_petrol = (
        db_session.query(FuelPriceRecord)
        .filter(
            FuelPriceRecord.city_slug == "delhi",
            FuelPriceRecord.fuel_type == "petrol",
            FuelPriceRecord.source_date == "2026-10-30",
        )
        .first()
    )
    assert delhi_petrol is not None
    assert delhi_petrol.price == 102.12
    assert delhi_petrol.city_name == "Delhi"
    assert delhi_petrol.fuel_type == "petrol"
    assert delhi_petrol.currency == "INR"
    assert delhi_petrol.unit == "L"
    assert delhi_petrol.source_date == "2026-10-30"
    assert delhi_petrol.last_fetched_at is not None
    assert delhi_petrol.is_verified is True

    mumbai_diesel = (
        db_session.query(FuelPriceRecord)
        .filter(
            FuelPriceRecord.city_slug == "mumbai",
            FuelPriceRecord.fuel_type == "diesel",
            FuelPriceRecord.source_date == "2026-10-30",
        )
        .first()
    )
    assert mumbai_diesel is not None
    assert mumbai_diesel.price == 97.83


@pytest.mark.asyncio
async def test_fuel_service_fallback_on_api_error(db_session: Session, mock_upstream_latest):
    """Verify graceful fallback to last successfully fetched data if upstream fails."""
    # First ensure DB has data
    mock_client = AsyncMock(spec=IndiaPetroleumClient)
    mock_client.fetch_latest_prices.return_value = mock_upstream_latest
    mock_client.provider_id = "india_petroleum_api"
    service = FuelPriceService(primary_provider=mock_client)
    await service.sync_and_store_latest(db_session)

    # Invalidate in-memory cache to force fetch
    service._cache_latest = None

    # Now make provider raise an error
    failing_client = AsyncMock(spec=IndiaPetroleumClient)
    failing_client.fetch_latest_prices.side_effect = RuntimeError("Upstream API 503 Service Unavailable")
    failing_client.provider_id = "india_petroleum_api"

    fallback_service = FuelPriceService(primary_provider=failing_client)
    data = await fallback_service.get_latest_prices(city=None, db=db_session)

    assert data["success"] is True
    assert data.get("is_fallback") is True
    assert "delhi" in data["prices"]
    assert data["prices"]["delhi"]["petrol"] == 102.12


@pytest.mark.asyncio
async def test_no_hardcoding_and_unsupported_city_verification(mock_upstream_latest):
    """Verify that unsupported cities are never assigned fake/hardcoded prices as verified data."""
    mock_client = AsyncMock(spec=IndiaPetroleumClient)
    mock_client.fetch_latest_prices.return_value = mock_upstream_latest
    service = FuelPriceService(primary_provider=mock_client)

    # 1. Supported city
    frontend_delhi = service.format_for_frontend(mock_upstream_latest, target_city="New Delhi")
    assert frontend_delhi["is_verified"] is True
    assert frontend_delhi["is_supported"] is True
    assert frontend_delhi["petrol"] == 102.12
    assert frontend_delhi["diesel"] == 95.20

    # 2. Unsupported city (e.g. "Patna" or "Shimla")
    frontend_unsupported = service.format_for_frontend(mock_upstream_latest, target_city="Shimla", target_state="Himachal Pradesh")
    assert frontend_unsupported["is_verified"] is False
    assert frontend_unsupported["is_supported"] is False
    assert frontend_unsupported["petrol"] is None
    assert frontend_unsupported["diesel"] is None
    assert "Delhi" in frontend_unsupported["supported_cities"]


def test_fuel_rest_api_endpoints(db_session: Session, mock_upstream_latest, mock_upstream_cities):
    """Test REST API endpoints /api/v1/fuel/latest, /api/v1/fuel/cities, /api/v1/fuel/history."""
    with patch.object(fuel_price_service.provider, "fetch_latest_prices", AsyncMock(return_value=mock_upstream_latest)), \
         patch.object(fuel_price_service.provider, "fetch_available_cities", AsyncMock(return_value=mock_upstream_cities)):

        client = TestClient(app)

        # 1. GET /api/v1/fuel/latest
        res_latest = client.get("/api/v1/fuel/latest")
        assert res_latest.status_code == 200
        latest_json = res_latest.json()
        assert latest_json["success"] is True
        assert "prices" in latest_json
        assert "delhi" in latest_json["prices"]

        # 2. GET /api/v1/fuel/latest?city=mumbai
        res_mumbai = client.get("/api/v1/fuel/latest?city=mumbai")
        assert res_mumbai.status_code == 200
        mumbai_json = res_mumbai.json()
        assert "mumbai" in mumbai_json["prices"]
        assert mumbai_json["prices"]["mumbai"]["petrol"] == 111.21

        # 3. GET /api/v1/fuel/cities
        res_cities = client.get("/api/v1/fuel/cities")
        assert res_cities.status_code == 200
        cities_json = res_cities.json()
        assert cities_json["success"] is True
        assert cities_json["total"] >= 4

        # 4. GET /api/v1/fuel/history
        res_hist = client.get("/api/v1/fuel/history?city=delhi&limit=10")
        assert res_hist.status_code == 200
        hist_json = res_hist.json()
        assert hist_json["success"] is True

        # 5. GET /api/v1/fuel-rates (existing frontend endpoint)
        res_rates = client.get("/api/v1/fuel-rates?city=Delhi")
        assert res_rates.status_code == 200
        rates_json = res_rates.json()
        assert rates_json["is_verified"] is True
        assert rates_json["petrol"] == 102.12
        assert rates_json["diesel"] == 95.20
        assert "items" in rates_json

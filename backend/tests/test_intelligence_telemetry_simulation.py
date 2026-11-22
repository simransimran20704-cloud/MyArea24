import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.database.models import WeatherObservation, AirQualityObservation
import datetime

client = TestClient(app)


def test_weather_telemetry_simulation_flag():
    """Verify Weather API returns is_simulated flag."""
    # 1. Query for coordinates where third-party API is offline/quota limit -> should gracefully serve estimated with is_simulated=True
    response = client.get("/api/v1/intelligence/weather?lat=19.0760&lon=72.8777&area=Mumbai")
    assert response.status_code == 200
    data = response.json()
    assert "is_simulated" in data
    assert isinstance(data["is_simulated"], bool)
    assert data["is_available"] is True
    assert data["temperature_c"] is not None

    # 2. Insert verified live observation and verify is_simulated is False
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        live_obs = WeatherObservation(
            source_id="weatherapi",
            source_record_id=f"test_live_weather_{int(now.timestamp())}",
            location_name="Live Test Location",
            latitude=28.6139,
            longitude=77.2090,
            observed_at=now,
            temperature_c=29.5,
            precipitation_mm=0.0,
            condition_text="Clear",
            wind_kph=10.0,
            humidity=45,
        )
        db.add(live_obs)
        db.commit()

        res2 = client.get("/api/v1/intelligence/weather?lat=28.6139&lon=77.2090&area=Live Test Location")
        assert res2.status_code == 200
        d2 = res2.json()
        assert d2["is_simulated"] is False

        db.delete(live_obs)
        db.commit()
    finally:
        db.close()


def test_air_quality_telemetry_simulation_flag():
    """Verify Air Quality API returns is_simulated flag and graceful baseline."""
    response = client.get("/api/v1/intelligence/air-quality?lat=26.8467&lon=80.9462&area=Lucknow")
    assert response.status_code == 200
    data = response.json()
    assert "is_simulated" in data
    assert isinstance(data["is_simulated"], bool)
    assert data["is_available"] is True
    assert data["aqi_value"] is not None


def test_traffic_telemetry_simulation_flag():
    """Verify Traffic API returns is_simulated flag."""
    response = client.get("/api/v1/intelligence/traffic?lat=28.6139&lon=77.2090&area=Connaught Place")
    assert response.status_code == 200
    data = response.json()
    assert "is_simulated" in data
    assert isinstance(data["is_simulated"], bool)
    assert data["is_available"] is True


def test_snapshot_composite_simulation_flag():
    """Verify composite snapshot reports overall is_simulated status."""
    response = client.get("/api/v1/intelligence/snapshot?lat=28.6139&lon=77.2090&area=Connaught Place&city=New Delhi&state=Delhi NCR")
    assert response.status_code == 200
    data = response.json()
    assert "is_simulated" in data
    assert isinstance(data["is_simulated"], bool)
    assert "weather" in data
    assert "air_quality" in data
    assert "traffic" in data
    if data["weather"]:
        assert "is_simulated" in data["weather"]
    if data["air_quality"]:
        assert "is_simulated" in data["air_quality"]
    if data["traffic"]:
        assert "is_simulated" in data["traffic"]

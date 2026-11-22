import pytest
from backend.app.core.config import settings

@pytest.fixture(autouse=True)
def configure_test_environment(monkeypatch):
    """Ensure testing environment settings are active for all pytest runs."""
    monkeypatch.setattr(settings, "OTP_DEV_MODE", True)
    monkeypatch.setattr(settings, "APP_ENV", "testing")
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.setattr(settings, "INGESTION_ENABLED", False)

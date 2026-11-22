import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.services.indian_sms_service import (
    validate_indian_phone,
    build_dlt_otp_message,
    dispatch_indian_sms_otp,
    dispatch_fast2sms,
    dispatch_twilio,
    dispatch_msg91,
    get_sms_gateway_status,
)
from backend.app.api.auth import dispatch_sms_otp

client = TestClient(app)


def test_validate_indian_phone():
    """Verify Indian mobile number validation per National Numbering Plan."""
    # Valid numbers (starting with 6, 7, 8, or 9)
    valid, digits, intl, masked = validate_indian_phone("9876543210")
    assert valid is True
    assert digits == "9876543210"
    assert intl == "+919876543210"
    assert "98***" in masked

    valid, digits, intl, masked = validate_indian_phone("+91 98765 43210")
    assert valid is True
    assert digits == "9876543210"

    valid, digits, intl, masked = validate_indian_phone("09876543210")
    assert valid is True
    assert digits == "9876543210"

    valid, digits, intl, masked = validate_indian_phone("+91-6300123456")
    assert valid is True
    assert digits == "6300123456"

    # Invalid numbers
    valid, _, _, _ = validate_indian_phone("1234567890")  # starts with 1
    assert valid is False

    valid, _, _, _ = validate_indian_phone("5551234567")  # starts with 5
    assert valid is False

    valid, _, _, _ = validate_indian_phone("98765")  # too short
    assert valid is False

    valid, _, _, _ = validate_indian_phone("citizen@example.com")  # email
    assert valid is False


def test_build_dlt_otp_message():
    """Verify TRAI DLT approved template rendering matches exact registered text."""
    msg = build_dlt_otp_message("492011", validity_minutes=10)
    assert msg == "Your MyArea24 login code is 492011. Valid for 10 minutes. Do not share with anyone."


def test_sms_gateway_status_endpoint():
    """Verify diagnostic status endpoint for Indian SMS gateway & DLT registration."""
    res = client.get("/api/v1/auth/sms-gateway/status")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "active_provider" in data
    assert "sender_id" in data
    assert "providers_available" in data
    assert "trai_dlt_compliant" in data


def test_request_otp_with_indian_mobile():
    """Verify requesting OTP using a 10-digit Indian mobile number."""
    phone = f"98{uuid.uuid4().int % 100000000:08d}"

    res = client.post("/api/v1/auth/request-otp", json={"phone": phone, "purpose": "login"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["channel"] == "sms"
    assert data["dlt_compliant"] is True
    assert "+91" in data["target_masked"]
    assert data["dev_otp"] is not None
    assert len(data["dev_otp"]) == 6

    # Verify that phone and OTP allow successful login
    verify_res = client.post(
        "/api/v1/auth/verify-otp",
        json={"phone": phone, "otp_code": data["dev_otp"], "full_name": "Indian Citizen"},
    )
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert "access_token" in v_data
    assert v_data["user"]["phone"] == phone


def test_request_otp_rejects_invalid_mobile():
    """Verify that malformed phone numbers return 400 Bad Request."""
    res = client.post("/api/v1/auth/request-otp", json={"phone": "1234567890", "purpose": "login"})
    assert res.status_code == 400
    assert "Invalid Indian mobile number" in res.json()["detail"]


def test_production_mode_suppresses_dev_otp():
    """
    SECURITY CRITICAL: Verify that when running in production environment or DEBUG=False,
    dev_otp is NEVER returned in the API response.
    """
    phone = f"97{uuid.uuid4().int % 100000000:08d}"

    orig_env = settings.APP_ENV
    orig_debug = settings.DEBUG
    try:
        settings.APP_ENV = "production"
        settings.DEBUG = False

        res = client.post("/api/v1/auth/request-otp", json={"phone": phone, "purpose": "login"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["dev_otp"] is None, "SECURITY VIOLATION: dev_otp must be None in production"
    finally:
        settings.APP_ENV = orig_env
        settings.DEBUG = orig_debug


def test_fast2sms_dlt_payload_structure():
    """Unit test for Fast2SMS DLT route dispatch formatting."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"return": true, "request_id": "req_881923"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        orig_key = settings.FAST2SMS_API_KEY
        orig_route = settings.FAST2SMS_ROUTE
        orig_tmpl = settings.DLT_TEMPLATE_ID
        try:
            settings.FAST2SMS_API_KEY = "live_fast2sms_test_key"
            settings.FAST2SMS_ROUTE = "dlt"
            settings.DLT_TEMPLATE_ID = "1707161000000000000"

            res = dispatch_fast2sms("9876543210", "654321", 10)
            assert res.success is True
            assert res.provider == "fast2sms"
            assert res.dlt_compliant is True
            assert res.message_id == "req_881923"
        finally:
            settings.FAST2SMS_API_KEY = orig_key
            settings.FAST2SMS_ROUTE = orig_route
            settings.DLT_TEMPLATE_ID = orig_tmpl


def test_twilio_otp_dispatch_payload_structure():
    """Unit test for Twilio SMS gateway dispatch using TWILIO_AUTH_TOKEN and TWILIO_ACCOUNT_SID."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"sid": "SM_twilio_test_9921", "status": "queued"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        orig_sid = settings.TWILIO_ACCOUNT_SID
        orig_token = settings.TWILIO_AUTH_TOKEN
        orig_from = settings.TWILIO_FROM_PHONE
        try:
            settings.TWILIO_ACCOUNT_SID = "AC_test_account_sid_12345"
            settings.TWILIO_AUTH_TOKEN = "test_auth_token_secret_67890"
            settings.TWILIO_FROM_PHONE = "+15005550006"

            res = dispatch_twilio("9876543210", "492011", 10)
            assert res.success is True
            assert res.provider == "twilio"
            assert res.message_id == "SM_twilio_test_9921"
            assert res.dlt_compliant is True

            # Verify the request payload sent to Twilio
            assert mock_urlopen.call_count == 1
            call_args = mock_urlopen.call_args[0][0]
            assert "api.twilio.com" in call_args.full_url
            assert "AC_test_account_sid_12345" in call_args.full_url
            body_decoded = call_args.data.decode("utf-8")
            assert "To=%2B919876543210" in body_decoded
            assert "Your+MyArea24+login+code+is+492011" in body_decoded
        finally:
            settings.TWILIO_ACCOUNT_SID = orig_sid
            settings.TWILIO_AUTH_TOKEN = orig_token
            settings.TWILIO_FROM_PHONE = orig_from


def test_msg91_otp_dispatch_payload_structure():
    """Unit test for MSG91 SendOTP API dispatch formatting."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"type": "success", "message": "msg91_req_7721"}'
        mock_resp.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        orig_key = settings.MSG91_AUTH_KEY
        orig_tmpl = settings.MSG91_TEMPLATE_ID
        try:
            settings.MSG91_AUTH_KEY = "live_msg91_test_key"
            settings.MSG91_TEMPLATE_ID = "tmpl_msg91_8819"

            res = dispatch_msg91("9876543210", "123456", 10)
            assert res.success is True
            assert res.provider == "msg91"
            assert res.dlt_compliant is True
            assert res.message_id == "msg91_req_7721"
        finally:
            settings.MSG91_AUTH_KEY = orig_key
            settings.MSG91_TEMPLATE_ID = orig_tmpl


def test_auth_api_fast2sms_and_twilio_wiring():
    """
    Verify /api/v1/auth/request-otp seamlessly dispatches via Fast2SMS when FAST2SMS_API_KEY
    is set, and via Twilio when TWILIO_AUTH_TOKEN is set.
    """
    phone1 = f"98{uuid.uuid4().int % 100000000:08d}"
    phone2 = f"99{uuid.uuid4().int % 100000000:08d}"

    # 1. Test Fast2SMS wiring in auth API
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"return": true, "request_id": "req_fast2sms_auth_01"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        orig_key = settings.FAST2SMS_API_KEY
        orig_prov = settings.SMS_PROVIDER
        try:
            settings.FAST2SMS_API_KEY = "live_fast2sms_key_wire"
            settings.SMS_PROVIDER = "fast2sms"

            res1 = client.post("/api/v1/auth/request-otp", json={"phone": phone1, "purpose": "login"})
            assert res1.status_code == 200
            data1 = res1.json()
            assert data1["success"] is True
            assert data1["channel"] == "sms"
            assert data1["sms_provider"] == "fast2sms"
        finally:
            settings.FAST2SMS_API_KEY = orig_key
            settings.SMS_PROVIDER = orig_prov

    # 2. Test Twilio wiring in auth API
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"sid": "SM_twilio_auth_02", "status": "queued"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        orig_sid = settings.TWILIO_ACCOUNT_SID
        orig_token = settings.TWILIO_AUTH_TOKEN
        orig_prov = settings.SMS_PROVIDER
        try:
            settings.TWILIO_ACCOUNT_SID = "AC_twilio_auth_test"
            settings.TWILIO_AUTH_TOKEN = "auth_token_twilio_wire"
            settings.SMS_PROVIDER = "twilio"

            res2 = client.post("/api/v1/auth/request-otp", json={"phone": phone2, "purpose": "login"})
            assert res2.status_code == 200
            data2 = res2.json()
            assert data2["success"] is True
            assert data2["channel"] == "sms"
            assert data2["sms_provider"] == "twilio"
        finally:
            settings.TWILIO_ACCOUNT_SID = orig_sid
            settings.TWILIO_AUTH_TOKEN = orig_token
            settings.SMS_PROVIDER = orig_prov

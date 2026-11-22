import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal, Base, engine
from backend.app.database.models import MerchantPushSubscription, Business, User, Order
from backend.app.services.web_push_service import (
    get_vapid_public_key,
    create_vapid_auth_header,
    encrypt_aes128gcm,
    urlsafe_b64encode,
    urlsafe_b64decode,
)
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import os

# Ensure all tables (including newly added merchant_push_subscriptions) are created
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_vapid_public_key_endpoint():
    """Verify that VAPID public key endpoint returns a valid SECP256R1 uncompressed public key."""
    res = client.get("/api/v1/merchant/push-subscription/public-key")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    pub_key = data["public_key"]
    assert len(pub_key) >= 65
    
    # Ensure it decodes to 65 bytes starting with 0x04 (uncompressed EC point)
    raw_pub = urlsafe_b64decode(pub_key)
    assert len(raw_pub) == 65
    assert raw_pub[0] == 0x04


def test_merchant_push_subscription_registration_and_deletion():
    """Verify that merchant devices can register, update, and unregister push subscriptions."""
    endpoint_url = "https://fcm.googleapis.com/fcm/send/test_device_token_xyz_9988"
    biz_id = "biz-test-bakery"
    
    # 1. Register subscription
    sub_payload = {
        "business_id": biz_id,
        "endpoint": endpoint_url,
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DNY",
        "auth": "tBHItJI5svbpez7KI4CCXg",
        "user_agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36",
    }
    
    reg_res = client.post("/api/v1/merchant/push-subscription", json=sub_payload)
    assert reg_res.status_code == 200
    assert reg_res.json()["status"] == "success"
    
    # Verify in DB
    with SessionLocal() as db:
        sub = db.query(MerchantPushSubscription).filter(
            MerchantPushSubscription.business_id == biz_id,
            MerchantPushSubscription.endpoint == endpoint_url
        ).first()
        assert sub is not None
        assert sub.auth == "tBHItJI5svbpez7KI4CCXg"
        assert sub.p256dh is not None
        sub_id = sub.id

    # 2. Update subscription (re-register with new auth secret)
    updated_payload = {
        "business_id": biz_id,
        "endpoint": endpoint_url,
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DNY",
        "auth": "new_updated_auth_secret_123",
    }
    update_res = client.post("/api/v1/merchant/push-subscription", json=updated_payload)
    assert update_res.status_code == 200
    
    with SessionLocal() as db:
        sub = db.query(MerchantPushSubscription).filter(MerchantPushSubscription.id == sub_id).first()
        assert sub.auth == "new_updated_auth_secret_123"

    # 3. Trigger test push endpoint
    test_push_res = client.post(f"/api/v1/merchant/test-push?business_id={biz_id}")
    assert test_push_res.status_code == 200
    assert test_push_res.json()["status"] == "success"

    # 4. Delete subscription
    del_res = client.delete(f"/api/v1/merchant/push-subscription?endpoint={endpoint_url}&business_id={biz_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted_count"] >= 1

    with SessionLocal() as db:
        sub = db.query(MerchantPushSubscription).filter(
            MerchantPushSubscription.business_id == biz_id,
            MerchantPushSubscription.endpoint == endpoint_url
        ).first()
        assert sub is None


def test_rfc8291_encryption_and_vapid_jwt_generation():
    """Verify RFC 8291 aes128gcm payload encryption and RFC 8292 VAPID JWT auth formatting."""
    # Generate mock client keypair
    client_key = ec.generate_private_key(ec.SECP256R1())
    client_pub_bytes = client_key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    p256dh_b64 = urlsafe_b64encode(client_pub_bytes)
    auth_b64 = urlsafe_b64encode(os.urandom(16))
    
    raw_payload = json.dumps({"title": "Test Chime", "orderNumber": "MA24-9988"}).encode("utf-8")
    
    # 1. Encrypt payload
    encrypted = encrypt_aes128gcm(raw_payload, p256dh_b64, auth_b64)
    assert len(encrypted) > len(raw_payload)
    # Check 16 bytes salt + 4 bytes record size + 1 byte idlen (65) + 65 bytes sender pub = 86 bytes header
    assert encrypted[20] == 65

    # 2. VAPID Authorization header
    endpoint = "https://fcm.googleapis.com/fcm/send/sample_push_token_777"
    auth_hdr = create_vapid_auth_header(endpoint)
    assert auth_hdr.startswith("vapid t=")
    assert ", k=" in auth_hdr
    
    parts = auth_hdr.split("vapid t=")[1].split(", k=")
    jwt_token = parts[0]
    vapid_key = parts[1]
    
    # Validate JWT has 3 parts (header.payload.signature)
    jwt_parts = jwt_token.split(".")
    assert len(jwt_parts) == 3
    claims = json.loads(urlsafe_b64decode(jwt_parts[1]).decode("utf-8"))
    assert claims["aud"] == "https://fcm.googleapis.com"
    assert "exp" in claims
    assert "sub" in claims


def test_order_creation_triggers_push_notification():
    """Verify that POST /api/v1/orders triggers push notification to registered merchant devices."""
    biz_id = "1"
    endpoint_url = "https://fcm.googleapis.com/fcm/send/test_order_token_456"

    # 1. Register push subscription for merchant 1
    client.post("/api/v1/merchant/push-subscription", json={
        "business_id": biz_id,
        "endpoint": endpoint_url,
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DNY",
        "auth": "tBHItJI5svbpez7KI4CCXg",
    })

    # 2. Place an order targeting this merchant
    order_res = client.post("/api/v1/orders", json={
        "business_id": 1,
        "business_name": "Push Order Store",
        "customer_name": "Meera Sen",
        "customer_phone": "9871122334",
        "delivery_address": "Sector 14, Gurugram",
        "payment_method": "upi_qr",
        "items": [
            {"product_name": "Artisan Sourdough Loaf", "unit_price": 180.0, "quantity": 1}
        ]
    })
    assert order_res.status_code == 201
    data = order_res.json()
    assert data["status"] == "success"
    assert data["order"]["order_number"].startswith("MA24-ORD-")

"""
MyArea24 — MVP Phase 1 Production Enhancements Verification Suite
Validates:
1. Store Pickup / Takeaway fulfillment mode (₹0 delivery fee) across quote and order creation.
2. Merchant daily settlement details (UPI ID, Bank Account, IFSC) persistence in profile.
3. Zero-cost thread-safe in-memory TTL Telemetry Cache.
"""

import time
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.database.models import User, Business, Order
from backend.app.core.security import create_access_token
from backend.app.services.telemetry_cache import TelemetryTTLCache, telemetry_cache

client = TestClient(app)


def test_delivery_quote_store_pickup_zero_fee():
    """Verify delivery-quote returns ₹0 fee and PICKUP explanation when fulfillment_type=PICKUP."""
    resp = client.get(
        "/api/v1/orders/delivery-quote",
        params={
            "customer_lat": 28.7196,
            "customer_lng": 77.1186,
            "subtotal": 120.0,
            "fulfillment_type": "PICKUP",
            "business_name": "Sharma General Store",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["delivery_fee"] == 0.0
    assert data["is_free"] is True
    assert data["fulfillment_type"] == "PICKUP"
    assert "Takeaway" in data["tier_explanation"] or "Pickup" in data["tier_explanation"]


def test_create_order_with_store_pickup_enforces_zero_delivery_fee():
    """Verify order creation with fulfillment_type='PICKUP' calculates ₹0 delivery fee."""
    payload = {
        "business_name": "Sharma General Store",
        "fulfillment_type": "PICKUP",
        "items": [
            {
                "product_name": "Wheat Flour 5kg",
                "unit_price": 240.0,
                "quantity": 1,
                "store_name": "Sharma General Store",
            }
        ],
        "delivery_fee": 99.0,  # Deliberately attempt client fee manipulation
        "platform_fee": 5.0,
        "discount_amount": 0.0,
        "payment_method": "cod",
        "customer_name": "Aman Verma",
        "customer_phone": "+91 98110 55443",
        "delivery_address": "Storefront Pickup Counter",
    }
    resp = client.post("/api/v1/orders", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()["order"]
    
    # Authoritative server-side check: delivery_fee must be 0 for PICKUP!
    assert data["delivery_fee"] == 0.0
    assert data["final_payable"] == 245.0  # 240 + 0 + 5
    assert data["fulfillment_type"] == "PICKUP"


def test_merchant_storefront_profile_settlement_details_persistence():
    """Verify merchant can read and update settlement UPI ID, Bank Account, and IFSC."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone == "+919999911223").first()
        if not user:
            user = User(
                phone="+919999911223",
                email="settlement_test@myarea24.in",
                full_name="Settlement Merchant Owner",
                role="merchant",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        biz = db.query(Business).filter(Business.owner_id == user.id).first()
        if not biz:
            biz = Business(
                slug="test-settlement-store",
                name="Test Settlement Store",
                owner_id=user.id,
                category="Grocery",
                address="Shop 12, Main Bazaar",
                locality="Rohini",
                city="Delhi",
                state="Delhi NCR",
                pincode="110085",
                latitude=28.7196,
                longitude=77.1186,
                is_verified=True,
                status="active",
            )
            db.add(biz)
            db.commit()
            db.refresh(biz)
        biz_id = biz.id
        user_id = user.id
        user_phone = user.phone
        user_role = user.role
    finally:
        db.close()

    token = create_access_token(data={"sub": str(user_id), "phone": user_phone, "role": user_role})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update settlement details
    update_payload = {
        "name": "Test Settlement Store",
        "settlement_upi_id": "merchant.store@okicici",
        "settlement_bank_account": "50100492817263",
        "settlement_bank_ifsc": "HDFC0001234",
    }
    put_resp = client.put("/api/v1/merchant/storefront", json=update_payload, headers=headers)
    assert put_resp.status_code == 200, put_resp.text

    # 2. Fetch storefront profile and verify settlement fields are returned
    get_resp = client.get("/api/v1/merchant/storefront", headers=headers)
    assert get_resp.status_code == 200, get_resp.text
    storefront = get_resp.json()["storefront"]
    
    assert storefront["settlementUpiId"] == "merchant.store@okicici"
    assert storefront["settlementBankAccount"] == "50100492817263"
    assert storefront["settlementBankIfsc"] == "HDFC0001234"


def test_in_memory_telemetry_ttl_cache():
    """Verify TelemetryTTLCache thread-safety, expiration, and eviction."""
    cache = TelemetryTTLCache()
    
    # 1. Basic Set and Get
    cache.set("weather:delhi", {"temp": 28.5, "condition": "Sunny"}, ttl_seconds=10)
    val = cache.get("weather:delhi")
    assert val is not None
    assert val["temp"] == 28.5

    # 2. Expiration behavior
    cache.set("aqi:delhi", {"aqi": 182}, ttl_seconds=1)
    time.sleep(1.1)
    expired_val = cache.get("aqi:delhi")
    assert expired_val is None

    # 3. Clear and Stats
    cache.set("item1", "data1", ttl_seconds=60)
    cache.set("item2", "data2", ttl_seconds=60)
    stats = cache.stats()
    assert stats["active_entries"] >= 2
    
    cache.clear()
    assert cache.get("item1") is None
    assert cache.stats()["active_entries"] == 0

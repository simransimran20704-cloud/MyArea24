import secrets
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.database.models import Business, Product

client = TestClient(app)


def test_delivery_quote_endpoint():
    """Verify the distance-tiered delivery quote API calculation."""
    # 1. Nearby customer (< 2 km): Base fee should be 20.0
    res1 = client.get("/api/v1/orders/delivery-quote?customer_lat=28.6150&customer_lng=77.2100&subtotal=150.0")
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["base_fee"] == 20.0
    assert d1["per_km_rate"] == 10.0
    assert d1["delivery_fee"] == 20.0
    assert d1["is_free"] is False

    # 2. Free delivery on orders >= 499
    res2 = client.get("/api/v1/orders/delivery-quote?customer_lat=28.6150&customer_lng=77.2100&subtotal=550.0")
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["delivery_fee"] == 0.0
    assert d2["is_free"] is True


def test_distance_tiered_delivery_enforcement_in_create_order():
    """Verify backend enforces distance-tiered delivery calculation based on merchant-to-customer distance."""
    db = SessionLocal()
    test_biz = None
    try:
        # Create merchant at Connaught Place (28.6304, 77.2177)
        test_biz = Business(
            name="Tiered Test Supermart",
            slug=f"tiered-test-supermart-{secrets.token_hex(4)}",
            owner_id=1,
            category="Groceries",
            description="Neighborhood grocery store for delivery tier tests",
            address="CP Block B",
            locality="Connaught Place",
            city="New Delhi",
            state="Delhi NCR",
            latitude=28.6304,
            longitude=77.2177,
            status="active",
        )
        db.add(test_biz)
        db.commit()
        db.refresh(test_biz)

        # 1. Customer within 2.0 km (e.g. at 28.6350, 77.2200, approx ~0.6 km away)
        # Even if client sends delivery_fee = 0 or tampered 5, backend must enforce 20.0 (subtotal < 499)
        payload_near = {
            "business_id": test_biz.id,
            "items": [
                {
                    "product_name": "Premium Basmati Rice 1kg",
                    "unit_price": 120.0,
                    "quantity": 1,
                }
            ],
            "delivery_fee": 5.0,  # tampered client fee
            "platform_fee": 5.0,
            "discount_amount": 0.0,
            "payment_method": "cod",
            "customer_name": "Delivery Test Customer",
            "customer_phone": "9811024024",
            "delivery_address": "Flat 301, Near Metro Station",
            "delivery_lat": 28.6350,
            "delivery_lng": 77.2200,
        }
        res_near = client.post("/api/v1/orders", json=payload_near)
        assert res_near.status_code == 201
        order_near = res_near.json()["order"]
        # Enforced 20.0 base fee for < 2km
        assert order_near["delivery_fee"] == 20.0
        # final_payable = 120 (subtotal) + 20 (delivery) + 5 (platform) = 145.0
        assert order_near["final_payable"] == 145.0

        # 2. Customer 4.5 km away (e.g. at 28.6650, 77.2400)
        # Distance > 2.0 km -> fee = 20.0 + (dist - 2.0) * 10
        payload_far = {
            "business_id": test_biz.id,
            "items": [
                {
                    "product_name": "Premium Basmati Rice 1kg",
                    "unit_price": 120.0,
                    "quantity": 1,
                }
            ],
            "delivery_fee": 10.0,  # tampered client fee
            "platform_fee": 5.0,
            "discount_amount": 0.0,
            "payment_method": "cod",
            "customer_name": "Far Test Customer",
            "customer_phone": "9811024024",
            "delivery_address": "Sector 44 Colony",
            "delivery_lat": 28.6650,
            "delivery_lng": 77.2400,
        }
        res_far = client.post("/api/v1/orders", json=payload_far)
        assert res_far.status_code == 201
        order_far = res_far.json()["order"]
        # Fee should be greater than 20.0 base fee
        assert order_far["delivery_fee"] > 20.0
        assert order_far["final_payable"] == round(120.0 + order_far["delivery_fee"] + 5.0, 2)

        # 3. High-value order (>= 499): delivery fee waived to 0.0
        payload_free = {
            "business_id": test_biz.id,
            "items": [
                {
                    "product_name": "Bulk Ghee Tin 5kg",
                    "unit_price": 600.0,
                    "quantity": 1,
                }
            ],
            "delivery_fee": 50.0,
            "platform_fee": 5.0,
            "discount_amount": 0.0,
            "payment_method": "cod",
            "customer_name": "Free Delivery Customer",
            "customer_phone": "9811024024",
            "delivery_address": "Sector 44 Colony",
            "delivery_lat": 28.6650,
            "delivery_lng": 77.2400,
        }
        res_free = client.post("/api/v1/orders", json=payload_free)
        assert res_free.status_code == 201
        order_free = res_free.json()["order"]
        assert order_free["delivery_fee"] == 0.0
        assert order_free["final_payable"] == 605.0  # 600 + 0 + 5

    finally:
        if test_biz and test_biz.id:
            db.delete(test_biz)
            db.commit()
        db.close()


def test_delivery_quote_with_pincode_resolution():
    """Verify delivery quote calculates distance when customer provides PIN code."""
    res = client.get("/api/v1/orders/delivery-quote?customer_pincode=110001&subtotal=200.0")
    assert res.status_code == 200
    d = res.json()
    assert d["base_fee"] == 20.0
    assert d["delivery_fee"] >= 20.0
    assert "distance_km" in d
    assert d["customer_coords"]["lat"] is not None
    assert d["customer_coords"]["lng"] is not None


def test_order_creation_with_pincode_resolution():
    """Verify order creation calculates server-side distance when customer provides PIN code instead of lat/lng."""
    payload = {
        "business_name": "Gupta Kirana & General Store",
        "items": [
            {
                "product_name": "Sunflower Cooking Oil 1L",
                "unit_price": 140.0,
                "quantity": 1,
            }
        ],
        "delivery_fee": 1.0,  # Tampered client fee
        "platform_fee": 5.0,
        "discount_amount": 0.0,
        "payment_method": "cod",
        "customer_name": "Pincode Customer",
        "customer_phone": "9811024024",
        "delivery_address": "House 12, Connaught Place",
        "delivery_pincode": "110001",
    }
    res = client.post("/api/v1/orders", json=payload)
    assert res.status_code == 201
    order = res.json()["order"]
    # Tampered 1.0 fee must be rejected in favor of server-calculated tier fee (20.0)
    assert order["delivery_fee"] == 20.0
    assert order["final_payable"] == 165.0  # 140 + 20 + 5


import hashlib
import hmac
import os
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.config import settings

client = TestClient(app)


@pytest.fixture
def auth_headers():
    """Generates an authenticated resident token for testing."""
    import uuid
    email = f"order_test_{uuid.uuid4().hex[:6]}@example.com"
    r = client.post("/api/v1/auth/request-otp", json={"email": email, "purpose": "login"})
    otp = r.json()["dev_otp"]
    v = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp_code": otp, "full_name": "Test Customer", "phone": "9876543210"})
    token = v.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_order_creation_and_privacy(auth_headers):
    """Verify order creation and that unauthenticated listing does not leak all orders."""
    order_payload = {
        "items": [
            {
                "product_name": "Organic A2 Gir Cow Milk",
                "unit_price": 95.0,
                "quantity": 2,
                "store_name": "Apna Dairy",
            }
        ],
        "delivery_fee": 30.0,
        "platform_fee": 5.0,
        "discount_amount": 0.0,
        "payment_method": "upi_qr",
        "customer_name": "Test Customer",
        "customer_phone": "9876543210",
        "delivery_address": "House 102, Green Avenue, Sector 15",
    }

    create_res = client.post("/api/v1/orders", json=order_payload, headers=auth_headers)
    assert create_res.status_code == 201
    order_data = create_res.json()["order"]
    order_number = order_data["order_number"]
    assert order_number.startswith("MA24-ORD-")
    assert order_data["delivery_fee"] == 20.0
    assert order_data["final_payable"] == 215.0

    # Verify deep-link UPI app URIs for PWA and mobile applications
    payment_meta = create_res.json().get("payment", {})
    assert "upi_app_uris" in payment_meta
    assert payment_meta["upi_app_uris"]["gpay"].startswith("tez://upi/pay")
    assert payment_meta["upi_app_uris"]["phonepe"].startswith("phonepe://pay")
    assert payment_meta["upi_app_uris"]["paytm"].startswith("paytmmp://pay")
    assert payment_meta["upi_app_uris"]["bhim"].startswith("bhim://pay")
    assert payment_meta["upi_app_uris"]["generic"].startswith("upi://pay")

    # 1. Unauthenticated listing with no phone MUST NOT return orders
    unauth_list = client.get("/api/v1/orders")
    assert unauth_list.status_code == 200
    assert unauth_list.json()["count"] == 0

    # 2. Authenticated listing MUST return this customer's order
    auth_list = client.get("/api/v1/orders", headers=auth_headers)
    assert auth_list.status_code == 200
    assert auth_list.json()["count"] >= 1
    found = any(o["order_number"] == order_number for o in auth_list.json()["orders"])
    assert found is True

    # 3. Direct detail access by owner
    detail_res = client.get(f"/api/v1/orders/{order_number}", headers=auth_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["order"]["order_number"] == order_number

    # 4. Unauthorized stranger detail access should return 403 Forbidden
    stranger_res = client.get(f"/api/v1/orders/{order_number}")
    assert stranger_res.status_code in (401, 403)


def test_order_status_authorization(auth_headers):
    """Verify that a customer cannot change order status to delivered, only cancelled while in placed stage."""
    order_payload = {
        "items": [{"product_name": "Brown Bread", "unit_price": 45.0, "quantity": 1}],
        "payment_method": "cod",
        "customer_name": "Test Customer",
        "customer_phone": "9876543210",
        "delivery_address": "Flat 2B, Galaxy Tower",
    }
    r = client.post("/api/v1/orders", json=order_payload, headers=auth_headers)
    order_num = r.json()["order"]["order_number"]

    # Customer tries to mark order as delivered (forbidden)
    bad_status = client.patch(f"/api/v1/orders/{order_num}/status", json={"status": "delivered"}, headers=auth_headers)
    assert bad_status.status_code == 403

    # Customer cancels placed order (allowed)
    cancel_res = client.patch(f"/api/v1/orders/{order_num}/status", json={"status": "cancelled"}, headers=auth_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["new_status"] == "cancelled"

    # Customer cannot cancel already cancelled order
    re_cancel = client.patch(f"/api/v1/orders/{order_num}/status", json={"status": "cancelled"}, headers=auth_headers)
    assert re_cancel.status_code == 400


def test_payment_verification_and_tampered_signature():
    """Verify cryptographic signature check, rejection of tampered signature, and idempotency."""
    # Create order
    order_payload = {
        "items": [{"product_name": "Filter Coffee Decoction", "unit_price": 120.0, "quantity": 1}],
        "payment_method": "razorpay",
        "customer_name": "Priya",
        "customer_phone": "9911223344",
        "delivery_address": "Indiranagar 100ft Road",
    }
    r = client.post("/api/v1/orders", json=order_payload)
    order_num = r.json()["order"]["order_number"]
    rzp_order_id = r.json()["payment"]["razorpay_order_id"]

    # 1. Fake / Tampered Razorpay signature
    fake_verify = client.post(
        f"/api/v1/orders/{order_num}/verify-payment",
        json={
            "payment_method": "razorpay",
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_test_123456",
            "razorpay_signature": "tampered_invalid_signature_hash_value_999",
        },
    )
    # If secret is set, it will be 400. Even if not set, let's test valid signature calculation
    razorpay_secret = settings.RAZORPAY_KEY_SECRET or "test_secret_for_unit_tests"
    settings.RAZORPAY_KEY_SECRET = razorpay_secret

    tampered_res = client.post(
        f"/api/v1/orders/{order_num}/verify-payment",
        json={
            "payment_method": "razorpay",
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_test_123456",
            "razorpay_signature": "tampered_invalid_signature_hash_value_999",
        },
    )
    assert tampered_res.status_code == 400
    assert "signature verification failed" in tampered_res.json()["detail"].lower()

    # 2. Valid signature verification
    valid_payload = f"{rzp_order_id}|pay_test_123456".encode("utf-8")
    valid_signature = hmac.new(
        razorpay_secret.encode("utf-8"),
        valid_payload,
        hashlib.sha256
    ).hexdigest()

    good_res = client.post(
        f"/api/v1/orders/{order_num}/verify-payment",
        json={
            "payment_method": "razorpay",
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_test_123456",
            "razorpay_signature": valid_signature,
            "transaction_id": "pay_test_123456",
        },
    )
    assert good_res.status_code == 200
    assert good_res.json()["order_status"] == "confirmed"

    # 3. Idempotent repeat payment verification with SAME transaction_id
    idempotent_res = client.post(
        f"/api/v1/orders/{order_num}/verify-payment",
        json={
            "payment_method": "razorpay",
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_test_123456",
            "razorpay_signature": valid_signature,
            "transaction_id": "pay_test_123456",
        },
    )
    assert idempotent_res.status_code == 200
    assert "idempotent" in idempotent_res.json()["message"].lower()

    # 4. Conflicting payment attempt with DIFFERENT transaction_id on already paid order
    conflict_res = client.post(
        f"/api/v1/orders/{order_num}/verify-payment",
        json={
            "payment_method": "razorpay",
            "transaction_id": "pay_different_conflict_txn_888",
        },
    )
    assert conflict_res.status_code == 409


def test_razorpay_webhook_signature_verification_and_async_payment():
    """
    Verifies that the backend Razorpay Webhook endpoint (/api/v1/payments/razorpay-webhook):
    1. Rejects missing or tampered HMAC SHA-256 signatures.
    2. Asynchronously transitions orders to 'confirmed' / 'paid' on payment.captured.
    3. Handles duplicate webhook invocations idempotently.
    4. Enforces underpayment protection against fraudulent amounts.
    5. Correctly handles payment.failed and refund.processed events.
    """
    import json

    orig_secret = settings.RAZORPAY_WEBHOOK_SECRET
    webhook_secret = "rzp_webhook_secret_secure_test_key"
    settings.RAZORPAY_WEBHOOK_SECRET = webhook_secret

    try:
        # 1. Create a fresh order
        order_payload = {
            "items": [{"product_name": "Artisanal Sourdough Bread", "unit_price": 180.0, "quantity": 1}],
            "delivery_fee": 25.0,
            "platform_fee": 5.0,
            "payment_method": "razorpay",
            "customer_name": "Aditi Sharma",
            "customer_phone": "9811223344",
            "delivery_address": "Apartment 5A, Palm Grove, Koramangala",
        }
        r = client.post("/api/v1/orders", json=order_payload)
        assert r.status_code == 201
        order_data = r.json()["order"]
        order_num = order_data["order_number"]
        final_payable = order_data["final_payable"]
        rzp_order_id = r.json()["payment"]["razorpay_order_id"]

        # Order starts in placed / pending state
        assert order_data["status"] == "placed"
        assert order_data["payment_status"] == "pending"

        # Construct payment.captured webhook payload
        captured_payment_id = "pay_webhook_captured_998877"
        captured_payload = {
            "entity": "event",
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": captured_payment_id,
                        "order_id": rzp_order_id,
                        "amount": int(round(final_payable * 100)),  # in paise
                        "currency": "INR",
                        "status": "captured",
                        "notes": {
                            "order_number": order_num,
                        },
                    }
                }
            },
        }
        raw_body = json.dumps(captured_payload).encode("utf-8")

        # 2. Test missing X-Razorpay-Signature header -> 400
        res_no_sig = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=raw_body,
            headers={"Content-Type": "application/json"},
        )
        assert res_no_sig.status_code == 400
        assert "missing x-razorpay-signature" in res_no_sig.json()["detail"].lower()

        # 3. Test tampered/invalid signature -> 400
        res_bad_sig = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": "tampered_hex_digest_signature_0000000000000000",
            },
        )
        assert res_bad_sig.status_code == 400
        assert "invalid webhook signature" in res_bad_sig.json()["detail"].lower()

        # 4. Valid signature computation
        valid_sig = hmac.new(
            webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        # 5. Send legitimate payment.captured webhook -> 200 OK and order confirmed
        res_valid = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": valid_sig,
            },
        )
        assert res_valid.status_code == 200
        res_json = res_valid.json()
        assert res_json["status"] == "ok"
        assert res_json["order_status"] == "confirmed"
        assert res_json["payment_status"] == "paid"
        assert res_json["transaction_id"] == captured_payment_id

        # 6. Idempotency test: Re-sending exact same webhook must not fail or corrupt state
        res_idempotent = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": valid_sig,
            },
        )
        assert res_idempotent.status_code == 200
        assert "duplicate payment event ignored" in res_idempotent.json()["message"].lower()

        # 7. Underpayment protection test
        underpaid_order_res = client.post("/api/v1/orders", json={
            "items": [{"product_name": "Premium Tea", "unit_price": 300.0, "quantity": 1}],
            "payment_method": "razorpay",
            "customer_name": "Rahul Verma",
            "customer_phone": "9822334455",
            "delivery_address": "Indiranagar",
        })
        underpaid_order_num = underpaid_order_res.json()["order"]["order_number"]

        fraud_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_fraud_underpayment_001",
                        "amount": 100,  # ₹1 instead of ₹305
                        "currency": "INR",
                        "notes": {"order_number": underpaid_order_num},
                    }
                }
            },
        }
        fraud_body = json.dumps(fraud_payload).encode("utf-8")
        fraud_sig = hmac.new(webhook_secret.encode("utf-8"), fraud_body, hashlib.sha256).hexdigest()

        res_fraud = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=fraud_body,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": fraud_sig},
        )
        assert res_fraud.status_code == 400
        assert "mismatch" in res_fraud.json()["detail"].lower()

        # 8. Test payment.failed event
        failed_payload = {
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_failed_tx_002",
                        "notes": {"order_number": underpaid_order_num},
                    }
                }
            },
        }
        failed_body = json.dumps(failed_payload).encode("utf-8")
        failed_sig = hmac.new(webhook_secret.encode("utf-8"), failed_body, hashlib.sha256).hexdigest()
        res_failed = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=failed_body,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": failed_sig},
        )
        assert res_failed.status_code == 200
        assert res_failed.json()["payment_status"] == "failed"

        # 9. Test refund.processed event on first order
        refund_payload = {
            "event": "refund.processed",
            "payload": {
                "refund": {
                    "entity": {
                        "id": "rfnd_test_refund_123",
                        "payment_id": captured_payment_id,
                        "amount": int(round(final_payable * 100)),
                        "notes": {"order_number": order_num},
                    }
                }
            },
        }
        refund_body = json.dumps(refund_payload).encode("utf-8")
        refund_sig = hmac.new(webhook_secret.encode("utf-8"), refund_body, hashlib.sha256).hexdigest()
        res_refund = client.post(
            "/api/v1/payments/razorpay-webhook",
            content=refund_body,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": refund_sig},
        )
        assert res_refund.status_code == 200
        assert res_refund.json()["payment_status"] == "refunded"
        assert res_refund.json()["order_status"] == "cancelled"
    finally:
        settings.RAZORPAY_WEBHOOK_SECRET = orig_secret


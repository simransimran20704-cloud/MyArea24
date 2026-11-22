import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database.session import Base, get_db
from backend.app.database.models import User, Business, Product, Order, CustomerEnquiry, ServiceListing, Offer, Event
from backend.app.core.security import create_access_token
from backend.app.core.config import settings

# In-memory SQLite database dedicated for tests
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def merchant_a(db_session):
    user_a = User(
        email="merchant_a@example.com",
        phone="+919811000001",
        full_name="Merchant Alice",
        role="merchant",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user_a)
    db_session.commit()
    db_session.refresh(user_a)

    biz_a = Business(
        name="Alice Kirana Store",
        slug="alice-kirana",
        owner_id=user_a.id,
        category="Grocery",
        description="Alice's neighborhood grocery store.",
        address="Shop 1, Sector 15 Market",
        locality="Sector 15",
        city="Noida",
        state="Uttar Pradesh",
        latitude=28.5800,
        longitude=77.3100,
        phone="+919811000001",
        status="active",
        is_verified=True,
    )
    db_session.add(biz_a)
    db_session.commit()
    db_session.refresh(biz_a)

    token = create_access_token({"sub": str(user_a.id), "email": user_a.email, "role": user_a.role})
    return {"user": user_a, "business": biz_a, "token": token}


@pytest.fixture
def merchant_b(db_session):
    user_b = User(
        email="merchant_b@example.com",
        phone="+919811000002",
        full_name="Merchant Bob",
        role="merchant",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    biz_b = Business(
        name="Bob Electronics",
        slug="bob-electronics",
        owner_id=user_b.id,
        category="Electronics",
        description="Bob's certified gadget repair shop.",
        address="Shop 2, Sector 18 Market",
        locality="Sector 18",
        city="Noida",
        state="Uttar Pradesh",
        latitude=28.5700,
        longitude=77.3200,
        phone="+919811000002",
        status="active",
        is_verified=True,
    )
    db_session.add(biz_b)
    db_session.commit()
    db_session.refresh(biz_b)

    token = create_access_token({"sub": str(user_b.id), "email": user_b.email, "role": user_b.role})
    return {"user": user_b, "business": biz_b, "token": token}


# ==============================================================================
# 1. Unauthenticated Requests Rejected (401)
# ==============================================================================
def test_unauthenticated_requests_rejected(client):
    endpoints = [
        ("GET", "/api/v1/merchant/overview"),
        ("GET", "/api/v1/merchant/storefront"),
        ("PUT", "/api/v1/merchant/storefront"),
        ("GET", "/api/v1/merchant/products"),
        ("POST", "/api/v1/merchant/products"),
        ("GET", "/api/v1/merchant/orders"),
        ("GET", "/api/v1/merchant/leads"),
        ("GET", "/api/v1/merchant/settings"),
        ("PUT", "/api/v1/merchant/settings"),
        ("GET", "/api/v1/merchant/export-data"),
        ("GET", "/api/v1/merchant/services"),
        ("GET", "/api/v1/merchant/offers"),
        ("GET", "/api/v1/merchant/events"),
    ]
    for method, ep in endpoints:
        if method == "GET":
            res = client.get(ep)
        elif method == "PUT":
            res = client.put(ep, json={})
        elif method == "POST":
            res = client.post(ep, json={})
        assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {ep}, got {res.status_code}"


# ==============================================================================
# 2. Invalid or Expired Tokens Rejected (401)
# ==============================================================================
def test_invalid_tokens_rejected(client):
    headers = {"Authorization": "Bearer completely_bogus_token_12345"}
    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 401
    assert "invalid or has expired" in res.json().get("detail", "").lower()


def test_expired_tokens_rejected(client, merchant_a):
    expired_token = create_access_token(
        {"sub": str(merchant_a["user"].id), "email": merchant_a["user"].email},
        expires_delta=datetime.timedelta(seconds=-60),
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 401


def test_malformed_auth_header_rejected(client):
    headers = {"Authorization": "Basic dXNlcjpwYXNz"}
    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 401


# ==============================================================================
# 3. Authenticated Merchant Can Access Only Their Own Resources (200)
# ==============================================================================
def test_authenticated_merchant_can_access_own_resources(client, merchant_a):
    headers = {"Authorization": f"Bearer {merchant_a['token']}"}

    # Overview
    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["business"]["name"] == "Alice Kirana Store"
    assert data["business"]["id"] == merchant_a["business"].id

    # Storefront
    res = client.get("/api/v1/merchant/storefront", headers=headers)
    assert res.status_code == 200
    assert res.json()["storefront"]["name"] == "Alice Kirana Store"

    # Products listing
    res = client.get("/api/v1/merchant/products", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "success"


# ==============================================================================
# 4. Merchant A Cannot Read or Modify Merchant B's Resources (403/404)
# ==============================================================================
def test_merchant_cannot_access_other_business_by_id(client, merchant_a, merchant_b):
    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}

    # Alice passes business_id belonging to Bob
    res = client.get(f"/api/v1/merchant/overview?business_id={merchant_b['business'].id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

    # Alice passes X-Merchant-Id header belonging to Bob
    headers_spoof = {
        "Authorization": f"Bearer {merchant_a['token']}",
        "X-Merchant-Id": str(merchant_b["business"].id),
    }
    res = client.get("/api/v1/merchant/overview", headers=headers_spoof)
    assert res.status_code == 403


def test_merchant_cannot_spoof_via_phone_header(client, merchant_a, merchant_b):
    # Alice passes X-Merchant-Phone header belonging to Bob
    headers_spoof = {
        "Authorization": f"Bearer {merchant_a['token']}",
        "X-Merchant-Phone": merchant_b["user"].phone,
    }
    res = client.get("/api/v1/merchant/overview", headers=headers_spoof)
    assert res.status_code == 200
    # Must STILL return Alice's business, NEVER Bob's!
    assert res.json()["business"]["id"] == merchant_a["business"].id
    assert res.json()["business"]["name"] == "Alice Kirana Store"


def test_merchant_cannot_mutate_other_merchants_product(client, db_session, merchant_a, merchant_b):
    # Bob creates a product
    prod_b = Product(
        business_id=merchant_b["business"].id,
        name="Bob's Smartphone",
        category="Electronics",
        local_price=15000.0,
        availability_status="in_stock",
    )
    db_session.add(prod_b)
    db_session.commit()
    db_session.refresh(prod_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}

    # Alice tries to update Bob's product
    res_update = client.put(
        f"/api/v1/merchant/products/{prod_b.id}",
        json={"name": "Alice Hacked This", "price": 10.0},
        headers=headers_a,
    )
    assert res_update.status_code == 403
    assert "Forbidden" in res_update.json()["detail"]

    # Alice tries to delete Bob's product
    res_delete = client.delete(
        f"/api/v1/merchant/products/{prod_b.id}",
        headers=headers_a,
    )
    assert res_delete.status_code == 403
    assert "Forbidden" in res_delete.json()["detail"]


def test_merchant_cannot_mutate_other_merchants_order(client, db_session, merchant_a, merchant_b):
    order_b = Order(
        order_number="ORD-BOB-001",
        business_id=merchant_b["business"].id,
        status="placed",
        total_amount=500.0,
        final_payable=500.0,
        customer_name="Customer Charlie",
        customer_phone="+919999999999",
        delivery_address="Nearby address",
    )
    db_session.add(order_b)
    db_session.commit()
    db_session.refresh(order_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.put(
        f"/api/v1/merchant/orders/{order_b.id}/status",
        json={"status": "cancelled"},
        headers=headers_a,
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_mutate_other_merchants_service(client, db_session, merchant_a, merchant_b):
    svc_b = ServiceListing(
        business_id=merchant_b["business"].id,
        user_id=merchant_b["user"].id,
        provider_name="Bob Mobile Repair",
        category="Electronics",
        service_area="Noida",
        locality="Sector 18",
        city="Noida",
        latitude=28.57,
        longitude=77.32,
        phone="+919811000002",
        price_starting_at=300.0,
    )
    db_session.add(svc_b)
    db_session.commit()
    db_session.refresh(svc_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.delete(f"/api/v1/merchant/services/{svc_b.id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_mutate_other_merchants_offer(client, db_session, merchant_a, merchant_b):
    off_b = Offer(
        business_id=merchant_b["business"].id,
        title="Bob's 50% Off",
        discount_text="50% Off",
        category="Electronics",
        valid_until=datetime.datetime.utcnow() + datetime.timedelta(days=7),
    )
    db_session.add(off_b)
    db_session.commit()
    db_session.refresh(off_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.delete(f"/api/v1/merchant/offers/{off_b.id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_delete_other_merchants_event(client, db_session, merchant_a, merchant_b):
    evt_b = Event(
        title="Bob's Tech Expo",
        category="Tech",
        organizer=merchant_b["business"].name,
        source=f"Merchant: {merchant_b['business'].name}",
        venue_name="Bob Store",
        address=merchant_b["business"].address,
        locality="Sector 18",
        city="Noida",
        latitude=28.57,
        longitude=77.32,
        start_time=datetime.datetime.utcnow() + datetime.timedelta(days=3),
    )
    db_session.add(evt_b)
    db_session.commit()
    db_session.refresh(evt_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.delete(f"/api/v1/merchant/events/{evt_b.id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_mutate_other_merchants_lead(client, db_session, merchant_a, merchant_b):
    lead_b = CustomerEnquiry(
        business_id=merchant_b["business"].id,
        customer_name="Lead Dave",
        customer_phone="+918888888888",
        message="Need quotation for phone repair",
        status="pending",
    )
    db_session.add(lead_b)
    db_session.commit()
    db_session.refresh(lead_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.put(
        f"/api/v1/merchant/leads/{lead_b.id}/status",
        json={"status": "Closed"},
        headers=headers_a,
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_mutate_other_merchants_service(client, db_session, merchant_a, merchant_b):
    svc_b = ServiceListing(
        business_id=merchant_b["business"].id,
        user_id=merchant_b["user"].id,
        provider_name="Bob Mobile Repair",
        category="Electronics",
        service_area="Noida",
        locality="Sector 18",
        city="Noida",
        latitude=28.57,
        longitude=77.32,
        phone="+919811000002",
        price_starting_at=300.0,
    )
    db_session.add(svc_b)
    db_session.commit()
    db_session.refresh(svc_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.delete(f"/api/v1/merchant/services/{svc_b.id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_mutate_other_merchants_offer(client, db_session, merchant_a, merchant_b):
    off_b = Offer(
        business_id=merchant_b["business"].id,
        title="Bob's 50% Off",
        discount_text="50% Off",
        category="Electronics",
        valid_until=datetime.datetime.utcnow() + datetime.timedelta(days=7),
    )
    db_session.add(off_b)
    db_session.commit()
    db_session.refresh(off_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.delete(f"/api/v1/merchant/offers/{off_b.id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_merchant_cannot_delete_other_merchants_event(client, db_session, merchant_a, merchant_b):
    evt_b = Event(
        title="Bob's Tech Expo",
        category="Tech",
        organizer=merchant_b["business"].name,
        source=f"Merchant: {merchant_b['business'].name}",
        venue_name="Bob Store",
        address=merchant_b["business"].address,
        locality="Sector 18",
        city="Noida",
        latitude=28.57,
        longitude=77.32,
        start_time=datetime.datetime.utcnow() + datetime.timedelta(days=3),
    )
    db_session.add(evt_b)
    db_session.commit()
    db_session.refresh(evt_b)

    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.delete(f"/api/v1/merchant/events/{evt_b.id}", headers=headers_a)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


# ==============================================================================
# 5. Regression Coverage for Working Authorized Workflows
# ==============================================================================
def test_authorized_merchant_crud_workflow(client, merchant_a):
    headers_a = {"Authorization": f"Bearer {merchant_a['token']}"}

    # 1. Update storefront profile
    res_prof = client.put(
        "/api/v1/merchant/storefront",
        json={"name": "Alice Super Kirana", "tagline": "Fresh vegetables daily"},
        headers=headers_a,
    )
    assert res_prof.status_code == 200
    assert res_prof.json()["business"]["name"] == "Alice Super Kirana"

    # 2. Update settings
    res_sett = client.put(
        "/api/v1/merchant/settings",
        json={"notifications": {"enquiries": False}},
        headers=headers_a,
    )
    assert res_sett.status_code == 200
    assert res_sett.json()["settings"]["notifications"]["enquiries"] is False

    # 3. Create a product
    res_prod = client.post(
        "/api/v1/merchant/products",
        json={
            "name": "Toor Dal 1kg",
            "category": "Grocery",
            "price": 140.0,
            "mrp": 160.0,
            "availability_status": "in_stock",
        },
        headers=headers_a,
    )
    assert res_prod.status_code == 200
    prod_id = res_prod.json()["product"]["numericId"]

    # 4. Update product
    res_up = client.put(
        f"/api/v1/merchant/products/{prod_id}",
        json={"price": 135.0, "status": "Active"},
        headers=headers_a,
    )
    assert res_up.status_code == 200

    # 5. Export data (only Alice's items)
    res_exp = client.get("/api/v1/merchant/export-data", headers=headers_a)
    assert res_exp.status_code == 200
    exp_data = res_exp.json()
    assert exp_data["storefront"]["id"] == merchant_a["business"].id
    catalog_names = [p["name"] for p in exp_data["catalog"]]
    assert "Toor Dal 1kg" in catalog_names

    # 6. Delete product
    res_del = client.delete(f"/api/v1/merchant/products/{prod_id}", headers=headers_a)
    assert res_del.status_code == 200


# ==============================================================================
# 6. Dev Bypass Strict Rejection in Production Mode
# ==============================================================================
def test_dev_bypass_strictly_rejected_in_production(client, merchant_a, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "DEBUG", False)

    headers = {
        "Authorization": f"Bearer {merchant_a['token']}",
        "X-Dev-Merchant-Bypass": "true",
    }
    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 403
    assert "forbidden in production" in res.json()["detail"].lower()


def test_user_without_business_raises_404_in_production(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "DEBUG", False)

    # Resident user without a business
    resident = User(
        email="new_resident@example.com",
        role="resident",
        is_active=True,
    )
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)

    token = create_access_token({"sub": str(resident.id), "email": resident.email, "role": resident.role})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 404
    assert "No business registered" in res.json()["detail"]


def test_deactivated_merchant_account_rejected(client, db_session, merchant_a):
    merchant_a["user"].is_active = False
    db_session.commit()
    headers = {"Authorization": f"Bearer {merchant_a['token']}"}
    res = client.get("/api/v1/merchant/overview", headers=headers)
    assert res.status_code == 403
    assert "deactivated" in res.json().get("detail", "").lower()


def test_admin_can_access_and_manage_any_business(client, db_session, merchant_a):
    admin_user = User(
        email="admin@myarea24.in",
        full_name="Platform Admin",
        role="admin",
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    admin_token = create_access_token({"sub": str(admin_user.id), "email": admin_user.email, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin accesses Alice's business explicitly via business_id query param
    res = client.get(f"/api/v1/merchant/overview?business_id={merchant_a['business'].id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["business"]["id"] == merchant_a["business"].id


def test_merchant_registration_and_cross_device_login(client, db_session):
    """
    Verify Bug 5 fix:
    1. Merchant registers with store PIN -> credentials hashed with PBKDF2 in database, store persisted.
    2. Merchant can log in from any other computer/browser with phone/email and PIN.
    3. Wrong PIN is rejected with 401.
    4. Password change hashes new PIN in database and invalidates old PIN.
    """
    reg_payload = {
        "business_name": "Sharma Sweets & Bakers",
        "category": "Retail & Grocery",
        "owner_name": "Ramesh Sharma",
        "phone": "+91 98119 88776",
        "whatsapp": "+91 98119 88776",
        "email": "ramesh.sharma@sharmasweets.in",
        "full_address": "Shop 14, Main Market, Sector 15",
        "locality": "Rohini Sector 15",
        "city": "Delhi",
        "pincode": "110089",
        "doc_type": "GSTIN",
        "doc_number": "07AAAAA1234A1Z5",
        "opening_time": "08:00",
        "closing_time": "22:00",
        "store_pin": "5432",
    }

    # 1. Register on server
    reg_res = client.post("/api/v1/merchant/register", json=reg_payload)
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert reg_data["status"] == "success"
    assert "token" in reg_data
    assert reg_data["business"]["name"] == "Sharma Sweets & Bakers"
    # Ensure plain-text PIN is NOT in response profile
    assert "storePin" not in reg_data["profile"]

    # Verify user in database has password_hash and not plain-text PIN
    user = db_session.query(User).filter(User.email == "ramesh.sharma@sharmasweets.in").first()
    assert user is not None
    assert user.password_hash is not None
    assert user.password_hash.startswith("pbkdf2_sha256$")
    assert "5432" not in user.password_hash

    # Verify business in database
    biz = db_session.query(Business).filter(Business.owner_id == user.id).first()
    assert biz is not None
    assert biz.name == "Sharma Sweets & Bakers"

    # 2. Login simulation from a new browser with phone and correct PIN
    login_res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "+91 98119 88776", "store_pin": "5432"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["status"] == "success"
    assert login_data["business"]["name"] == "Sharma Sweets & Bakers"
    assert "token" in login_data

    # 3. Login simulation with wrong PIN
    bad_login = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "+91 98119 88776", "store_pin": "9999"},
    )
    assert bad_login.status_code == 401
    assert "incorrect store access pin" in bad_login.json()["detail"].lower()

    # 4. Change password/PIN via authenticated endpoint
    headers = {"Authorization": f"Bearer {login_data['token']}"}
    change_res = client.post(
        "/api/v1/merchant/security/password",
        json={"old_pin": "5432", "new_pin": "8877"},
        headers=headers,
    )
    assert change_res.status_code == 200

    # Old PIN rejected
    old_pin_login = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "ramesh.sharma@sharmasweets.in", "store_pin": "5432"},
    )
    assert old_pin_login.status_code == 401

    # New PIN succeeds
    new_pin_login = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "ramesh.sharma@sharmasweets.in", "store_pin": "8877"},
    )
    assert new_pin_login.status_code == 200
    assert new_pin_login.json()["business"]["name"] == "Sharma Sweets & Bakers"


# ==============================================================================
# 11. Comprehensive Merchant Login & RBAC Verification Tests
# ==============================================================================
def test_login_invalid_phone_or_email_rejected(client):
    res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "nonexistent@merchant.com", "store_pin": "1234"},
    )
    assert res.status_code == 401
    assert "no merchant storefront found" in res.json()["detail"].lower()

    res2 = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "9999999999", "store_pin": "1234"},
    )
    assert res2.status_code == 401
    assert "no merchant storefront found" in res2.json()["detail"].lower()


def test_login_empty_inputs_rejected(client):
    res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "", "store_pin": "1234"},
    )
    assert res.status_code == 400

    res2 = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "9811000001", "store_pin": ""},
    )
    assert res2.status_code == 400


def test_login_deactivated_merchant_rejected(client, db_session, merchant_a):
    from backend.app.core.security import hash_password
    merchant_a["user"].password_hash = hash_password("1234")
    merchant_a["user"].is_active = False
    db_session.commit()

    res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": merchant_a["user"].phone, "store_pin": "1234"},
    )
    assert res.status_code == 403
    assert "deactivated" in res.json()["detail"].lower()


def test_login_unverified_merchant_rejected(client, db_session, merchant_a):
    from backend.app.core.security import hash_password
    merchant_a["user"].password_hash = hash_password("1234")
    merchant_a["user"].is_verified = False
    db_session.commit()

    res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": merchant_a["user"].phone, "store_pin": "1234"},
    )
    assert res.status_code == 403
    assert "pending verification" in res.json()["detail"].lower()


def test_login_resident_role_rejected_rbac(client, db_session):
    from backend.app.core.security import hash_password
    resident = User(
        email="resident_trying_merchant@myarea24.in",
        phone="+919876543219",
        full_name="Resident User",
        role="resident",
        is_active=True,
        is_verified=True,
        password_hash=hash_password("1234"),
    )
    db_session.add(resident)
    db_session.commit()

    res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": resident.phone, "store_pin": "1234"},
    )
    assert res.status_code == 403
    assert "merchant storefront privileges" in res.json()["detail"].lower()


def test_login_phone_format_flexibility(client, db_session):
    from backend.app.core.security import hash_password
    user = User(
        email="phone_flex@merchant.in",
        phone="+91-98110-55443",
        full_name="Flexible Merchant",
        role="merchant",
        is_active=True,
        is_verified=True,
        password_hash=hash_password("5544"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    biz = Business(
        name="Flex Merchant Store",
        slug="flex-merchant-store",
        owner_id=user.id,
        category="Retail",
        address="Sector 10",
        locality="Sector 10",
        city="Delhi",
        latitude=28.7041,
        longitude=77.1025,
        phone="+91-98110-55443",
        status="active",
        is_verified=True,
    )
    db_session.add(biz)
    db_session.commit()

    # Log in with 10 digits without +91 or hyphens
    res1 = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "9811055443", "store_pin": "5544"},
    )
    assert res1.status_code == 200
    assert res1.json()["business"]["name"] == "Flex Merchant Store"

    # Log in with +91 and spaces
    res2 = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "+91 98110 55443", "store_pin": "5544"},
    )
    assert res2.status_code == 200

    # Log in with exact string
    res3 = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "+91-98110-55443", "store_pin": "5544"},
    )
    assert res3.status_code == 200

    # Log in with email
    res4 = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "phone_flex@merchant.in", "store_pin": "5544"},
    )
    assert res4.status_code == 200


def test_account_without_password_hash_cannot_bypass_auth(client, db_session):
    # A user without a password hash cannot log in with any random PIN
    user = User(
        email="nopassword@merchant.in",
        phone="+919811099887",
        full_name="No Pass Merchant",
        role="merchant",
        is_active=True,
        is_verified=True,
        password_hash=None,
    )
    db_session.add(user)
    db_session.commit()

    res = client.post(
        "/api/v1/merchant/login",
        json={"identifier": "+919811099887", "store_pin": "9999"},
    )
    assert res.status_code == 401
    assert "incorrect store access pin" in res.json()["detail"].lower()
    # Confirm password hash was NOT backdoor-assigned
    db_session.refresh(user)
    assert user.password_hash is None

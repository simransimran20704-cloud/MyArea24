import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database.session import Base, get_db
from backend.app.database.models import User, Business, Product
from backend.app.core.security import create_access_token

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    yield session
    try:
        session.query(Product).delete()
        session.query(Business).delete()
        session.query(User).delete()
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


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
def merchant_with_compliance(db_session):
    user = User(
        email="compliance_merchant@myarea24.in",
        phone="+919876543299",
        full_name="Compliance Food Merchant",
        role="merchant",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    biz = Business(
        slug="delhi-spices-and-bakes",
        name="Delhi Spices & Bakes",
        owner_id=user.id,
        category="Food & Dining",
        subcategory="Bakery & Cafe",
        description="Fresh organic bakery and artisanal confectionery",
        address="Shop 14, Main Market, Sector 24",
        locality="Sector 24",
        city="Gurugram",
        state="Haryana",
        pincode="122002",
        latitude=28.4900,
        longitude=77.0900,
        phone="+919876543299",
        fssai_license_number="10019011000987",
        gstin="06AAAAA0000A1Z5",
        is_verified=True,
    )
    db_session.add(biz)
    db_session.commit()
    db_session.refresh(biz)

    token = create_access_token(data={"sub": str(user.id), "phone": user.phone, "role": user.role})
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Merchant-ID": str(biz.id),
        "X-Merchant-Phone": user.phone,
    }
    return {"user": user, "biz": biz, "token": token, "headers": headers}


def test_business_model_fssai_and_gstin_persistence(db_session):
    """Verify that Business model stores and retrieves fssai_license_number and gstin."""
    biz = Business(
        slug="test-kirana-store",
        name="Test Kirana Store",
        category="Grocery",
        address="Block C, Sector 15",
        locality="Sector 15",
        city="Noida",
        latitude=28.5800,
        longitude=77.3100,
        phone="+919811024024",
        fssai_license_number="10822005000123",
        gstin="07BBBBB1111B2Z6",
    )
    db_session.add(biz)
    db_session.commit()
    db_session.refresh(biz)

    fetched = db_session.query(Business).filter(Business.slug == "test-kirana-store").first()
    assert fetched is not None
    assert fetched.fssai_license_number == "10822005000123"
    assert fetched.gstin == "07BBBBB1111B2Z6"


def test_merchant_storefront_profile_returns_compliance_fields(client, merchant_with_compliance):
    """GET /api/v1/merchant/storefront should return fssai_license_number and gstin."""
    res = client.get("/api/v1/merchant/storefront", headers=merchant_with_compliance["headers"])
    assert res.status_code == 200
    storefront = res.json()["storefront"]
    assert storefront["fssaiLicenseNumber"] == "10019011000987"
    assert storefront["gstin"] == "06AAAAA0000A1Z5"


def test_merchant_storefront_profile_updates_compliance_fields(client, merchant_with_compliance):
    """PUT /api/v1/merchant/storefront should update fssai_license_number and gstin."""
    update_payload = {
        "fssai_license_number": "10024099000555",
        "gstin": "06CCCCC2222C3Z7",
    }
    put_res = client.put(
        "/api/v1/merchant/storefront",
        headers=merchant_with_compliance["headers"],
        json=update_payload,
    )
    assert put_res.status_code == 200

    # Verify updated values via GET
    get_res = client.get("/api/v1/merchant/storefront", headers=merchant_with_compliance["headers"])
    assert get_res.status_code == 200
    storefront = get_res.json()["storefront"]
    assert storefront["fssaiLicenseNumber"] == "10024099000555"
    assert storefront["gstin"] == "06CCCCC2222C3Z7"


def test_public_business_detail_returns_compliance_fields(client, merchant_with_compliance):
    """GET /api/v1/businesses/{id} should expose fssai_license_number and gstin for consumers."""
    biz_id = merchant_with_compliance["biz"].id
    res = client.get(f"/api/v1/businesses/{biz_id}")
    assert res.status_code == 200
    biz_data = res.json()["business"]
    assert biz_data["fssai_license_number"] == "10019011000987"
    assert biz_data["gstin"] == "06AAAAA0000A1Z5"

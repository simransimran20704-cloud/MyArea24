import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image

from backend.app.main import app
from backend.app.database.session import Base, get_db
from backend.app.database.models import User, Business, Product, Offer
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
        session.query(Offer).delete()
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
def merchant_auth(db_session):
    user = User(
        email="merchant_media_test@myarea24.in",
        phone="+919876543210",
        full_name="Media Test Merchant",
        role="merchant",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    biz = Business(
        slug="test-media-store",
        name="Test Media Store",
        owner_id=user.id,
        category="Grocery",
        address="Sector 18, Noida",
        locality="Sector 18",
        city="Noida",
        state="Uttar Pradesh",
        latitude=28.5700,
        longitude=77.3200,
        phone="+919876543210",
        image_url="./assets/crops/store-apna-mart.webp",
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


def _make_test_image(format="PNG", size=(50, 50), color="blue") -> bytes:
    """Helper to generate valid decodable image bytes for testing."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def test_merchant_upload_empty_file_rejected(client, merchant_auth):
    """Uploading an empty file should return 400 Bad Request."""
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    response = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files)
    assert response.status_code == 400
    assert "empty" in response.json().get("detail", "").lower()


def test_merchant_upload_invalid_mime_type_rejected(client, merchant_auth):
    """Uploading executable, PDF, or unsupported formats should be rejected with 400."""
    invalid_samples = [
        ("malicious.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/x-msdownload"),
        ("document.pdf", b"%PDF-1.4...", "application/pdf"),
        ("script.js", b"console.log('hi');", "text/javascript"),
        ("animated.gif", b"GIF89a...", "image/gif"),
    ]
    for filename, payload, mime in invalid_samples:
        files = {"file": (filename, payload, mime)}
        response = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files)
        assert response.status_code == 400, f"Expected 400 for {mime}"
        assert "unsupported media type" in response.json().get("detail", "").lower()


def test_merchant_upload_oversized_file_rejected(client, merchant_auth):
    """Uploading a file exceeding 5MB limit should return 400."""
    large_payload = b"X" * (5 * 1024 * 1024 + 1024)  # 5MB + 1KB
    files = {"file": ("large_image.jpg", large_payload, "image/jpeg")}
    response = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files)
    assert response.status_code == 400
    assert "exceeds maximum allowed limit" in response.json().get("detail", "").lower()


def test_merchant_upload_image_alias_endpoint(client, merchant_auth):
    """Both /api/v1/merchant/upload-image and /api/v1/merchant/upload should be active."""
    png_bytes = _make_test_image(format="PNG", color="green")
    
    # 1. Test /api/v1/merchant/upload-image
    files1 = {"file": ("produce.png", png_bytes, "image/png")}
    resp1 = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files1)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "success"

    # 2. Test /api/v1/merchant/upload
    files2 = {"file": ("produce2.png", png_bytes, "image/png")}
    resp2 = client.post("/api/v1/merchant/upload", headers=merchant_auth["headers"], files=files2)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "success"


def test_merchant_upload_webp_thumbnail_generation(client, merchant_auth):
    """Uploading a valid JPEG/PNG creates an optimized WebP thumbnail and serves both."""
    img_bytes = _make_test_image(format="JPEG", size=(600, 400), color="purple")
    files = {"file": ("storefront_display.jpg", img_bytes, "image/jpeg")}
    
    response = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success"
    assert "/static/uploads/merchant/" in data["url"]
    assert "thumbnail_url" in data
    assert data["thumbnail_url"].endswith("_thumb.webp")
    assert "/static/uploads/merchant/thumbnails/" in data["thumbnail_url"]
    assert data["size_bytes"] == len(img_bytes)
    assert data["thumbnail_size_bytes"] is not None and data["thumbnail_size_bytes"] > 0

    # Verify original file can be fetched via GET
    orig_resp = client.get(data["url"])
    assert orig_resp.status_code == 200
    assert orig_resp.content == img_bytes

    # Verify WebP thumbnail can be fetched via GET
    thumb_resp = client.get(data["thumbnail_url"])
    assert thumb_resp.status_code == 200
    assert thumb_resp.content.startswith(b"RIFF")
    assert b"WEBP" in thumb_resp.content[:16]


def test_merchant_upload_allowed_mime_types(client, merchant_auth):
    """Uploading JPEG, PNG, and WEBP should all be accepted."""
    formats = [
        ("JPEG", "photo.jpg", "image/jpeg"),
        ("PNG", "photo.png", "image/png"),
        ("WEBP", "photo.webp", "image/webp"),
    ]
    for fmt, fname, mime in formats:
        b = _make_test_image(format=fmt, size=(40, 40))
        files = {"file": (fname, b, mime)}
        res = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files)
        assert res.status_code == 200, f"Expected 200 for {mime}, got {res.status_code}"
        assert res.json()["content_type"] == mime


def test_cloud_storage_s3_r2_upload_with_cdn_urls(client, merchant_auth, monkeypatch):
    """When cloud storage environment variables are set, files and thumbnails upload to S3/R2/GCS and return CDN URLs."""
    monkeypatch.setenv("AWS_S3_BUCKET", "myarea24-media-prod")
    monkeypatch.setenv("CDN_DOMAIN", "cdn.myarea24.in")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "mock_key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "mock_secret")

    mock_s3 = MagicMock()
    with patch("boto3.client", return_value=mock_s3):
        img_bytes = _make_test_image(format="PNG", color="orange")
        files = {"file": ("shelf_banner.png", img_bytes, "image/png")}
        response = client.post("/api/v1/merchant/upload-image", headers=merchant_auth["headers"], files=files)
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "success"
        assert data["storage_provider"] == "cloud"
        assert data["cdn_url"].startswith("https://cdn.myarea24.in/uploads/merchant/")
        assert data["thumbnail_url"].startswith("https://cdn.myarea24.in/uploads/merchant/thumbnails/")
        assert data["thumbnail_url"].endswith("_thumb.webp")

        # Verify boto3 put_object called for both main image and thumbnail
        assert mock_s3.put_object.call_count == 2
        calls = mock_s3.put_object.call_args_list
        keys = [c[1]["Key"] for c in calls]
        assert any(k.startswith("uploads/merchant/") and not k.startswith("uploads/merchant/thumbnails/") for k in keys)
        assert any(k.startswith("uploads/merchant/thumbnails/") and k.endswith("_thumb.webp") for k in keys)


def test_merchant_product_creation_with_uploaded_image(client, merchant_auth):
    """Product created with uploaded image should store image_url and return it in listings."""
    custom_img_url = "/static/uploads/merchant/biz_1_test_prod.webp"
    payload = {
        "name": "Fresh Organic Cold Brew",
        "category": "Beverages",
        "price": 180.0,
        "mrp": 220.0,
        "description": "Cold brewed in-house for 16 hours",
        "image": custom_img_url,
    }
    create_resp = client.post("/api/v1/merchant/products", headers=merchant_auth["headers"], json=payload)
    assert create_resp.status_code == 200
    assert create_resp.json()["status"] == "success"

    # List products and verify image is populated
    list_resp = client.get("/api/v1/merchant/products", headers=merchant_auth["headers"])
    assert list_resp.status_code == 200
    products = list_resp.json()["products"]
    matched = next((p for p in products if p["name"] == "Fresh Organic Cold Brew"), None)
    assert matched is not None
    assert matched["image"] == custom_img_url


def test_merchant_offer_creation_with_uploaded_banner(client, merchant_auth):
    """Offer created with uploaded banner image should store banner_image_url and return it."""
    banner_url = "/static/uploads/merchant/biz_1_summer_sale.webp"
    payload = {
        "title": "Summer Flash Sale 30% Off",
        "discountText": "30% OFF",
        "code": "SUMMER30",
        "category": "Food & Retail",
        "valid_days": 10,
        "image": banner_url,
    }
    create_resp = client.post("/api/v1/merchant/offers", headers=merchant_auth["headers"], json=payload)
    assert create_resp.status_code == 200
    assert create_resp.json()["status"] == "success"

    # List offers and verify banner image
    list_resp = client.get("/api/v1/merchant/offers", headers=merchant_auth["headers"])
    assert list_resp.status_code == 200
    offers = list_resp.json()["offers"]
    matched = next((o for o in offers if o["title"] == "Summer Flash Sale 30% Off"), None)
    assert matched is not None
    assert matched["image"] == banner_url


def test_storefront_profile_cover_and_logo_update(client, merchant_auth):
    """Updating storefront profile with new cover and logo should persist."""
    new_cover = "/static/uploads/merchant/biz_1_new_cover.jpg"
    new_logo = "/static/uploads/merchant/biz_1_new_logo.png"

    update_resp = client.put(
        "/api/v1/merchant/storefront",
        headers=merchant_auth["headers"],
        json={"cover_image": new_cover, "logo": new_logo},
    )
    assert update_resp.status_code == 200

    profile_resp = client.get("/api/v1/merchant/storefront", headers=merchant_auth["headers"])
    assert profile_resp.status_code == 200
    storefront = profile_resp.json()["storefront"]
    assert storefront["logo"] == new_logo or storefront["coverImage"] == new_cover

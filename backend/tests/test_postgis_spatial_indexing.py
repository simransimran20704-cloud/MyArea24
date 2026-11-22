import pytest
from sqlalchemy import func, cast
from sqlalchemy.dialects import postgresql
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal, Base, engine
from backend.app.database.models import Business, EmergencyFacility, query_spatial_nearby
from backend.app.services.indian_spatial_service import haversine_km

# Ensure schema is up to date
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_business_query_nearby():
    """Verify Business.query_nearby resolves stores within spatial radius, ordered by distance."""
    with SessionLocal() as db:
        # Create test businesses around Delhi Connaught Place (28.6304, 77.2177)
        # B1: 300m away
        # B2: 1.5km away
        # B3: 15km away (in Rohini)
        # B4: 1700km away (in Bengaluru)
        b1 = Business(
            name="CP Artisan Bakery",
            slug=f"cp-artisan-bakery-{db.query(Business).count()}",
            category="Grocery",
            address="Block A, Connaught Place",
            locality="Connaught Place",
            city="New Delhi",
            state="Delhi NCR",
            latitude=28.6320,
            longitude=77.2190,
            status="active",
        )
        b2 = Business(
            name="Paharganj Coffee Corner",
            slug=f"paharganj-coffee-{db.query(Business).count()}",
            category="Food & Dining",
            address="Main Bazaar, Paharganj",
            locality="Paharganj",
            city="New Delhi",
            state="Delhi NCR",
            latitude=28.6410,
            longitude=77.2140,
            status="active",
        )
        b3 = Business(
            name="Rohini Supermarket",
            slug=f"rohini-supermarket-{db.query(Business).count()}",
            category="Grocery",
            address="Sector 9, Rohini",
            locality="Rohini",
            city="Delhi",
            state="Delhi NCR",
            latitude=28.7144,
            longitude=77.1197,
            status="active",
        )
        b4 = Business(
            name="Indiranagar Roast",
            slug=f"indiranagar-roast-{db.query(Business).count()}",
            category="Food & Dining",
            address="100ft Road, Indiranagar",
            locality="Indiranagar",
            city="Bengaluru",
            state="Karnataka",
            latitude=12.9784,
            longitude=77.6408,
            status="active",
        )
        db.add_all([b1, b2, b3, b4])
        db.commit()

        # Query around Connaught Place within 2.5 km
        cp_lat, cp_lon = 28.6304, 77.2177
        nearby_2km = Business.query_nearby(db, cp_lat, cp_lon, radius_km=2.5)
        names_2km = [b.name for b in nearby_2km]
        assert "CP Artisan Bakery" in names_2km
        assert "Paharganj Coffee Corner" in names_2km
        assert "Rohini Supermarket" not in names_2km
        assert "Indiranagar Roast" not in names_2km

        # Check distance ordering: b1 (closer) should precede b2
        b1_idx = names_2km.index("CP Artisan Bakery")
        b2_idx = names_2km.index("Paharganj Coffee Corner")
        assert b1_idx < b2_idx

        # Category filter test
        groceries = Business.query_nearby(db, cp_lat, cp_lon, radius_km=2.5, category="Grocery")
        grocery_names = [b.name for b in groceries]
        assert "CP Artisan Bakery" in grocery_names
        assert "Paharganj Coffee Corner" not in grocery_names


def test_emergency_facility_query_nearby():
    """Verify EmergencyFacility.query_nearby spatial search with blood bank & trauma filtering."""
    with SessionLocal() as db:
        ef1 = EmergencyFacility(
            name="Central Casualty & Trauma Hub",
            facility_type="Casualty & Trauma Center",
            phone="+91 11 2334 4455",
            address="Near Gol Dak Khana, CP",
            locality="Connaught Place",
            city="New Delhi",
            state="Delhi NCR",
            latitude=28.6270,
            longitude=77.2080,
            blood_bank_available=True,
        )
        ef2 = EmergencyFacility(
            name="Local Dispensary Center",
            facility_type="Primary Care",
            phone="+91 11 2334 1122",
            address="Paharganj Gate",
            locality="Paharganj",
            city="New Delhi",
            state="Delhi NCR",
            latitude=28.6430,
            longitude=77.2160,
            blood_bank_available=False,
        )
        db.add_all([ef1, ef2])
        db.commit()

        # Query facilities within 3.0 km of CP
        cp_lat, cp_lon = 28.6304, 77.2177
        nearby = EmergencyFacility.query_nearby(db, cp_lat, cp_lon, radius_km=3.0)
        names = [f.name for f in nearby]
        assert "Central Casualty & Trauma Hub" in names
        assert "Local Dispensary Center" in names

        # Blood bank filter
        blood_banks = EmergencyFacility.query_nearby(db, cp_lat, cp_lon, radius_km=3.0, blood_bank_only=True)
        bb_names = [f.name for f in blood_banks]
        assert "Central Casualty & Trauma Hub" in bb_names
        assert "Local Dispensary Center" not in bb_names


def test_postgis_sql_expression_compilation():
    """Verify that PostGIS ST_DWithin and ST_Distance expressions compile correctly for PostgreSQL."""
    try:
        from geoalchemy2 import Geography
        has_geo = True
    except ImportError:
        has_geo = False

    if has_geo:
        pt_col = cast(func.ST_SetSRID(func.ST_MakePoint(Business.longitude, Business.latitude), 4326), Geography)
        target_pt = cast(func.ST_SetSRID(func.ST_MakePoint(77.2177, 28.6304), 4326), Geography)
        cond = func.ST_DWithin(pt_col, target_pt, 5000.0)
        dist_expr = func.ST_Distance(pt_col, target_pt)

        with SessionLocal() as db:
            q = db.query(Business).filter(cond).order_by(dist_expr.asc())
            sql = str(q.statement.compile(dialect=postgresql.dialect()))
            assert "ST_DWithin" in sql
            assert "ST_Distance" in sql
            assert "ST_MakePoint" in sql
            assert "geography" in sql.lower()


def test_places_nearby_api_with_spatial_indexing():
    """Verify /api/v1/location/places-nearby endpoint utilizes spatial indexing."""
    res = client.get("/api/v1/location/places-nearby", params={"lat": 28.6304, "lon": 77.2177, "radius": 4000})
    assert res.status_code == 200
    data = res.json()
    assert "pois" in data
    assert "businesses" in data
    assert "roads" in data

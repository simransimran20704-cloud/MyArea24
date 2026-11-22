"""
Automated Test Suite for Indian FMCG / Grocery / Pharmacy Search Hardening
Tests pg_trgm GIN indexing, phonetic & Hinglish synonym expansions, and typo tolerance.
"""

import pytest
from sqlalchemy import func
from sqlalchemy.dialects import postgresql
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database.session import SessionLocal, Base, engine
from backend.app.database.models import Business, Product, User
from backend.app.services.indian_search_synonyms import (
    expand_search_query,
    get_implied_categories_for_query,
    build_fuzzy_text_search_filters,
    INDIAN_SYNONYM_CLUSTERS,
)

Base.metadata.create_all(bind=engine)
client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Phonetic & Hinglish Synonym Engine Unit Tests
# ---------------------------------------------------------------------------

def test_synonym_expansion_dairy_staples():
    """Verify 'doodh', 'dudh', 'dood' expand to dairy staples and brand names."""
    expanded = expand_search_query("doodh")
    assert "doodh" in expanded
    assert any(term in expanded for term in ["milk", "amul", "dairy", "dudh", "paneer"])

    expanded_dudh = expand_search_query("dudh")
    assert "dudh" in expanded_dudh
    assert any(term in expanded_dudh for term in ["milk", "doodh", "amul", "dairy"])


def test_synonym_expansion_flour_and_grains():
    """Verify 'aata', 'atta' expand to wheat, flour, and common staples."""
    expanded = expand_search_query("aata")
    assert "aata" in expanded
    assert any(term in expanded for term in ["atta", "flour", "wheat", "aashirvaad", "gehun"])

    expanded_chawal = expand_search_query("chawal")
    assert "chawal" in expanded_chawal
    assert any(term in expanded_chawal for term in ["rice", "basmati", "poha"])


def test_synonym_expansion_edible_oils():
    """Verify 'tel', 'sarson' expand to oil, mustard, and brand staples."""
    expanded = expand_search_query("tel")
    assert "tel" in expanded
    assert any(term in expanded for term in ["oil", "mustard oil", "sarson", "fortune"])


def test_synonym_expansion_pharmacy_and_otc():
    """Verify 'dawai', 'crocin', 'paracetamol' expand to OTC medicines and healthcare."""
    expanded_dawa = expand_search_query("dawai")
    assert "dawai" in expanded_dawa
    assert any(term in expanded_dawa for term in ["medicine", "pharmacy", "chemist", "paracetamol", "dolo"])

    expanded_crocin = expand_search_query("crocin")
    assert "crocin" in expanded_crocin
    assert any(term in expanded_crocin for term in ["paracetamol", "dolo", "calpol", "fever", "tablet"])


def test_synonym_expansion_multiword_and_empty():
    """Verify compound queries preserve input priority and empty queries handle gracefully."""
    expanded_multi = expand_search_query("amul doodh")
    assert expanded_multi[0] == "amul doodh"
    assert "amul" in expanded_multi
    assert "doodh" in expanded_multi
    assert any(term in expanded_multi for term in ["milk", "dairy", "paneer"])

    assert expand_search_query("") == []
    assert expand_search_query("   ") == []


def test_implied_categories_mapping():
    """Verify colloquial Indian terms map to accurate canonical categories."""
    assert "Pharmacy" in get_implied_categories_for_query("dawai")
    assert "Pharmacy" in get_implied_categories_for_query("dolo 650")
    assert "Grocery" in get_implied_categories_for_query("tamatar")
    assert "Grocery" in get_implied_categories_for_query("doodh")
    assert "Food & Dining" in get_implied_categories_for_query("mithai")
    assert "Electronics" in get_implied_categories_for_query("earphones")
    assert "Services" in get_implied_categories_for_query("bijliwala")


# ---------------------------------------------------------------------------
# 2. PostgreSQL pg_trgm & GIN Index SQL Compilation Tests
# ---------------------------------------------------------------------------

def test_pg_trgm_sql_dialect_compilation():
    """Verify pg_trgm similarity expressions compile strictly to PostgreSQL dialect."""
    expr = func.similarity(Product.name, "crocin") >= 0.25
    compiled_pg = str(expr.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "similarity(" in compiled_pg
    assert "0.25" in compiled_pg


def test_build_fuzzy_text_search_filters_compilation():
    """Verify build_fuzzy_text_search_filters generates valid OR clauses."""
    # SQLite mode
    sqlite_filter = build_fuzzy_text_search_filters(
        Product.name, ["doodh", "milk"], is_postgres=False
    )
    assert sqlite_filter is not None

    # PostgreSQL mode (includes similarity)
    pg_filter = build_fuzzy_text_search_filters(
        Product.name, ["doodh", "milk"], is_postgres=True, similarity_threshold=0.3
    )
    assert pg_filter is not None
    compiled_pg = str(pg_filter.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "similarity(" in compiled_pg
    assert "0.3" in compiled_pg


# ---------------------------------------------------------------------------
# 3. API Integration: Business Listing with Phonetic Synonyms
# ---------------------------------------------------------------------------

def test_business_search_with_hinglish_terms():
    """Verify list_businesses finds relevant businesses when searched with Hinglish terms."""
    db = SessionLocal()
    try:
        # Create test businesses if not exist
        pharmacy = db.query(Business).filter(Business.name == "Apollo Care Pharmacy Test").first()
        if not pharmacy:
            pharmacy = Business(
                name="Apollo Care Pharmacy Test",
                slug=f"apollo-care-pharmacy-test-{db.query(Business).count()}",
                category="Pharmacy",
                subcategory="Medicines & Healthcare",
                address="Shop 4, Market Central",
                locality="Kalkaji",
                city="New Delhi",
                state="Delhi NCR",
                latitude=28.5400,
                longitude=77.2500,
                status="active",
            )
            db.add(pharmacy)

        halwai = db.query(Business).filter(Business.name == "Aggarwal Halwai Sweets Test").first()
        if not halwai:
            halwai = Business(
                name="Aggarwal Halwai Sweets Test",
                slug=f"aggarwal-halwai-sweets-test-{db.query(Business).count()}",
                category="Food & Dining",
                subcategory="Sweets & Bakery",
                address="Shop 12, Main Road",
                locality="Lajpat Nagar",
                city="New Delhi",
                state="Delhi NCR",
                latitude=28.5700,
                longitude=77.2400,
                status="active",
            )
            db.add(halwai)

        dairy = db.query(Business).filter(Business.name == "Shri Krishna Dairy & Paneer Test").first()
        if not dairy:
            dairy = Business(
                name="Shri Krishna Dairy & Paneer Test",
                slug=f"shri-krishna-dairy-test-{db.query(Business).count()}",
                category="Grocery",
                subcategory="Dairy & Morning Staples",
                address="Booth 19, Sector 2",
                locality="Defence Colony",
                city="New Delhi",
                state="Delhi NCR",
                latitude=28.5750,
                longitude=77.2300,
                status="active",
            )
            db.add(dairy)

        db.commit()

        # 1. Search 'dawai' -> must match Apollo Care Pharmacy
        res_dawa = client.get("/api/v1/businesses?q=dawai")
        assert res_dawa.status_code == 200
        data_dawa = res_dawa.json()
        names_dawa = [b["name"] for b in data_dawa.get("items", [])]
        assert any("Pharmacy" in n for n in names_dawa)

        # 2. Search 'mithai' -> must match Aggarwal Halwai Sweets
        res_mithai = client.get("/api/v1/businesses?q=mithai")
        assert res_mithai.status_code == 200
        data_mithai = res_mithai.json()
        names_mithai = [b["name"] for b in data_mithai.get("items", [])]
        assert any("Aggarwal" in n or "Sweets" in n for n in names_mithai)

        # 3. Search 'doodh' -> must match Shri Krishna Dairy & Paneer
        res_doodh = client.get("/api/v1/businesses?q=doodh")
        assert res_doodh.status_code == 200
        data_doodh = res_doodh.json()
        names_doodh = [b["name"] for b in data_doodh.get("items", [])]
        assert any("Dairy" in n for n in names_doodh)

    finally:
        db.close()


# ---------------------------------------------------------------------------
# 4. API Integration: Product Search with Phonetic Synonyms & Typos
# ---------------------------------------------------------------------------

def test_product_search_with_phonetic_synonyms():
    """Verify search_products discovers products using Hinglish, phonetic variants and brand synonyms."""
    db = SessionLocal()
    try:
        # Create merchant business
        b = db.query(Business).filter(Business.name == "Super Mart Search Test").first()
        if not b:
            b = Business(
                name="Super Mart Search Test",
                slug=f"super-mart-search-test-{db.query(Business).count()}",
                category="Grocery",
                address="Market 1",
                locality="Kalkaji",
                city="New Delhi",
                state="Delhi NCR",
                latitude=28.5400,
                longitude=77.2500,
                status="active",
            )
            db.add(b)
            db.commit()
            db.refresh(b)

        # Create products with standard commercial Indian names
        p1 = db.query(Product).filter(Product.name == "Amul Taaza Fresh Toned Milk 1L").first()
        if not p1:
            p1 = Product(
                business_id=b.id,
                name="Amul Taaza Fresh Toned Milk 1L",
                brand="Amul",
                category="Grocery",
                local_price=54.0,
                mrp=56.0,
                availability_status="in_stock",
            )
            db.add(p1)

        p2 = db.query(Product).filter(Product.name == "Dolo 650 Paracetamol 15 Tablets").first()
        if not p2:
            p2 = Product(
                business_id=b.id,
                name="Dolo 650 Paracetamol 15 Tablets",
                brand="Micro Labs",
                category="Pharmacy",
                local_price=30.0,
                mrp=34.0,
                availability_status="in_stock",
            )
            db.add(p2)

        p3 = db.query(Product).filter(Product.name == "Aashirvaad Superior MP Atta 5kg").first()
        if not p3:
            p3 = Product(
                business_id=b.id,
                name="Aashirvaad Superior MP Atta 5kg",
                brand="Aashirvaad",
                category="Grocery",
                local_price=245.0,
                mrp=260.0,
                availability_status="in_stock",
            )
            db.add(p3)

        p4 = db.query(Product).filter(Product.name == "Fortune Kachi Ghani Pure Mustard Oil 1L").first()
        if not p4:
            p4 = Product(
                business_id=b.id,
                name="Fortune Kachi Ghani Pure Mustard Oil 1L",
                brand="Fortune",
                category="Grocery",
                local_price=142.0,
                mrp=155.0,
                availability_status="in_stock",
            )
            db.add(p4)

        db.commit()

        # 1. Search 'doodh' -> finds Milk and Amul products
        res_doodh = client.get(f"/api/v1/products?q=doodh&business_id={b.id}")
        assert res_doodh.status_code == 200
        p_names_doodh = [p["name"] for p in res_doodh.json().get("items", [])]
        assert any("Amul Taaza" in n for n in p_names_doodh)

        # 2. Search 'crocin' -> finds Dolo 650 Paracetamol
        res_crocin = client.get(f"/api/v1/products?q=crocin&business_id={b.id}")
        assert res_crocin.status_code == 200
        p_names_crocin = [p["name"] for p in res_crocin.json().get("items", [])]
        assert any("Dolo 650" in n for n in p_names_crocin)

        # 3. Search 'aata' (phonetic typo for atta) -> finds Aashirvaad Atta
        res_aata = client.get(f"/api/v1/products?q=aata&business_id={b.id}")
        assert res_aata.status_code == 200
        p_names_aata = [p["name"] for p in res_aata.json().get("items", [])]
        assert any("Aashirvaad" in n for n in p_names_aata)

        # 4. Search 'sarson tel' -> finds Fortune Mustard Oil
        res_tel = client.get(f"/api/v1/products?q=sarson+tel&business_id={b.id}")
        assert res_tel.status_code == 200
        p_names_tel = [p["name"] for p in res_tel.json().get("items", [])]
        assert any("Fortune Kachi Ghani" in n for n in p_names_tel)

    finally:
        db.close()

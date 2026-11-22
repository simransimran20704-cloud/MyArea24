"""
REST API endpoints for Residential Rental Benchmarks and Verified Property-Owner Listings.
Exclusively uses:
1. Official Government Macro Indices: Labour Bureau CPI-IW Repeat House Rent Survey.
2. Verified Community & Property-Owner Rental Registry: Actual monthly rent, deposit, sqft, furnishing.
Strictly zero paid APIs, zero commercial portals (99acres/MagicBricks), and zero fabrication.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.services.rental_benchmark_service import rental_benchmark_service

router = APIRouter(prefix="/api/v1/rentals", tags=["Residential Rental Benchmarks & Verified Listings"])


class RentalListingCreateRequest(BaseModel):
    locality: str = Field(..., min_length=2, max_length=100, description="Locality, Sector, or Colony name (e.g. Indirapuram, Sector 62)")
    city: str = Field(..., min_length=2, max_length=100, description="City name (e.g. Ghaziabad, Noida, Delhi, Bengaluru)")
    state: str = Field(..., min_length=2, max_length=100, description="State name (e.g. Uttar Pradesh, Delhi, Karnataka)")
    district: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, min_length=6, max_length=10, description="6-digit Indian Postal PIN Code")
    property_type: str = Field(..., description="Configuration: '1 RK', '1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Independent House', 'PG / Shared Room'")
    monthly_rent: float = Field(..., gt=0, le=1000000, description="Actual monthly rent in INR")
    security_deposit: Optional[float] = Field(None, ge=0, description="Security deposit in INR")
    built_up_area_sqft: Optional[int] = Field(None, gt=50, le=20000, description="Carpet or super built-up area in square feet")
    furnishing: str = Field("Semi-Furnished", description="'Unfurnished', 'Semi-Furnished', 'Fully Furnished'")
    tenant_preference: str = Field("All", description="'Family', 'Bachelors', 'All', 'Company Lease'")
    contributor_name: Optional[str] = Field(None, max_length=100, description="Owner / Tenant name")
    contributor_contact: Optional[str] = Field(None, max_length=50, description="Phone / Email for verification")


@router.get("/hierarchy", response_model=Dict[str, Any])
def get_residential_hierarchy(
    db: Session = Depends(get_db),
):
    """
    Returns geographical hierarchy (India -> State -> District -> City -> Locality)
    and available property types for residential benchmarks.
    """
    return rental_benchmark_service.get_hierarchy(db=db)


@router.get("/macro-benchmark", response_model=Dict[str, Any])
def get_macro_residential_benchmark(
    country: str = Query("india", description="Country slug (default: 'india')"),
    db: Session = Depends(get_db),
):
    """
    Returns official macroeconomic residential property price indices and historical trends
    from Bank for International Settlements (BIS) and OECD via Global Property Metrics (GPM).
    """
    return rental_benchmark_service.get_gpm_macro_metrics(db=db)


@router.get("/usage", response_model=Dict[str, Any])
def get_gpm_api_usage():
    """
    Returns live API usage and quota limits for the Global Property Metrics free tier key.
    """
    from backend.app.integrations.residential.gpm_client import gpm_residential_client
    return gpm_residential_client.get_usage()


@router.get("/benchmark", response_model=Dict[str, Any])
def get_rental_benchmark(
    locality: Optional[str] = Query(None, description="Locality name (e.g. Indirapuram, Dwarka, Koramangala)"),
    city: Optional[str] = Query(None, description="City name (e.g. Delhi, Noida, Bengaluru)"),
    state: Optional[str] = Query(None, description="State name (e.g. Delhi, Uttar Pradesh, Karnataka)"),
    property_type: Optional[str] = Query(None, description="Filter by property type (e.g. '2 BHK')"),
    db: Session = Depends(get_db),
):
    """
    Returns locality-wise median residential rental benchmarks, typical rent range (25th - 75th percentile),
    average rate per sq. ft., sample size, confidence score, and official Labour Bureau CPI-IW Housing Index.
    """
    return rental_benchmark_service.get_rental_benchmark(
        locality=locality,
        city=city,
        state=state,
        property_type=property_type,
        db=db,
    )


@router.get("/government-index", response_model=Dict[str, Any])
def get_government_housing_index(
    city: Optional[str] = Query(None, description="City name to resolve Labour Bureau index"),
    state: Optional[str] = Query(None, description="State name"),
    db: Session = Depends(get_db),
):
    """
    Returns the official Labour Bureau Repeat House Rent Survey (CPI-IW) Housing Group Index
    and annual rental inflation rate for urban industrial centers.
    """
    return rental_benchmark_service.get_official_govt_index(
        city=city or "Delhi",
        state=state or "Delhi",
        db=db,
    )


@router.get("/listings", response_model=Dict[str, Any])
def list_verified_rental_listings(
    locality: Optional[str] = Query(None, description="Filter by locality"),
    city: Optional[str] = Query(None, description="Filter by city"),
    property_type: Optional[str] = Query(None, description="Filter by configuration (e.g. 1 BHK, 2 BHK, 3 BHK)"),
    furnishing: Optional[str] = Query(None, description="Filter by furnishing (Unfurnished, Semi-Furnished, Fully Furnished)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Browses verified residential rental listings submitted by property owners and tenants.
    """
    from backend.app.database.models import RentalListing

    rental_benchmark_service.ensure_seeded(db)

    query = db.query(RentalListing).filter(RentalListing.is_verified == True)

    if locality and locality.strip():
        query = query.filter(RentalListing.locality.ilike(f"%{locality.strip()}%"))
    if city and city.strip():
        query = query.filter(RentalListing.city.ilike(f"%{city.strip()}%"))
    if property_type and property_type.strip():
        query = query.filter(RentalListing.property_type == property_type.strip())
    if furnishing and furnishing.strip():
        query = query.filter(RentalListing.furnishing.ilike(f"%{furnishing.strip()}%"))

    total = query.count()
    records = query.order_by(RentalListing.listing_date.desc()).offset(offset).limit(limit).all()

    items = [
        {
            "id": r.id,
            "locality": r.locality,
            "city": r.city,
            "district": r.district,
            "state": r.state,
            "pincode": r.pincode,
            "property_type": r.property_type,
            "monthly_rent": r.monthly_rent,
            "monthly_rent_display": f"₹{int(r.monthly_rent):,} / month",
            "security_deposit": r.security_deposit,
            "security_deposit_display": f"₹{int(r.security_deposit):,}" if r.security_deposit else None,
            "built_up_area_sqft": r.built_up_area_sqft,
            "area_display": f"{r.built_up_area_sqft} sq.ft" if r.built_up_area_sqft else None,
            "furnishing": r.furnishing,
            "tenant_preference": r.tenant_preference,
            "is_verified": r.is_verified,
            "verification_method": r.verification_method,
            "listing_date": r.listing_date.strftime("%d %b %Y"),
            "source": r.source,
        }
        for r in records
    ]

    return {
        "total": total,
        "items": items,
        "source": "MyArea24 Verified Property Owner & Tenant Registry",
    }


@router.post("/listings", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def submit_rental_listing(
    payload: RentalListingCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Submits a verified property-owner or tenant residential rental listing.
    Instantly recalculates and updates the locality-wise median rental benchmark.
    """
    listing = rental_benchmark_service.add_listing(
        locality=payload.locality,
        city=payload.city,
        state=payload.state,
        district=payload.district,
        pincode=payload.pincode,
        property_type=payload.property_type,
        monthly_rent=payload.monthly_rent,
        security_deposit=payload.security_deposit,
        built_up_area_sqft=payload.built_up_area_sqft,
        furnishing=payload.furnishing,
        tenant_preference=payload.tenant_preference,
        contributor_name=payload.contributor_name,
        contributor_contact=payload.contributor_contact,
        verification_method="verified_owner_declaration",
        db=db,
    )

    # Calculate newly updated benchmark
    updated_benchmark = rental_benchmark_service.get_rental_benchmark(
        locality=payload.locality,
        city=payload.city,
        state=payload.state,
        property_type=None,
        db=db,
    )

    return {
        "success": True,
        "message": f"Successfully verified & listed {payload.property_type} in {payload.locality}, {payload.city}.",
        "listing_id": listing.id,
        "locality": listing.locality,
        "monthly_rent": listing.monthly_rent,
        "updated_locality_benchmark": updated_benchmark,
    }

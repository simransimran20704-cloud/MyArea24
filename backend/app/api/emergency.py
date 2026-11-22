from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database.models import EmergencyFacility
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.emergency_poi_service import sync_live_emergency_facilities

router = APIRouter(prefix="/api/v1/emergency", tags=["Emergency Health & Casualty Facilities"])


@router.get("/facilities", response_model=Dict[str, Any])
def get_emergency_facilities(
    locality: Optional[str] = Query(None, description="Search locality name (e.g. AIIMS, Koramangala, Bandra)"),
    city: Optional[str] = Query(None, description="City name (e.g. Delhi, Bengaluru, Mumbai, Pune, Lucknow, Patna)"),
    state: Optional[str] = Query(None, description="State name (e.g. Karnataka, Maharashtra, Delhi)"),
    blood_bank_only: bool = Query(False, description="Filter facilities with operational blood bank"),
    facility_type: Optional[str] = Query(None, description="Filter by facility type"),
    latitude: Optional[float] = Query(None, description="Latitude for distance sorting"),
    longitude: Optional[float] = Query(None, description="Longitude for distance sorting"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Returns verified casualty & trauma centers filtered by locality, city, or proximity.
    Pan-India coverage ensuring non-Delhi residents receive appropriate local casualty contacts.
    """
    query = db.query(EmergencyFacility)

    # Filter by city, locality, state, or area tokens (handles composite strings like 'Delhi Connaught Place')
    tokens = []
    if city and city.strip():
        tokens.extend([t for t in city.strip().lower().replace("/", " ").replace(",", " ").split() if len(t) > 2])
    if locality and locality.strip():
        tokens.extend([t for t in locality.strip().lower().replace("/", " ").replace(",", " ").split() if len(t) > 2])

    filters = []
    if city and city.strip():
        c_clean = city.strip().lower()
        filters.append(EmergencyFacility.city.ilike(f"%{c_clean}%"))
        filters.append(EmergencyFacility.locality.ilike(f"%{c_clean}%"))
    if state and state.strip():
        s_clean = state.strip().lower()
        filters.append(EmergencyFacility.state.ilike(f"%{s_clean}%"))

    for t in tokens:
        filters.append(EmergencyFacility.city.ilike(f"%{t}%"))
        filters.append(EmergencyFacility.locality.ilike(f"%{t}%"))
        filters.append(EmergencyFacility.state.ilike(f"%{t}%"))

    if filters:
        query = query.filter(or_(*filters))

    # Optional attribute filters
    if blood_bank_only:
        query = query.filter(EmergencyFacility.blood_bank_available == True)
    if facility_type and facility_type.strip():
        query = query.filter(EmergencyFacility.facility_type.ilike(f"%{facility_type.strip()}%"))

    # Auto-sync real live facilities around coordinates if DB results are low (using spatial index)
    if latitude is not None and longitude is not None:
        try:
            nearby_list = EmergencyFacility.query_nearby(db, latitude, longitude, radius_km=15.0, limit=4)
            if len(nearby_list) < 4:
                sync_live_emergency_facilities(db, latitude, longitude, city or locality, state)
        except Exception:
            pass

    if latitude is not None and longitude is not None:
        import math
        rad_lat = math.radians(latitude)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (EmergencyFacility.latitude - latitude) * (EmergencyFacility.latitude - latitude)
            + (EmergencyFacility.longitude - longitude) * (EmergencyFacility.longitude - longitude) * cos_lat_sq
        )
        query = query.order_by(dist_expr.asc(), EmergencyFacility.name.asc())
    else:
        dist_expr = None
        query = query.order_by(EmergencyFacility.name.asc())

    records = query.limit(limit).all()

    # If no specific matches found, fall back to all registered facilities
    if not records:
        fallback_query = db.query(EmergencyFacility)
        if blood_bank_only:
            fallback_query = fallback_query.filter(EmergencyFacility.blood_bank_available == True)
        if facility_type and facility_type.strip():
            fallback_query = fallback_query.filter(EmergencyFacility.facility_type.ilike(f"%{facility_type.strip()}%"))

        if dist_expr is not None:
            fallback_query = fallback_query.order_by(dist_expr.asc(), EmergencyFacility.name.asc())
        else:
            fallback_query = fallback_query.order_by(EmergencyFacility.name.asc())
        records = fallback_query.limit(limit).all()

    results = []
    for r in records:
        dist_km = None
        if latitude is not None and longitude is not None:
            dist_km = round(haversine_distance_km(latitude, longitude, r.latitude, r.longitude), 1)

        results.append({
            "id": r.id,
            "name": r.name,
            "facility_type": r.facility_type,
            "phone": r.phone,
            "secondary_phone": r.secondary_phone,
            "address": r.address,
            "locality": r.locality,
            "city": r.city,
            "state": r.state,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "is_24_7": r.is_24_7,
            "trauma_level": r.trauma_level,
            "blood_bank_available": r.blood_bank_available,
            "distance_km": dist_km,
        })

    sliced = results

    return {
        "total": len(sliced),
        "national_emergency_number": "112",
        "ambulance_number": "108 / 102",
        "fire_number": "101",
        "disaster_number": "1077",
        "nhai_highway_helpline": "1033",
        "railway_security_helpline": "139",
        "women_safety_helpline": "1091 / 181",
        "ndma_disaster_helpline": "1078",
        "sdma_state_control": "1070",
        "flood_maritime_rescue": "1554",
        "expressway_emergency_desks": [
            {"name": "NHAI National Highway Emergency", "route": "All National Highways & Expressways", "phone": "1033"},
            {"name": "Yamuna Expressway Control Room", "route": "Greater Noida – Agra (165 km)", "phone": "1800-102-7777"},
            {"name": "Mumbai-Pune Expressway Highway Police", "route": "Mumbai – Pune (94 km)", "phone": "98224-98224"},
            {"name": "Eastern Peripheral Expressway (NE-2)", "route": "Kundli – Ghaziabad – Palwal", "phone": "1800-180-2444"},
            {"name": "Samruddhi Mahamarg Highway Help", "route": "Mumbai – Nagpur (701 km)", "phone": "1800-233-2233"},
            {"name": "Delhi-Meerut Expressway Helpline", "route": "Delhi – Meerut Corridor", "phone": "1033"},
        ],
        "facilities": sliced,
    }


# ==============================================================================
# NATIONAL HOSPITAL DIRECTORY (MoHFW / NIHFW - data.gov.in)
# OGD Resource ID: 98fa254e-c5f8-4910-a19b-4828939b477d
# ==============================================================================

hospitals_router = APIRouter(prefix="/api/v1/hospitals", tags=["National Hospital Directory (NIHFW)"])


@hospitals_router.get("/filter-options", response_model=Dict[str, Any])
@router.get("/hospitals/filter-options", response_model=Dict[str, Any])
def get_hospital_filter_options(
    state: Optional[str] = Query(None, description="Optional state filter for dependent districts"),
    db: Session = Depends(get_db),
):
    """
    Returns available states, districts, care_types, and discipline systems
    from the verified National Hospital Directory.
    """
    from backend.app.database.models import HospitalDirectory

    s_state = state.strip() if isinstance(state, str) and state.strip() else None

    states = sorted([s[0] for s in db.query(HospitalDirectory.state).distinct().all() if s[0]])
    
    dist_q = db.query(HospitalDirectory.district).distinct()
    if s_state and s_state.lower() not in ("all", "all india", "india"):
        dist_q = dist_q.filter(HospitalDirectory.state.ilike(f"%{s_state}%"))
    districts = sorted([d[0] for d in dist_q.all() if d[0]])

    care_types = sorted([c[0] for c in db.query(HospitalDirectory.care_type).distinct().all() if c[0]])
    systems = sorted([s[0] for s in db.query(HospitalDirectory.discipline_system).distinct().all() if s[0]])

    return {
        "states": states,
        "districts": districts,
        "care_types": care_types,
        "systems": systems,
        "total_records": db.query(HospitalDirectory).count(),
        "source": "Verified National Healthcare Network",
        "registry_id": "central-healthcare-registry",
    }


@hospitals_router.get("/directory", response_model=Dict[str, Any])
@router.get("/hospitals/directory", response_model=Dict[str, Any])
def get_hospital_directory(
    state: Optional[str] = Query(None, description="State filter"),
    district: Optional[str] = Query(None, description="District filter"),
    care_type: Optional[str] = Query(None, description="Care type filter (Hospital, Community Health Centre, etc.)"),
    system: Optional[str] = Query(None, description="Discipline system (Allopathic, AYUSH)"),
    search: Optional[str] = Query(None, description="Search hospital name, address, or locality"),
    pincode: Optional[str] = Query(None, description="PIN code filter"),
    has_emergency_only: bool = Query(False, description="Filter only facilities with 24/7 emergency care"),
    has_bloodbank_only: bool = Query(False, description="Filter only facilities with operational blood bank"),
    has_ambulance_only: bool = Query(False, description="Filter only facilities with operational ambulance"),
    lat: Optional[float] = Query(None, description="User latitude for distance calculation"),
    lon: Optional[float] = Query(None, description="User longitude for distance calculation"),
    radius_km: float = Query(35.0, ge=1.0, le=100.0),
    sort_by: str = Query("nearest", description="'nearest', 'name_asc', 'beds_desc'"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    sync_live: bool = Query(False, description="Sync fresh records from data.gov.in if true"),
    db: Session = Depends(get_db),
):
    """
    Returns verified hospitals from the National Hospital Directory with contact details,
    bed counts, emergency availability, and turn-by-turn navigation links.
    """
    from backend.app.database.models import HospitalDirectory
    from backend.app.integrations.health.hospital_client import hospital_client
    from backend.app.intelligence.rules import haversine_distance_km

    s_state = state.strip() if isinstance(state, str) and state.strip() else None
    s_district = district.strip() if isinstance(district, str) and district.strip() else None
    s_care = care_type.strip() if isinstance(care_type, str) and care_type.strip() else None
    s_system = system.strip() if isinstance(system, str) and system.strip() else None
    s_search = search.strip() if isinstance(search, str) and search.strip() else None
    s_pincode = pincode.strip() if isinstance(pincode, str) and pincode.strip() else None
    s_sync = bool(sync_live) if isinstance(sync_live, bool) else False

    if s_sync and s_state:
        try:
            hospital_client.sync_to_database(db, state=s_state, district=s_district, limit=limit)
        except Exception as e:
            logger.warning(f"[hospitals_api] Sync notice: {e}")

    query = db.query(HospitalDirectory)

    if s_state and s_state.lower() not in ("all", "all india", "india"):
        query = query.filter(HospitalDirectory.state.ilike(f"%{s_state}%"))

    if s_district and s_district.lower() not in ("all", "all districts"):
        query = query.filter(HospitalDirectory.district.ilike(f"%{s_district}%"))

    if s_care and s_care.lower() != "all":
        query = query.filter(HospitalDirectory.care_type.ilike(f"%{s_care}%"))

    if s_system and s_system.lower() != "all":
        query = query.filter(HospitalDirectory.discipline_system.ilike(f"%{s_system}%"))

    if s_pincode:
        query = query.filter(
            or_(
                HospitalDirectory.pincode == s_pincode,
                HospitalDirectory.address.ilike(f"%{s_pincode}%"),
            )
        )

    if has_emergency_only:
        query = query.filter(HospitalDirectory.has_emergency == True)

    if has_bloodbank_only:
        query = query.filter(HospitalDirectory.has_bloodbank == True)

    if has_ambulance_only:
        query = query.filter(HospitalDirectory.has_ambulance == True)

    if s_search:
        term = f"%{s_search.lower()}%"
        query = query.filter(
            or_(
                HospitalDirectory.hospital_name.ilike(term),
                HospitalDirectory.address.ilike(term),
                HospitalDirectory.district.ilike(term),
                HospitalDirectory.location.ilike(term),
                HospitalDirectory.specialties.ilike(term),
            )
        )

    all_matches = query.all()

    user_coords = lat is not None and lon is not None
    hospitals_with_distance = []

    for h in all_matches:
        dist_km = None
        if user_coords and h.latitude and h.longitude:
            try:
                dist_km = round(haversine_distance_km(lat, lon, h.latitude, h.longitude), 2)
            except Exception:
                dist_km = None

        if user_coords and dist_km is not None and dist_km > radius_km:
            continue

        primary_contact = h.emergency_num or h.mobile_number or h.telephone or h.ambulance_phone or "108 / 112"
        maps_link = (
            f"https://maps.google.com/maps?q={h.latitude},{h.longitude}"
            if h.latitude and h.longitude
            else f"https://maps.google.com/maps?q={h.hospital_name}+{h.district or ''}"
        )

        hospitals_with_distance.append({
            "id": h.id,
            "sr_no": h.sr_no,
            "hospital_name": h.hospital_name,
            "care_type": h.care_type or "Hospital",
            "discipline_system": h.discipline_system or "Allopathic",
            "hospital_category": h.hospital_category,
            "state": h.state,
            "district": h.district,
            "subdistrict": h.subdistrict,
            "pincode": h.pincode,
            "address": h.address or f"{h.district}, {h.state}",
            "location": h.location,
            "latitude": h.latitude,
            "longitude": h.longitude,
            "distance_km": dist_km,
            "distance_text": f"{dist_km:.1f} km away" if dist_km is not None else "Distance unavailable",
            "telephone": h.telephone,
            "mobile_number": h.mobile_number,
            "emergency_num": h.emergency_num,
            "ambulance_phone": h.ambulance_phone,
            "bloodbank_phone": h.bloodbank_phone,
            "primary_phone": primary_contact,
            "tollfree": h.tollfree,
            "helpline": h.helpline,
            "email": h.email,
            "website": h.website,
            "specialties": h.specialties,
            "facilities": h.facilities,
            "accreditation": h.accreditation,
            "total_beds": h.total_beds,
            "has_emergency": h.has_emergency,
            "has_bloodbank": h.has_bloodbank,
            "has_ambulance": h.has_ambulance,
            "direction_link": maps_link,
            "source_name": h.source_name,
            "ogd_resource_id": h.resource_id,
        })

    # Sorting
    s = (sort_by or "nearest").lower().strip()
    if s == "beds_desc":
        hospitals_with_distance.sort(key=lambda x: x["total_beds"], reverse=True)
    elif s == "name_asc":
        hospitals_with_distance.sort(key=lambda x: x["hospital_name"].lower())
    else:  # nearest
        if user_coords:
            hospitals_with_distance.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 9999))
        else:
            hospitals_with_distance.sort(key=lambda x: x["hospital_name"].lower())

    total = len(hospitals_with_distance)
    start_idx = (page - 1) * limit
    paginated = hospitals_with_distance[start_idx : start_idx + limit]

    return {
        "module": "National Hospital & Emergency Directory",
        "total": total,
        "page": page,
        "limit": limit,
        "hospitals": paginated,
        "source": "Verified National Healthcare Network",
        "registry_id": "central-healthcare-registry",
    }

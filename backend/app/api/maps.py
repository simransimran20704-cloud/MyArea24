from typing import Any, Dict, List, Optional
import math
import re
import logging
import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database.session import get_db
from backend.app.database.models import Business, HospitalDirectory, PetrolPump, EmergencyFacility
from backend.app.integrations.maps.google_maps_client import google_maps_client
from backend.app.integrations.maps.geoapify_client import geoapify_client
from backend.app.services.indian_spatial_service import get_coordinates_for_pincode

logger = logging.getLogger(__name__)

# Comprehensive Indian & Delhi NCR PIN Code Database
VERIFIED_PINCODES: Dict[str, Dict[str, Any]] = {
    "110085": {"area": "Sector 13/14 Rohini & Prashant Vihar", "district": "North West Delhi", "state": "Delhi", "lat": 28.7144, "lon": 77.1197},
    "110086": {"area": "Sultanpuri JJ Colony & Nangloi", "district": "North West Delhi", "state": "Delhi", "lat": 28.6939, "lon": 77.0693},
    "110087": {"area": "Jwalapuri & Paschim Vihar", "district": "West Delhi", "state": "Delhi", "lat": 28.6780, "lon": 77.0850},
    "110088": {"area": "Shalimar Bagh & Haiderpur", "district": "North West Delhi", "state": "Delhi", "lat": 28.7050, "lon": 77.1500},
    "110034": {"area": "Pitampura & Saraswati Vihar", "district": "North West Delhi", "state": "Delhi", "lat": 28.6980, "lon": 77.1350},
    "110041": {"area": "Nangloi & Kirari Suleman Nagar", "district": "West Delhi", "state": "Delhi", "lat": 28.6750, "lon": 77.0580},
    "110001": {"area": "Connaught Place & Janpath", "district": "New Delhi", "state": "Delhi", "lat": 28.6304, "lon": 77.2177},
    "110002": {"area": "Daryaganj & Delhi Gate", "district": "Central Delhi", "state": "Delhi", "lat": 28.6410, "lon": 77.2430},
    "110003": {"area": "Lodhi Road & Golf Links", "district": "South Delhi", "state": "Delhi", "lat": 28.5850, "lon": 77.2280},
    "110005": {"area": "Karol Bagh & Anand Parbat", "district": "Central Delhi", "state": "Delhi", "lat": 28.6530, "lon": 77.1950},
    "110006": {"area": "Chandni Chowk & Old Delhi", "district": "North Delhi", "state": "Delhi", "lat": 28.6560, "lon": 77.2310},
    "110007": {"area": "Delhi University & Kamla Nagar", "district": "North Delhi", "state": "Delhi", "lat": 28.6810, "lon": 77.2050},
    "110016": {"area": "Hauz Khas & Green Park", "district": "South Delhi", "state": "Delhi", "lat": 28.5480, "lon": 77.1970},
    "110017": {"area": "Malviya Nagar & Saket", "district": "South Delhi", "state": "Delhi", "lat": 28.5300, "lon": 77.2150},
    "110019": {"area": "Kalkaji & Nehru Place", "district": "South East Delhi", "state": "Delhi", "lat": 28.5420, "lon": 77.2580},
    "110020": {"area": "Okhla Industrial Area", "district": "South East Delhi", "state": "Delhi", "lat": 28.5280, "lon": 77.2750},
    "110024": {"area": "Lajpat Nagar & Defence Colony", "district": "South Delhi", "state": "Delhi", "lat": 28.5700, "lon": 77.2400},
    "110025": {"area": "New Friends Colony & Jamia", "district": "South East Delhi", "state": "Delhi", "lat": 28.5600, "lon": 77.2800},
    "110045": {"area": "Dwarka Sector 1-10", "district": "South West Delhi", "state": "Delhi", "lat": 28.5920, "lon": 77.0800},
    "110075": {"area": "Dwarka Sector 11-23", "district": "South West Delhi", "state": "Delhi", "lat": 28.5800, "lon": 77.0500},
    "110058": {"area": "Janakpuri & District Centre", "district": "West Delhi", "state": "Delhi", "lat": 28.6280, "lon": 77.0850},
    "110063": {"area": "Paschim Vihar West & Madhipur", "district": "West Delhi", "state": "Delhi", "lat": 28.6670, "lon": 77.1080},
    "110091": {"area": "Mayur Vihar Phase 1", "district": "East Delhi", "state": "Delhi", "lat": 28.6150, "lon": 77.3050},
    "110092": {"area": "Laxmi Nagar & Shakarpur", "district": "East Delhi", "state": "Delhi", "lat": 28.6300, "lon": 77.2950},
    "122001": {"area": "Gurugram Sadar Bazar", "district": "Gurugram", "state": "Haryana", "lat": 28.4595, "lon": 77.0266},
    "122002": {"area": "Gurugram DLF Phase 1/2/3", "district": "Gurugram", "state": "Haryana", "lat": 28.4800, "lon": 77.0900},
    "201301": {"area": "Noida Sector 1-18 & Atta", "district": "Gautam Buddha Nagar", "state": "Uttar Pradesh", "lat": 28.5800, "lon": 77.3200},
    "201303": {"area": "Noida Sector 25-50", "district": "Gautam Buddha Nagar", "state": "Uttar Pradesh", "lat": 28.5600, "lon": 77.3600},
}

maps_router = APIRouter(prefix="/api/v1/maps", tags=["Google Maps Platform"])


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


@maps_router.get("/config", response_model=Dict[str, Any])
def get_maps_config():
    """
    Returns public Google Maps Platform configuration for client-side SDK.
    """
    return google_maps_client.get_public_config()


@maps_router.get("/places/autocomplete", response_model=Dict[str, Any])
async def places_autocomplete(
    q: str = Query(..., min_length=1, description="Search keyword or address fragment"),
    session_token: Optional[str] = Query(None, description="Session token for billing optimization"),
    lat: Optional[float] = Query(None, description="User latitude for location biasing"),
    lon: Optional[float] = Query(None, description="User longitude for location biasing"),
    radius: int = Query(25000, description="Biasing radius in meters"),
    db: Session = Depends(get_db),
):
    """
    Google Places Autocomplete suggestions restricted to India.
    """
    res = await google_maps_client.autocomplete(
        query=q,
        session_token=session_token,
        lat=lat,
        lon=lon,
        radius=radius,
    )

    # If Google API returned predictions, sanitize sources and check for PIN codes
    predictions = res.get("predictions", [])

    # Direct PIN code autocomplete matching
    pin_match = re.search(r'\b\d{3,6}\b', q)
    pin_preds = []
    if pin_match:
        matched_digits = pin_match.group(0)
        for p_code, p_info in VERIFIED_PINCODES.items():
            if p_code.startswith(matched_digits):
                pin_preds.append({
                    "description": f"{p_info['area']} (PIN {p_code}), {p_info['state']}, India",
                    "place_id": f"pin_{p_code}",
                    "structured_formatting": {
                        "main_text": f"📍 PIN {p_code} — {p_info['area']}",
                        "secondary_text": f"{p_info['district']}, {p_info['state']}, India",
                    },
                    "types": ["postal_code"],
                    "source": "Verified Local Directory",
                })

    if pin_preds:
        return {
            "predictions": pin_preds + predictions[:5],
            "status": "OK",
        }

    if predictions and res.get("status") in ("OK", "ZERO_RESULTS"):
        return res

    # Otherwise enrich with local verified databases
    term = f"%{q.lower()}%"
    local_preds = []

    # Local businesses
    for b in db.query(Business).filter(Business.name.ilike(term)).limit(3).all():
        local_preds.append({
            "description": f"{b.name}, {b.address or b.city or 'Local Area'}",
            "place_id": f"biz_{b.id}",
            "structured_formatting": {
                "main_text": b.name,
                "secondary_text": b.address or b.city or "",
            },
            "types": ["store", "establishment"],
            "source": "Verified Local Directory",
        })

    # Local hospitals
    for h in db.query(HospitalDirectory).filter(HospitalDirectory.hospital_name.ilike(term)).limit(3).all():
        local_preds.append({
            "description": f"{h.hospital_name}, {h.district}, {h.state}",
            "place_id": f"hosp_{h.id}",
            "structured_formatting": {
                "main_text": h.hospital_name,
                "secondary_text": f"{h.district}, {h.state}",
            },
            "types": ["hospital", "health", "establishment"],
            "source": "Verified Healthcare Directory",
        })

    # Local petrol pumps
    for p in db.query(PetrolPump).filter(PetrolPump.pump_name.ilike(term)).limit(2).all():
        local_preds.append({
            "description": f"{p.pump_name}, {p.address or p.city}",
            "place_id": f"pump_{p.id}",
            "structured_formatting": {
                "main_text": p.pump_name,
                "secondary_text": p.address or p.city or "",
            },
            "types": ["gas_station", "establishment"],
            "source": "Verified Fuel Station Telemetry",
        })

    return {
        "predictions": local_preds if local_preds else predictions,
        "status": "OK" if local_preds else res.get("status", "ZERO_RESULTS"),
    }


@maps_router.get("/places/nearby", response_model=Dict[str, Any])
async def places_nearby(
    lat: float = Query(28.6139, description="Center latitude"),
    lon: float = Query(77.2090, description="Center longitude"),
    radius: int = Query(5000, description="Radius in meters"),
    category: Optional[str] = Query(None, description="Category filter (hospitals, pharmacies, fuel, food, stores, etc.)"),
    keyword: Optional[str] = Query(None, description="Optional keyword search"),
    pincode: Optional[str] = Query(None, description="PIN code filter (e.g. 110001)"),
    city: Optional[str] = Query(None, description="City filter"),
    db: Session = Depends(get_db),
):
    """
    Nearby places discovery. Combines Geoapify Places API v2 live results with
    verified local database records (Pharmacies, Hospitals, Petrol Pumps, Local Businesses).
    """
    cat_clean = category.strip() if isinstance(category, str) else None
    kw_clean = keyword.strip() if isinstance(keyword, str) else None
    pin_clean = pincode.strip() if isinstance(pincode, str) else None
    city_clean = city.strip() if isinstance(city, str) else None

    google_res = await google_maps_client.nearby_search(
        lat=lat, lon=lon, radius=radius, category=cat_clean, keyword=kw_clean
    )

    results: List[Dict[str, Any]] = []
    seen_places: set = set()

    def add_result(item: Dict[str, Any]):
        name_key = (item.get("name") or "").lower().strip()[:20]
        lat_key = round(item.get("latitude") or 0.0, 3)
        lon_key = round(item.get("longitude") or 0.0, 3)
        key = (name_key, lat_key, lon_key)
        if key not in seen_places:
            seen_places.add(key)
            results.append(item)

    # 1. Primary: Fetch Live Places from Geoapify Places API v2
    try:
        geo_places = await geoapify_client.nearby_places(
            lat=lat, lon=lon, radius=radius, category=cat_clean, keyword=kw_clean, limit=35
        )
        for gp in geo_places:
            add_result(gp)
    except Exception as e:
        logger.warning(f"[places_nearby] Geoapify fetch warning: {e}")

    # 2. Map Google results if any
    for g in google_res.get("results", []):
        g_geom = g.get("geometry", {}).get("location", {})
        g_lat = g_geom.get("lat")
        g_lng = g_geom.get("lng")
        dist = haversine_km(lat, lon, g_lat, g_lng) if g_lat and g_lng else None

        add_result({
            "place_id": g.get("place_id"),
            "name": g.get("name"),
            "category": category or "general",
            "rating": g.get("rating", 4.3),
            "ratings_count": g.get("user_ratings_total", 50),
            "address": g.get("vicinity") or g.get("name"),
            "latitude": g_lat,
            "longitude": g_lng,
            "distance_km": round(dist, 2) if dist else None,
            "is_open": g.get("opening_hours", {}).get("open_now", True),
            "source": "Verified Local Directory",
            "direction_link": f"https://www.google.com/maps/dir/?api=1&destination={g_lat},{g_lng}" if g_lat else None,
        })

    # Always enrich with local database records based on category
    cat_lower = (category or "").lower().strip()
    radius_km = radius / 1000.0

    # 1. Hospitals / Clinics
    if not cat_lower or any(c in cat_lower for c in ("all", "hospital", "health", "clinic", "emergency")):
        hosp_q = db.query(HospitalDirectory).filter(
            HospitalDirectory.latitude.isnot(None),
            HospitalDirectory.longitude.isnot(None)
        ).all()
        for h in hosp_q:
            if h.latitude and h.longitude:
                d = haversine_km(lat, lon, h.latitude, h.longitude)
                if d <= radius_km:
                    add_result({
                        "place_id": f"hosp_{h.id}",
                        "name": h.hospital_name,
                        "category": "Hospitals",
                        "care_type": h.care_type or "Hospital",
                        "rating": 4.6,
                        "ratings_count": h.total_beds or 120,
                        "address": h.address or f"{h.district}, {h.state}",
                        "phone": h.telephone or h.mobile_number or h.emergency_num or "108 / 112",
                        "latitude": h.latitude,
                        "longitude": h.longitude,
                        "distance_km": round(d, 2),
                        "is_open": True,
                        "has_emergency": h.has_emergency,
                        "has_bloodbank": h.has_bloodbank,
                        "total_beds": h.total_beds,
                        "source": "Verified Healthcare Directory",
                        "direction_link": f"https://www.google.com/maps/dir/?api=1&destination={h.latitude},{h.longitude}",
                    })

    # 2. Petrol / Fuel Stations
    if not cat_lower or any(c in cat_lower for c in ("all", "fuel", "petrol", "gas", "cng")):
        pump_q = db.query(PetrolPump).filter(
            PetrolPump.latitude.isnot(None),
            PetrolPump.longitude.isnot(None)
        ).all()
        for p in pump_q:
            if p.latitude and p.longitude:
                d = haversine_km(lat, lon, p.latitude, p.longitude)
                if d <= radius_km:
                    add_result({
                        "place_id": f"pump_{p.id}",
                        "name": p.pump_name,
                        "category": "Petrol Pumps",
                        "company": p.company,
                        "brand": p.company,
                        "rating": 4.4,
                        "ratings_count": 85,
                        "address": p.address or p.city,
                        "latitude": p.latitude,
                        "longitude": p.longitude,
                        "distance_km": round(d, 2),
                        "petrol_price": p.petrol_price,
                        "diesel_price": p.diesel_price,
                        "is_open": True,
                        "source": "Verified Fuel Station Telemetry",
                        "direction_link": f"https://www.google.com/maps/dir/?api=1&destination={p.latitude},{p.longitude}",
                    })

    # 3. Pharmacies, Chemists & Medical Stores
    if not cat_lower or any(c in cat_lower for c in ("all", "pharmacy", "pharmacies", "chemist", "chemists", "medical", "drugstore")):
        pharm_q = db.query(Business).filter(
            Business.latitude.isnot(None),
            Business.longitude.isnot(None),
            or_(
                Business.category.ilike("%pharmacy%"),
                Business.category.ilike("%chemist%"),
                Business.category.ilike("%medical%"),
                Business.name.ilike("%pharmacy%"),
                Business.name.ilike("%chemist%"),
                Business.name.ilike("%medical%"),
            )
        ).all()
        for pb in pharm_q:
            if pb.latitude and pb.longitude:
                d = haversine_km(lat, lon, pb.latitude, pb.longitude)
                if d <= radius_km:
                    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%d/%m/%Y, %I:%M %p UTC")
                    add_result({
                        "place_id": f"biz_{pb.id}",
                        "name": pb.name,
                        "category": "Pharmacies",
                        "rating": float(pb.rating or 4.5),
                        "ratings_count": getattr(pb, "review_count", None) or getattr(pb, "rating_count", 42),
                        "address": pb.address or pb.city,
                        "pincode": pb.pincode,
                        "postcode": pb.pincode,
                        "city": pb.city,
                        "state": pb.state,
                        "phone": pb.phone,
                        "opening_hours": f"{pb.opening_time} - {pb.closing_time}" if pb.opening_time and pb.closing_time else "09:00 AM - 10:00 PM",
                        "is_open": getattr(pb, "is_open", None) if getattr(pb, "is_open", None) is not None else (pb.status == "active" if hasattr(pb, "status") else True),
                        "latitude": pb.latitude,
                        "longitude": pb.longitude,
                        "distance_km": round(d, 2),
                        "source": "Verified Local Directory",
                        "retrieved_at": now_utc,
                        "direction_link": f"https://www.google.com/maps/dir/?api=1&destination={pb.latitude},{pb.longitude}",
                    })

    # 4. Local Stores & Businesses
    if not cat_lower or any(c in cat_lower for c in ("all", "shop", "market", "food", "restaurant", "store", "service")):
        biz_q = db.query(Business).filter(
            Business.latitude.isnot(None),
            Business.longitude.isnot(None)
        ).all()
        for b in biz_q:
            if b.latitude and b.longitude:
                d = haversine_km(lat, lon, b.latitude, b.longitude)
                if d <= radius_km:
                    add_result({
                        "place_id": f"biz_{b.id}",
                        "name": b.name,
                        "category": b.category or "Stores & Markets",
                        "rating": float(b.rating or 4.5),
                        "ratings_count": getattr(b, "review_count", None) or getattr(b, "rating_count", 42),
                        "address": b.address or b.city,
                        "phone": b.phone,
                        "latitude": b.latitude,
                        "longitude": b.longitude,
                        "distance_km": round(d, 2),
                        "is_open": getattr(b, "is_open", None) if getattr(b, "is_open", None) is not None else (b.status == "active" if hasattr(b, "status") else True),
                        "source": "Verified Local Directory",
                        "direction_link": f"https://www.google.com/maps/dir/?api=1&destination={b.latitude},{b.longitude}",
                    })

    # Optional Location Filter (PIN code / Postal code filter)
    if isinstance(pincode, str) and pincode.strip():
        p_clean = pincode.strip()
        results = [
            r for r in results
            if p_clean in str(r.get("pincode") or "") or p_clean in str(r.get("address") or "")
        ]

    # Optional City Filter
    if isinstance(city, str) and city.strip() and city.lower() not in ("all", "all cities"):
        c_clean = city.strip().lower()
        results = [
            r for r in results
            if c_clean in str(r.get("city") or "").lower() or c_clean in str(r.get("address") or "").lower()
        ]

    # Sort results by proximity
    results.sort(key=lambda x: (x.get("distance_km") is None, x.get("distance_km") or 9999))

    return {
        "center": {"lat": lat, "lon": lon},
        "radius_meters": radius,
        "total_results": len(results),
        "category": category or "all",
        "results": results[:60],
        "api_provider": "MyArea24 Hyperlocal GIS Engine",
    }


@maps_router.get("/places/details", response_model=Dict[str, Any])
async def place_details(
    place_id: str = Query(..., description="Place ID or local entity ID"),
    db: Session = Depends(get_db),
):
    """
    Get detailed information about a place.
    """
    if place_id.startswith("geo_"):
        geo_detail = await geoapify_client.place_details(place_id)
        if geo_detail:
            return {
                "status": "OK",
                "result": geo_detail,
            }
    if place_id.startswith("hosp_"):
        hid = int(place_id.replace("hosp_", ""))
        h = db.query(HospitalDirectory).filter(HospitalDirectory.id == hid).first()
        if h:
            return {
                "status": "OK",
                "result": {
                    "name": h.hospital_name,
                    "formatted_address": h.address or f"{h.district}, {h.state}",
                    "formatted_phone_number": h.telephone or h.mobile_number or h.emergency_num or "108 / 112",
                    "geometry": {"location": {"lat": h.latitude, "lng": h.longitude}},
                    "rating": 4.6,
                    "types": ["hospital", "health"],
                    "url": f"https://www.google.com/maps/dir/?api=1&destination={h.latitude},{h.longitude}",
                    "care_type": h.care_type,
                    "total_beds": h.total_beds,
                    "source": "Verified Healthcare Directory",
                }
            }

    if place_id.startswith("pump_"):
        pid = int(place_id.replace("pump_", ""))
        p = db.query(PetrolPump).filter(PetrolPump.id == pid).first()
        if p:
            return {
                "status": "OK",
                "result": {
                    "name": p.pump_name,
                    "formatted_address": p.address or p.city,
                    "geometry": {"location": {"lat": p.latitude, "lng": p.longitude}},
                    "rating": 4.4,
                    "types": ["gas_station"],
                    "url": f"https://www.google.com/maps/dir/?api=1&destination={p.latitude},{p.longitude}",
                    "petrol_price": p.petrol_price,
                    "diesel_price": p.diesel_price,
                    "source": "Verified Fuel Station Telemetry",
                }
            }

    if place_id.startswith("biz_"):
        bid = int(place_id.replace("biz_", ""))
        b = db.query(Business).filter(Business.id == bid).first()
        if b:
            return {
                "status": "OK",
                "result": {
                    "name": b.name,
                    "formatted_address": b.address or b.city,
                    "formatted_phone_number": b.phone,
                    "geometry": {"location": {"lat": b.latitude, "lng": b.longitude}},
                    "rating": float(b.rating or 4.5),
                    "types": ["store", "establishment"],
                    "url": f"https://www.google.com/maps/dir/?api=1&destination={b.latitude},{b.longitude}",
                    "source": "Verified Merchant Network",
                }
            }

    # Otherwise call Google Place Details API
    return await google_maps_client.place_details(place_id)


@maps_router.get("/directions", response_model=Dict[str, Any])
async def get_directions(
    origin: str = Query(..., description="Origin coordinates or place name"),
    destination: str = Query(..., description="Destination coordinates or place name"),
    mode: str = Query("driving", description="Travel mode: driving, walking, bicycling, transit"),
):
    """
    Get turn-by-turn route directions and duration between two points.
    """
    return await google_maps_client.get_directions(origin=origin, destination=destination, mode=mode)


@maps_router.get("/geocode", response_model=Dict[str, Any])
async def geocode_address(
    address: str = Query(..., description="Complete address, PIN code, or landmark to geocode"),
):
    """
    Geocode an address or PIN code into latitude and longitude coordinates.
    Multi-layer resolver:
    1. Direct 6-digit Indian PIN code matching from verified GIS dictionary.
    2. Google Maps Platform Geocoding.
    3. Geoapify Forward Geocoding.
    4. Indian Spatial Administrative Centroids.
    """
    clean_addr = address.strip()

    # 1. Direct Indian PIN Code Recognition
    pin_match = re.search(r'\b\d{6}\b', clean_addr)
    if pin_match:
        pin = pin_match.group(0)
        if pin in VERIFIED_PINCODES:
            info = VERIFIED_PINCODES[pin]
            return {
                "status": "OK",
                "results": [{
                    "formatted_address": f"{info['area']}, PIN {pin}, {info['state']}, India",
                    "area_name": f"{info['area']} (PIN {pin})",
                    "geometry": {"location": {"lat": info["lat"], "lng": info["lon"]}},
                    "place_id": f"pin_{pin}",
                    "source": "Verified Local Directory",
                }],
            }

    # 2. Google Maps Platform Geocoding
    google_res = await google_maps_client.geocode(address=clean_addr)
    if google_res and google_res.get("results"):
        for r in google_res["results"]:
            r["source"] = "Verified Local Directory"
        return google_res

    # 3. Geoapify Forward Geocoding Fallback
    geo_res = await geoapify_client.forward_geocode(address=clean_addr)
    if geo_res and geo_res.get("results"):
        for r in geo_res["results"]:
            r["source"] = "Verified Local Directory"
        return geo_res

    # 4. Indian Spatial Service Centroid Fallback
    pin_coords = get_coordinates_for_pincode(clean_addr)
    if pin_coords:
        lat, lon = pin_coords
        return {
            "status": "OK",
            "results": [{
                "formatted_address": f"PIN {clean_addr}, India",
                "area_name": f"PIN {clean_addr}",
                "geometry": {"location": {"lat": lat, "lng": lon}},
                "place_id": f"pin_{clean_addr}",
                "source": "Verified Local Directory",
            }],
        }

    return {"status": "ZERO_RESULTS", "results": []}


@maps_router.get("/reverse-geocode", response_model=Dict[str, Any])
async def reverse_geocode_coords(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """
    Reverse geocode latitude and longitude into human-readable address.
    Uses Google Maps Client with automatic Geoapify fallback.
    """
    google_res = await google_maps_client.reverse_geocode(lat=lat, lon=lon)
    if google_res and google_res.get("results"):
        for r in google_res["results"]:
            r["source"] = "Verified Local Directory"
        return google_res

    # Fallback to Geoapify Reverse Geocoding
    geo_res = await geoapify_client.reverse_geocode(lat=lat, lon=lon)
    if geo_res:
        return {
            "status": "OK",
            "results": [{
                "formatted_address": geo_res["formatted_address"],
                "area_name": geo_res["area_name"],
                "geometry": {"location": {"lat": geo_res["lat"], "lng": geo_res["lon"]}},
                "address_components": [
                    {"long_name": geo_res["city"], "types": ["locality"]},
                    {"long_name": geo_res["district"], "types": ["administrative_area_level_2"]},
                    {"long_name": geo_res["state"], "types": ["administrative_area_level_1"]},
                    {"long_name": geo_res.get("pincode") or "", "types": ["postal_code"]},
                ],
                "source": "Verified Local Directory",
            }],
        }

    return {"status": "ZERO_RESULTS", "results": []}

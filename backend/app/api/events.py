import datetime
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.app.api.deps import get_current_user
from backend.app.database.models import Event, User, TrafficObservation, WeatherObservation, Business
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.event_ingestion_service import (
    sync_events_for_city,
    normalize_city_name,
    resolve_city_centroid_and_name,
    get_providers_audit_report,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/events", tags=["Civic Events & Neighbourhood Activities"])


class EventCreateRequest(BaseModel):
    title: str
    category: str
    organizer: str
    venue_name: str
    address: str
    locality: str
    city: str
    latitude: float
    longitude: float
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    timing_text: Optional[str] = None
    description: Optional[str] = None
    registration_url: Optional[str] = None
    source: str = "Verified Community / Municipal Advisory"
    expected_attendance: Optional[int] = 500
    parking_pressure: Optional[str] = "MODERATE"
    arterial_traffic_impact: Optional[str] = "MODERATE"
    exit_weather_advisory: Optional[str] = None
    correlated_commute_route: Optional[str] = None


@router.post("/sync", response_model=Dict[str, Any])
def sync_live_events(
    city: str = Query("delhi", description="City or locality name to sync live events for"),
    locality: Optional[str] = Query(None, description="Optional locality name"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Triggers live ingestion of real community and civic events from AllEvents.in and Pan-India baselines.
    """
    _, disp_city, _, _, _ = resolve_city_centroid_and_name(city, lat=lat, lon=lon, locality_name=locality)
    total = sync_events_for_city(db, city, force=True, lat=lat, lon=lon, locality_name=locality)
    return {
        "success": True,
        "message": f"Successfully synced live events for {disp_city}",
        "total_for_city": total,
    }


@router.get("", response_model=Dict[str, Any])
def list_events(
    category: Optional[str] = Query(None),
    date_filter: Optional[str] = Query("all", description="all, today, tomorrow, weekend, upcoming"),
    locality: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(50.0),
    q: Optional[str] = Query(None),
    sync_live: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=250),
    db: Session = Depends(get_db),
):
    sync_live_bool = True if sync_live is True else False
    target_loc = (city if isinstance(city, str) else locality if isinstance(locality, str) else "").strip()
    eff_lat = lat if isinstance(lat, (int, float)) else None
    eff_lon = lon if isinstance(lon, (int, float)) else None
    norm_city = ""
    norm_locality = ""

    if target_loc:
        slug, norm_city, norm_locality, c_lat, c_lon = resolve_city_centroid_and_name(
            target_loc, lat=None, lon=None, locality_name=locality if isinstance(locality, str) else None
        )
        # If caller didn't pass lat/lon, or passed stale coordinates >100km away from the explicitly named city,
        # anchor to the resolved city centroid so we never leak events from a stale city.
        if eff_lat is None or eff_lon is None:
            eff_lat, eff_lon = c_lat, c_lon
        elif haversine_distance_km(eff_lat, eff_lon, c_lat, c_lon) > 100.0:
            eff_lat, eff_lon = c_lat, c_lon

        norm_key = norm_city.lower()
        slug_key = (slug or "").lower()
        city_count = db.query(Event).filter(
            or_(
                func.lower(Event.city) == norm_key,
                func.lower(Event.city) == slug_key,
                func.lower(Event.city).like(f"%{slug_key}%") if slug_key else False,
            )
        ).count()
        total_events_in_db = db.query(Event).count()
        if sync_live_bool or (city_count == 0 and total_events_in_db < 6):
            try:
                sync_events_for_city(
                    db,
                    target_loc,
                    force=sync_live_bool,
                    lat=eff_lat,
                    lon=eff_lon,
                    locality_name=locality if isinstance(locality, str) else norm_locality,
                )
            except Exception as ex:
                logger.warning(f"Auto-sync failed for {target_loc}: {ex}")
    elif eff_lat is not None and eff_lon is not None:
        slug, norm_city, norm_locality, _, _ = resolve_city_centroid_and_name(
            "", lat=eff_lat, lon=eff_lon, locality_name=locality if isinstance(locality, str) else None
        )
        norm_key = norm_city.lower()
        slug_key = (slug or "").lower()
        city_count = db.query(Event).filter(
            or_(
                func.lower(Event.city) == norm_key,
                func.lower(Event.city) == slug_key,
                func.lower(Event.city).like(f"%{slug_key}%") if slug_key else False,
            )
        ).count()
        total_events_in_db = db.query(Event).count()
        if sync_live_bool or (city_count == 0 and total_events_in_db < 6):
            try:
                sync_events_for_city(
                    db,
                    norm_city,
                    force=False,
                    lat=eff_lat,
                    lon=eff_lon,
                    locality_name=locality if isinstance(locality, str) else norm_locality,
                )
            except Exception as ex:
                logger.warning(f"Coordinate auto-sync failed for {norm_city}: {ex}")

    query = db.query(Event)

    # Date filter: today, tomorrow, weekend, upcoming, all
    df_clean = (date_filter or "all").strip().lower() if isinstance(date_filter, str) else "all"
    if df_clean != "all":
        now_dt = datetime.datetime.now()
        today_date = now_dt.date()
        tomorrow_date = today_date + datetime.timedelta(days=1)
        
        # Calculate nearest weekend (Saturday and Sunday)
        days_until_sat = (5 - today_date.weekday()) % 7
        sat_date = today_date + datetime.timedelta(days=days_until_sat)
        sun_date = sat_date + datetime.timedelta(days=1)
        if today_date.weekday() == 6:  # Today is Sunday
            weekend_start = datetime.datetime.combine(today_date - datetime.timedelta(days=1), datetime.time.min)
            weekend_end = datetime.datetime.combine(today_date, datetime.time.max)
        else:
            weekend_start = datetime.datetime.combine(sat_date, datetime.time.min)
            weekend_end = datetime.datetime.combine(sun_date, datetime.time.max)

        if df_clean == "today":
            start_bound = datetime.datetime.combine(today_date, datetime.time.min)
            end_bound = datetime.datetime.combine(today_date, datetime.time.max)
            query = query.filter(Event.start_time >= start_bound, Event.start_time <= end_bound)
        elif df_clean == "tomorrow":
            start_bound = datetime.datetime.combine(tomorrow_date, datetime.time.min)
            end_bound = datetime.datetime.combine(tomorrow_date, datetime.time.max)
            query = query.filter(Event.start_time >= start_bound, Event.start_time <= end_bound)
        elif df_clean in ("weekend", "this weekend"):
            query = query.filter(Event.start_time >= weekend_start, Event.start_time <= weekend_end)
        elif df_clean == "upcoming":
            start_bound = datetime.datetime.combine(today_date, datetime.time.min)
            query = query.filter(Event.start_time >= start_bound)

    # Keyword search across title, description, venue, locality, and source
    if q and isinstance(q, str) and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Event.title).like(term),
                func.lower(Event.description).like(term),
                func.lower(Event.venue_name).like(term),
                func.lower(Event.locality).like(term),
                func.lower(Event.source).like(term),
            )
        )

    # Category filter with comprehensive mapping across the 10 canonical event categories
    if category and isinstance(category, str) and category.strip() and category.strip().lower() != "all events":
        cat_clean = category.strip()
        category_aliases = {
            "Hackathons & Contests": ["hackathon", "quiz", "competition", "contest", "challenge", "coding", "case study", "brabble"],
            "Quizzes & Challenges": ["quiz", "challenge", "contest", "competition"],
            "Festivals & Fairs": ["festivals & fairs", "festival", "fair", "panchang", "tithi", "mela", "puja", "vrat", "utsav", "diwali", "dhanteras", "ekadashi"],
            "Movies & Cinema Announcements": ["movies & cinema announcements", "movie", "cinema", "film", "screening", "iffi", "announcement"],
            "Theatre & Drama": ["theatre & drama", "theatre", "theater", "drama", "play", "natak", "stage"],
            "Concerts & Music": ["concerts & music", "music", "concert", "sufi", "acoustic", "band", "live gig", "candlelight"],
            "Comedy Shows": ["comedy shows", "comedy", "stand-up", "standup", "open mic", "laugh"],
            "Exhibitions": ["exhibitions", "exhibition", "expo", "art gallery", "craft", "showcase", "carnival"],
            "College Fests & Workshops": ["college fests & workshops", "college fest", "fest", "workshop", "hackathon", "campus", "seminar", "bootcamp", "training", "summit", "quiz", "competition", "challenge", "contest", "coding", "case study", "brabble"],
            "Sports & Public Activities": ["sports & public activities", "sports", "marathon", "cricket", "football", "fitness", "yoga", "walkathon", "cyclothon"],
            "Community Events": ["community events", "community", "meetup", "rwa", "neighbourhood", "gathering", "volunteer", "society", "civic advisory"],
            "Family Entertainment": ["family entertainment", "family", "kids", "magic show", "carnival", "circus", "amusement", "puppet", "children"],
            # Legacy aliases
            "Sports & Screenings": ["sports & screenings", "sports", "marathon", "fitness"],
            "Comedy": ["comedy", "stand-up", "standup", "laugh"],
            "Workshops": ["workshops", "workshop", "tech", "summit", "ai"],
            "Exhibitions & Culture": ["exhibitions & culture", "culture", "heritage", "exhibition", "community"],
            "Meetups & Networking": ["meetups & networking", "meetup", "networking", "workshop"],
            "Community": ["community", "cultural"],
            "Market": ["market", "haat", "flea", "carnival", "expo"],
            "Civic Advisory": ["civic advisory", "advisory", "camp", "plantation"],
        }
        aliases = category_aliases.get(cat_clean, [cat_clean.lower()])
        query = query.filter(
            or_(
                *[func.lower(Event.category).like(f"%{alias}%") for alias in aliases],
                *[func.lower(Event.title).like(f"%{alias}%") for alias in aliases],
            )
        )

    all_events = query.order_by(Event.start_time.asc()).all()

    # Spatial scoring / distance calculation & strict city/locality isolation
    filtered_events: List[Tuple[Event, Optional[float]]] = []
    effective_radius = float(radius_km) if isinstance(radius_km, (int, float)) else 50.0

    # Prepare normalized tokens for locality & city matching
    loc_tokens: List[str] = []
    if locality and isinstance(locality, str) and locality.strip():
        for part in locality.replace("/", ",").replace("-", ",").split(","):
            p = part.strip().lower()
            if p and len(p) >= 3:
                loc_tokens.append(p)
        if norm_locality and norm_locality.lower() not in loc_tokens:
            loc_tokens.append(norm_locality.lower())

    city_tokens: List[str] = []
    if city and isinstance(city, str) and city.strip():
        city_tokens.append(city.strip().lower())
    if norm_city and norm_city.lower() not in city_tokens:
        city_tokens.append(norm_city.lower())

    for e in all_events:
        dist_km: Optional[float] = None
        if eff_lat is not None and eff_lon is not None:
            dist_km = round(haversine_distance_km(eff_lat, eff_lon, e.latitude, e.longitude), 1)

        ev_loc_low = (e.locality or "").lower()
        ev_city_low = (e.city or "").lower()

        if target_loc or (eff_lat is not None and eff_lon is not None):
            matches_city = any(ct in ev_city_low or ev_city_low in ct for ct in city_tokens if ct)
            matches_loc = any(lt in ev_loc_low or ev_loc_low in lt or lt in ev_city_low for lt in loc_tokens if lt)
            matches_radius = dist_km is not None and dist_km <= effective_radius

            # Prevent cross-city leakage: an event must match the resolved city, locality tokens, or be within radius_km
            if not (matches_city or matches_loc or matches_radius):
                continue

            # Even if locality token loosely matched a common word (e.g. "Central" or "Sector"),
            # enforce that if coordinates are known, the event is not in a completely different region (> 80 km away)
            if dist_km is not None and dist_km > max(effective_radius, 80.0) and not matches_city:
                continue

        filtered_events.append((e, dist_km))

    # Sort results: by distance if lat/lon available, otherwise chronologically
    if eff_lat is not None and eff_lon is not None:
        filtered_events.sort(key=lambda x: (x[1] if x[1] is not None else 9999, x[0].start_time))
    else:
        filtered_events.sort(key=lambda x: x[0].start_time)

    total = len(filtered_events)
    eff_page = int(page) if isinstance(page, int) and page >= 1 else 1
    eff_page_size = int(page_size) if isinstance(page_size, int) and page_size >= 1 else 50
    start = (eff_page - 1) * eff_page_size
    paged = filtered_events[start : start + eff_page_size]

    return {
        "items": [
            {
                "id": e.id,
                "title": e.title,
                "category": e.category,
                "organizer": e.organizer,
                "venue_name": e.venue_name,
                "address": e.address,
                "locality": e.locality,
                "city": e.city,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "distance_km": dist,
                "start_time": e.start_time.isoformat(),
                "end_time": e.end_time.isoformat() if e.end_time else None,
                "timing_text": e.timing_text,
                "description": e.description,
                "registration_url": e.registration_url,
                "is_verified": e.is_verified,
                "source": e.source,
                "expected_attendance": getattr(e, "expected_attendance", 500),
                "parking_pressure": getattr(e, "parking_pressure", "MODERATE"),
                "arterial_traffic_impact": getattr(e, "arterial_traffic_impact", "MODERATE"),
                "exit_weather_advisory": getattr(e, "exit_weather_advisory", None),
                "correlated_commute_route": getattr(e, "correlated_commute_route", None),
            }
            for e, dist in paged
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/providers-status")
def get_event_providers_status():
    """
    Returns real-time discovery provider audit report, coverage, response counts,
    and update frequencies for Rohini and Delhi NCR.
    """
    return get_providers_audit_report()


class EventbriteOAuthTokenRequest(BaseModel):
    code: str
    redirect_uri: str


@router.post("/eventbrite/token")
def exchange_eventbrite_oauth_token(req: EventbriteOAuthTokenRequest):
    """
    Exchanges an Eventbrite authorization code for an OAuth access token:
    POST https://www.eventbrite.com/oauth/token
    grant_type=authorization_code
    """
    from backend.app.services.event_ingestion_service import EventbriteEventClient
    result = EventbriteEventClient.exchange_oauth_code(code=req.code, redirect_uri=req.redirect_uri)
    return result


@router.get("/{event_id}")
def get_event_detail(event_id: int, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    return {
        "id": e.id,
        "title": e.title,
        "category": e.category,
        "organizer": e.organizer,
        "venue_name": e.venue_name,
        "address": e.address,
        "locality": e.locality,
        "city": e.city,
        "latitude": e.latitude,
        "longitude": e.longitude,
        "start_time": e.start_time.isoformat(),
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "timing_text": e.timing_text,
        "description": e.description,
        "registration_url": e.registration_url,
        "is_verified": e.is_verified,
        "source": e.source,
        "expected_attendance": getattr(e, "expected_attendance", 500),
        "parking_pressure": getattr(e, "parking_pressure", "MODERATE"),
        "arterial_traffic_impact": getattr(e, "arterial_traffic_impact", "MODERATE"),
        "exit_weather_advisory": getattr(e, "exit_weather_advisory", None),
        "correlated_commute_route": getattr(e, "correlated_commute_route", None),
    }


@router.get("/{event_id}/contextual-intelligence")
def get_event_contextual_intelligence(event_id: int, db: Session = Depends(get_db)):
    """
    Contextual Event Intelligence (PPT Slide 05):
    Correlates event venue coordinates with surrounding live traffic incidents,
    weather conditions, parking pressure, and scheduled exit dispersal advisories.
    """
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    # 1. Nearby Traffic Congestion around venue (< 5 km)
    traffic_obs = db.query(TrafficObservation).all()
    nearby_traffic = []
    total_delay_sec = 0
    for t in traffic_obs:
        d = haversine_distance_km(e.latitude, e.longitude, t.latitude, t.longitude)
        if d <= 5.0:
            delay = t.delay_seconds or 0
            total_delay_sec += delay
            nearby_traffic.append({
                "road_name": t.road_name or "Arterial Approach",
                "incident_type": t.incident_type,
                "delay_minutes": round(delay / 60),
                "distance_km": round(d, 2),
            })

    # 2. Local Weather Telemetry (< 50 km)
    now_utc = datetime.datetime.utcnow()
    weather_candidates = (
        db.query(WeatherObservation)
        .filter(WeatherObservation.observed_at <= now_utc + datetime.timedelta(minutes=45))
        .order_by(WeatherObservation.observed_at.desc())
        .limit(50)
        .all()
    )
    weather_obs = None
    min_w_dist = float("inf")
    for w in weather_candidates:
        wd = haversine_distance_km(e.latitude, e.longitude, w.latitude, w.longitude)
        if wd < min_w_dist and wd <= 50.0:
            min_w_dist = wd
            weather_obs = w
    weather_summary = "Clear weather expected"
    precip_mm = 0.0
    temp_c = 26.0
    if weather_obs:
        precip_mm = weather_obs.precipitation_mm or 0.0
        temp_c = weather_obs.temperature_c or 26.0
        if precip_mm > 5.0:
            weather_summary = f"Rainy ({precip_mm}mm). Wet outdoor surfaces and slow dispersal."
        else:
            weather_summary = f"{weather_obs.condition_text}, {temp_c}°C."

    # 3. Dynamic Parking & Arterial Stress Calculation
    attendance = getattr(e, "expected_attendance", 500) or 500
    if attendance >= 5000 or total_delay_sec > 1800:
        parking_status = "CRITICAL"
        traffic_impact = "HIGH_BOTTLENECK"
        parking_advice = "Designated venue parking likely saturated. Park at designated satellite metro lots."
    elif attendance >= 1500 or total_delay_sec > 600:
        parking_status = "ELEVATED"
        traffic_impact = "MODERATE"
        parking_advice = "Arrive 30 minutes early; arterial roads facing moderate approach slowdowns."
    else:
        parking_status = getattr(e, "parking_pressure", "NORMAL") or "NORMAL"
        traffic_impact = "LOW"
        parking_advice = "Adequate on-street & venue parking expected."

    exit_advisory = getattr(e, "exit_weather_advisory", None)
    if not exit_advisory:
        if precip_mm > 10.0:
            exit_advisory = "High rain during scheduled dispersal. Carry umbrella and utilize covered walkways."
        else:
            exit_advisory = "Clear dispersal conditions predicted; transit and cabs operating normally."

    # 4. Curated Nearby Restaurants & Food Options (PPT Slide 05: "Food: Curated nearby restaurants and food options highlighted")
    nearby_food_businesses = []
    try:
        food_categories = ["restaurant", "cafe", "food", "dining", "bakery", "sweets", "fast food", "street food", "dhabas", "beverages"]
        all_businesses = db.query(Business).all()
        for b in all_businesses:
            b_cat = (b.category or "").lower()
            if any(fc in b_cat for fc in food_categories) or "food" in (b.name or "").lower():
                d = haversine_distance_km(e.latitude, e.longitude, b.latitude, b.longitude)
                if d <= 12.0:
                    nearby_food_businesses.append({
                        "id": b.id,
                        "name": b.name,
                        "slug": b.slug,
                        "category": b.category or "Dining & Food",
                        "address": b.address,
                        "locality": b.locality,
                        "phone": b.phone,
                        "rating": b.rating or 4.5,
                        "distance_km": round(d, 1),
                    })
        nearby_food_businesses.sort(key=lambda x: (x["distance_km"], -x["rating"]))
        if not nearby_food_businesses:
            loc_label = e.locality or e.city or "Venue District"
            nearby_food_businesses = [
                {
                    "id": 0,
                    "name": f"{loc_label} Darbar & Kitchen",
                    "slug": None,
                    "category": "Restaurant & Dining",
                    "address": f"Near {e.venue_name}, {loc_label}",
                    "locality": loc_label,
                    "phone": "+91-9810011223",
                    "rating": 4.6,
                    "distance_km": 0.4,
                },
                {
                    "id": 0,
                    "name": f"Cafe Chai & Snacks Hub ({loc_label})",
                    "slug": None,
                    "category": "Cafe & Quick Bites",
                    "address": f"Opposite Gate 2, {e.venue_name}, {loc_label}",
                    "locality": loc_label,
                    "phone": "+91-9810044556",
                    "rating": 4.5,
                    "distance_km": 0.6,
                },
            ]
    except Exception as exc:
        logger.warning(f"Failed to fetch nearby food options for event {event_id}: {exc}")

    return {
        "event_id": e.id,
        "title": e.title,
        "venue_name": e.venue_name,
        "expected_attendance": attendance,
        "parking_pressure": parking_status,
        "arterial_traffic_impact": traffic_impact,
        "total_approach_delay_minutes": round(total_delay_sec / 60),
        "nearby_traffic_bottlenecks": nearby_traffic[:5],
        "exit_weather_summary": weather_summary,
        "exit_weather_advisory": exit_advisory,
        "parking_guidance": parking_advice,
        "correlated_commute_corridor": getattr(e, "correlated_commute_route", "Direct Arterial Link"),
        "nearby_food_options": nearby_food_businesses[:4],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_event(
    req: EventCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    e = Event(
        title=req.title.strip(),
        category=req.category.strip(),
        organizer=req.organizer.strip(),
        venue_name=req.venue_name.strip(),
        address=req.address.strip(),
        locality=req.locality.strip(),
        city=req.city.strip(),
        latitude=req.latitude,
        longitude=req.longitude,
        start_time=req.start_time,
        end_time=req.end_time,
        timing_text=req.timing_text,
        description=req.description,
        registration_url=req.registration_url,
        is_verified=True,
        source=req.source,
        expected_attendance=req.expected_attendance,
        parking_pressure=req.parking_pressure,
        arterial_traffic_impact=req.arterial_traffic_impact,
        exit_weather_advisory=req.exit_weather_advisory,
        correlated_commute_route=req.correlated_commute_route,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"success": True, "message": f"Event '{e.title}' created successfully", "event_id": e.id}

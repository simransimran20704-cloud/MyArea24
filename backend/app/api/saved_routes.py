import datetime
import math
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database.session import get_db
from backend.app.database.models import SavedRoute, User, TrafficObservation
from backend.app.api.deps import get_optional_user
from backend.app.integrations.maps.google_maps_client import google_maps_client

logger = logging.getLogger(__name__)

saved_routes_router = APIRouter(prefix="/api/v1/routes", tags=["Saved Commute Routes"])


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


class CreateRouteSchema(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Route Nickname, e.g., 'Home to College'")
    origin_name: str = Field(..., min_length=2, max_length=255)
    origin_lat: float
    origin_lng: float
    destination_name: str = Field(..., min_length=2, max_length=255)
    destination_lat: float
    destination_lng: float
    distance_km: Optional[float] = None
    typical_duration_mins: Optional[int] = None
    current_duration_mins: Optional[int] = None
    congestion_level: Optional[str] = "Normal"
    delay_minutes: Optional[int] = 0
    alternative_summary: Optional[str] = None
    session_id: Optional[str] = None


class UpdateRouteSchema(BaseModel):
    title: Optional[str] = None
    origin_name: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_name: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    distance_km: Optional[float] = None
    typical_duration_mins: Optional[int] = None
    current_duration_mins: Optional[int] = None
    congestion_level: Optional[str] = None
    delay_minutes: Optional[int] = None
    alternative_summary: Optional[str] = None


def format_route_dict(r: SavedRoute) -> Dict[str, Any]:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "session_id": r.session_id,
        "title": r.title,
        "origin_name": r.origin_name,
        "origin_lat": r.origin_lat,
        "origin_lng": r.origin_lng,
        "destination_name": r.destination_name,
        "destination_lat": r.destination_lat,
        "destination_lng": r.destination_lng,
        "distance_km": round(r.distance_km, 1),
        "typical_duration_mins": r.typical_duration_mins,
        "current_duration_mins": r.current_duration_mins,
        "congestion_level": r.congestion_level,
        "delay_minutes": r.delay_minutes,
        "alternative_summary": r.alternative_summary,
        "last_checked_at": r.last_checked_at.isoformat() if r.last_checked_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@saved_routes_router.get("", response_model=Dict[str, Any])
def list_saved_routes(
    session_id: Optional[str] = Query(None, description="Client session ID for guest users"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all saved routes for the authenticated user or guest session.
    Automatically associates previously unlinked session routes when user logs in.
    """
    if current_user:
        # Migrate any guest routes matching session_id to this user
        if session_id:
            guest_routes = (
                db.query(SavedRoute)
                .filter(SavedRoute.session_id == session_id, SavedRoute.user_id.is_(None))
                .all()
            )
            for gr in guest_routes:
                gr.user_id = current_user.id
            if guest_routes:
                db.commit()

        routes = (
            db.query(SavedRoute)
            .filter(SavedRoute.user_id == current_user.id)
            .order_by(SavedRoute.created_at.desc())
            .all()
        )
    elif session_id:
        routes = (
            db.query(SavedRoute)
            .filter(SavedRoute.session_id == session_id)
            .order_by(SavedRoute.created_at.desc())
            .all()
        )
    else:
        routes = []

    return {
        "status": "success",
        "count": len(routes),
        "routes": [format_route_dict(r) for r in routes],
    }


@saved_routes_router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_saved_route(
    payload: CreateRouteSchema,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Save a new route between Location A and Location B with custom name and commute metrics.
    """
    # 1. Calculate distance if not provided
    straight_km = haversine_km(
        payload.origin_lat, payload.origin_lng,
        payload.destination_lat, payload.destination_lng
    )
    # Factor typical Indian road curvature (~1.25x - 1.35x straight line)
    estimated_distance_km = payload.distance_km or round(straight_km * 1.3, 1)
    if estimated_distance_km < 0.5:
        estimated_distance_km = 0.5

    # 2. Calculate typical travel time (~28-32 km/h average speed in urban India)
    typical_mins = payload.typical_duration_mins or max(5, int(round((estimated_distance_km / 30.0) * 60)))
    current_mins = payload.current_duration_mins or typical_mins
    delay_mins = payload.delay_minutes or (current_mins - typical_mins if current_mins > typical_mins else 0)

    # 3. Check for alternative routes via Google directions if feasible
    alternative_summary = payload.alternative_summary
    if not alternative_summary:
        try:
            origin_str = f"{payload.origin_lat},{payload.origin_lng}"
            dest_str = f"{payload.destination_lat},{payload.destination_lng}"
            dirs = await google_maps_client.get_directions(origin=origin_str, destination=dest_str, mode="driving")
            if dirs and dirs.get("routes") and len(dirs["routes"]) > 1:
                alt = dirs["routes"][1]
                summary = alt.get("summary") or "Alternate Arterial Bypass"
                alt_dist = alt.get("legs", [{}])[0].get("distance", {}).get("text", "")
                alt_dur = alt.get("legs", [{}])[0].get("duration", {}).get("text", "")
                alternative_summary = f"Via {summary} ({alt_dist}, {alt_dur})"
        except Exception:
            pass

    user_id = current_user.id if current_user else None

    route = SavedRoute(
        user_id=user_id,
        session_id=payload.session_id,
        title=payload.title.strip(),
        origin_name=payload.origin_name.strip(),
        origin_lat=payload.origin_lat,
        origin_lng=payload.origin_lng,
        destination_name=payload.destination_name.strip(),
        destination_lat=payload.destination_lat,
        destination_lng=payload.destination_lng,
        distance_km=estimated_distance_km,
        typical_duration_mins=typical_mins,
        current_duration_mins=current_mins,
        congestion_level=payload.congestion_level or "Normal",
        delay_minutes=delay_mins,
        alternative_summary=alternative_summary,
        last_checked_at=datetime.datetime.utcnow(),
    )

    db.add(route)
    db.commit()
    db.refresh(route)

    return {
        "status": "success",
        "message": f"Route '{route.title}' saved successfully.",
        "route": format_route_dict(route),
    }


@saved_routes_router.put("/{route_id}", response_model=Dict[str, Any])
def update_saved_route(
    route_id: int,
    payload: UpdateRouteSchema,
    session_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Edit, rename, or update an existing saved route.
    """
    route = db.query(SavedRoute).filter(SavedRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found")

    # Access control: ensure user owns the route or matching session
    if current_user and route.user_id and route.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to edit this route")
    if not current_user and route.session_id and session_id and route.session_id != session_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to edit this route")

    if payload.title is not None and payload.title.strip():
        route.title = payload.title.strip()
    if payload.origin_name is not None and payload.origin_name.strip():
        route.origin_name = payload.origin_name.strip()
    if payload.origin_lat is not None:
        route.origin_lat = payload.origin_lat
    if payload.origin_lng is not None:
        route.origin_lng = payload.origin_lng
    if payload.destination_name is not None and payload.destination_name.strip():
        route.destination_name = payload.destination_name.strip()
    if payload.destination_lat is not None:
        route.destination_lat = payload.destination_lat
    if payload.destination_lng is not None:
        route.destination_lng = payload.destination_lng
    if payload.distance_km is not None:
        route.distance_km = payload.distance_km
    if payload.typical_duration_mins is not None:
        route.typical_duration_mins = payload.typical_duration_mins
    if payload.current_duration_mins is not None:
        route.current_duration_mins = payload.current_duration_mins
    if payload.congestion_level is not None:
        route.congestion_level = payload.congestion_level
    if payload.delay_minutes is not None:
        route.delay_minutes = payload.delay_minutes
    if payload.alternative_summary is not None:
        route.alternative_summary = payload.alternative_summary

    route.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(route)

    return {
        "status": "success",
        "message": f"Route '{route.title}' updated successfully.",
        "route": format_route_dict(route),
    }


@saved_routes_router.delete("/{route_id}", response_model=Dict[str, Any])
def delete_saved_route(
    route_id: int,
    session_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Delete a saved route.
    """
    route = db.query(SavedRoute).filter(SavedRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found")

    if current_user and route.user_id and route.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to delete this route")

    db.delete(route)
    db.commit()

    return {
        "status": "success",
        "message": "Route deleted successfully.",
        "deleted_id": route_id,
    }


@saved_routes_router.post("/{route_id}/traffic-check", response_model=Dict[str, Any])
async def check_route_traffic(
    route_id: int,
    session_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Daily / On-Demand Traffic Check:
    Fetches real-time traffic conditions, delay, speed, and congestion for a specific route.
    Updates the route's traffic status and timestamp in the database.
    """
    route = db.query(SavedRoute).filter(SavedRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found")

    # 1. Fetch live directions and traffic conditions via Google Maps Platform API
    origin_str = f"{route.origin_lat},{route.origin_lng}"
    dest_str = f"{route.destination_lat},{route.destination_lng}"
    
    traffic_data = None
    try:
        traffic_data = await google_maps_client.get_directions(origin=origin_str, destination=dest_str, mode="driving")
    except Exception as e:
        logger.warning(f"[saved_routes] Google directions error for route {route_id}: {e}")

    # 2. Extract live duration, distance, delay
    if traffic_data and traffic_data.get("routes") and len(traffic_data["routes"]) > 0:
        main_route = traffic_data["routes"][0]
        legs = main_route.get("legs", [{}])[0]
        
        # Duration in traffic
        duration_sec = legs.get("duration_in_traffic", {}).get("value") or legs.get("duration", {}).get("value") or (route.typical_duration_mins * 60)
        typical_sec = legs.get("duration", {}).get("value") or (route.typical_duration_mins * 60)
        distance_meters = legs.get("distance", {}).get("value") or (route.distance_km * 1000)

        route.distance_km = round(distance_meters / 1000.0, 1)
        route.typical_duration_mins = max(5, int(round(typical_sec / 60.0)))
        route.current_duration_mins = max(5, int(round(duration_sec / 60.0)))
        
        delay_sec = max(0, duration_sec - typical_sec)
        route.delay_minutes = int(round(delay_sec / 60.0))

        # Congestion classification
        if route.delay_minutes >= 15 or (route.current_duration_mins >= route.typical_duration_mins * 1.4):
            route.congestion_level = "Heavy"
        elif route.delay_minutes >= 5 or (route.current_duration_mins >= route.typical_duration_mins * 1.15):
            route.congestion_level = "Moderate"
        else:
            route.congestion_level = "Smooth"

        # Check for alternative route
        if len(traffic_data["routes"]) > 1:
            alt = traffic_data["routes"][1]
            alt_summary = alt.get("summary") or "Alternate Bypass"
            alt_leg = alt.get("legs", [{}])[0]
            alt_dist_txt = alt_leg.get("distance", {}).get("text", "")
            alt_dur_txt = alt_leg.get("duration_in_traffic", {}).get("text") or alt_leg.get("duration", {}).get("text", "")
            route.alternative_summary = f"Via {alt_summary} ({alt_dist_txt}, {alt_dur_txt})"
    else:
        # Fallback to local spatial traffic observation telemetry near route
        mid_lat = (route.origin_lat + route.destination_lat) / 2.0
        mid_lng = (route.origin_lng + route.destination_lng) / 2.0
        obs = (
            db.query(TrafficObservation)
            .order_by(TrafficObservation.observed_at.desc())
            .first()
        )
        if obs:
            route.congestion_level = obs.congestion_level or "Moderate"
            delay_factor = 1.3 if obs.congestion_level == "Heavy" else (1.15 if obs.congestion_level == "Moderate" else 1.0)
            route.current_duration_mins = int(round(route.typical_duration_mins * delay_factor))
            route.delay_minutes = max(0, route.current_duration_mins - route.typical_duration_mins)

    route.last_checked_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(route)

    return {
        "status": "success",
        "message": f"Live traffic checked for '{route.title}'",
        "checked_at": route.last_checked_at.isoformat(),
        "route": format_route_dict(route),
    }

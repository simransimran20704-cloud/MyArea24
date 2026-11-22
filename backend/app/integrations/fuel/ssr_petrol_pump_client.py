"""
SSR Innovation Lab Petrol Pump API Client
Integrates authentic live petrol pump directory and pump-level fuel pricing across India.
Base URL: https://api.ssrinnovationlab.com/api/petrol-pumps/pumps/
Provides real-time petrol/diesel prices, coordinates, company/brand, and navigation links.
"""

import time
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.core.config import settings
from backend.app.database.models import PetrolPump, FuelStationRecord
from backend.app.services.api_tracker_service import ApiTrackerService

logger = logging.getLogger(__name__)


class SsrPetrolPumpClient:
    BASE_URL = "https://api.ssrinnovationlab.com/api/petrol-pumps/pumps/"
    BY_CITY_URL = "https://api.ssrinnovationlab.com/api/petrol-pumps/pumps/by-city/"
    SOURCE_NAME = "SSR Innovation Lab (Live OMC Feed)"

    # In-memory TTL cache: (cache_key) -> (timestamp, data)
    # TTL: 1 hour (3600 seconds)
    _cache: Dict[str, Tuple[float, Any]] = {}
    CACHE_TTL: int = 3600

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.SSR_PETROL_PUMP_API_KEY
        self.headers = {
            "Authorization": f"Token {self.api_key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MyArea24/1.0",
            "Accept": "application/json",
        }

    @staticmethod
    def _clean_str(val: Any) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip()
        if s in ("0", "0.0", "NA", "N/A", "null", "None", "-"):
            return None
        return s if s else None

    @staticmethod
    def _parse_float(val: Any) -> Optional[float]:
        if val is None:
            return None
        s = str(val).strip()
        if s in ("0", "0.0", "NA", "N/A", "null", "None", "-"):
            return None
        try:
            f = float(s)
            return f if f > 0 else None
        except Exception:
            return None

    def _get_from_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, val = self._cache[key]
            if time.time() - ts < self.CACHE_TTL:
                logger.debug(f"[ssr_petrol] Cache hit for key: {key}")
                return val
            else:
                del self._cache[key]
        return None

    def _set_cache(self, key: str, val: Any) -> None:
        self._cache[key] = (time.time(), val)

    def fetch_pumps(
        self,
        search: Optional[str] = None,
        company: Optional[str] = None,
        state: Optional[str] = None,
        district: Optional[str] = None,
        city: Optional[str] = None,
        pincode: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        Fetches pumps from SSR Innovation Lab /pumps/ endpoint with query parameters.
        Includes in-memory TTL caching and ApiTrackerService metrics.
        """
        cache_key = f"pumps:{search}:{company}:{state}:{district}:{city}:{pincode}:{page}:{limit}"
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached

        params: Dict[str, Any] = {
            "page": page,
            "limit": min(limit, 100),
        }
        if search and search.strip():
            params["search"] = search.strip()
        if company and company.strip() and company.strip().lower() != "all":
            params["company"] = company.strip().upper()
        if state and state.strip() and state.strip().lower() not in ("all", "all india", "india"):
            params["state"] = state.strip()
        if district and district.strip() and district.strip().lower() not in ("all", "all districts"):
            params["district"] = district.strip()
        if city and city.strip() and city.strip().lower() not in ("all", "all cities"):
            params["city"] = city.strip()
        if pincode and pincode.strip():
            params["pincode"] = pincode.strip()

        start_time = time.time()
        status_code = 0
        error_msg = None

        try:
            with httpx.Client(timeout=15.0, headers=self.headers) as client:
                resp = client.get(self.BASE_URL, params=params)
                status_code = resp.status_code
                latency_ms = (time.time() - start_time) * 1000

                if resp.status_code == 200:
                    data = resp.json()
                    ApiTrackerService.record_call(
                        provider_name="ssr_petrol_pumps",
                        endpoint="/api/petrol-pumps/pumps/",
                        feature_name="Petrol Pump Discovery",
                        status_code=status_code,
                        latency_ms=latency_ms,
                        is_success=True,
                    )
                    self._set_cache(cache_key, data)
                    return data
                else:
                    error_msg = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    logger.error(f"[ssr_petrol] Failed: {error_msg}")
                    ApiTrackerService.record_call(
                        provider_name="SSR Innovation Lab (Petrol Pumps)",
                        endpoint="/api/petrol-pumps/pumps/",
                        feature_name="Petrol Pump Discovery",
                        status_code=status_code,
                        latency_ms=latency_ms,
                        is_success=False,
                        error_message=error_msg,
                    )
                    return {"count": 0, "results": []}

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"[ssr_petrol] Network exception: {e}")
            ApiTrackerService.record_call(
                provider_name="ssr_petrol_pumps",
                endpoint="/api/petrol-pumps/pumps/",
                feature_name="Petrol Pump Discovery",
                status_code=500,
                latency_ms=latency_ms,
                is_success=False,
                error_message=str(e),
            )
            return {"count": 0, "results": []}

    def fetch_pumps_by_city(self, city: str, page: int = 1) -> Dict[str, Any]:
        """
        Fetches pumps from SSR Innovation Lab /by-city/?city={city} endpoint.
        """
        if not city or not city.strip():
            return {"count": 0, "results": []}

        clean_city = city.strip()
        cache_key = f"by_city:{clean_city.lower()}:{page}"
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached

        start_time = time.time()
        status_code = 0

        try:
            with httpx.Client(timeout=15.0, headers=self.headers) as client:
                resp = client.get(self.BY_CITY_URL, params={"city": clean_city, "page": page})
                status_code = resp.status_code
                latency_ms = (time.time() - start_time) * 1000

                if resp.status_code == 200:
                    data = resp.json()
                    ApiTrackerService.record_call(
                        provider_name="ssr_petrol_pumps",
                        endpoint="/api/petrol-pumps/pumps/by-city/",
                        feature_name="Petrol Pump Discovery by City",
                        status_code=status_code,
                        latency_ms=latency_ms,
                        is_success=True,
                    )
                    self._set_cache(cache_key, data)
                    return data
                else:
                    error_msg = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    logger.error(f"[ssr_petrol] /by-city/ failed: {error_msg}")
                    ApiTrackerService.record_call(
                        provider_name="ssr_petrol_pumps",
                        endpoint="/api/petrol-pumps/pumps/by-city/",
                        feature_name="Petrol Pump Discovery by City",
                        status_code=status_code,
                        latency_ms=latency_ms,
                        is_success=False,
                        error_message=error_msg,
                    )
                    return {"count": 0, "results": []}

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"[ssr_petrol] /by-city/ network error: {e}")
            ApiTrackerService.record_call(
                provider_name="SSR Innovation Lab (Petrol Pumps)",
                endpoint="/api/petrol-pumps/pumps/by-city/",
                feature_name="Petrol Pump Discovery by City",
                status_code=500,
                latency_ms=latency_ms,
                is_success=False,
                error_message=str(e),
            )
            return {"count": 0, "results": []}

    def sync_city_pumps_to_db(self, db: Session, city: str, limit: int = 50) -> Dict[str, Any]:
        """
        Synchronizes petrol pumps for a given city into the local database.
        Applies idempotency and duplicate prevention:
        1. Checks unique ssr_id.
        2. Falls back to matching (pump_name, city, latitude, longitude).
        3. Cross-syncs into FuelStationRecord to enrich OSM stations with verified OMC prices.
        """
        raw_res = self.fetch_pumps_by_city(city=city)
        results = raw_res.get("results", [])

        if not results:
            # Fallback to search if /by-city/ had 0 records
            raw_res = self.fetch_pumps(city=city, limit=limit)
            results = raw_res.get("results", [])

        ingested = 0
        updated = 0

        for r in results[:limit]:
            ssr_id = r.get("id")
            if not ssr_id:
                continue

            p_name = self._clean_str(r.get("pump_name") or r.get("name"))
            if not p_name:
                continue

            company = self._clean_str(r.get("company")) or "OMC"
            addr = self._clean_str(r.get("address"))
            c_city = self._clean_str(r.get("city")) or city
            c_dist = self._clean_str(r.get("district"))
            c_state = self._clean_str(r.get("state"))
            pincode = self._clean_str(r.get("pincode"))

            # Sometimes city field contains 6-digit pincode in the API response (e.g. "226001")
            if c_city and c_city.isdigit() and len(c_city) == 6 and not pincode:
                pincode = c_city
                c_city = c_dist or city

            lat = self._parse_float(r.get("latitude"))
            lon = self._parse_float(r.get("longitude"))
            petrol_p = self._parse_float(r.get("petrol_price"))
            diesel_p = self._parse_float(r.get("diesel_price"))
            has_petrol = bool(r.get("has_petrol", True))
            has_diesel = bool(r.get("has_diesel", True))
            has_cng = bool(r.get("has_cng", False))
            timing = self._clean_str(r.get("station_timing")) or "24 Hours"
            nav_link = self._clean_str(r.get("direction_link"))

            # Duplicate check
            existing = db.query(PetrolPump).filter(PetrolPump.ssr_id == ssr_id).first()
            if not existing and lat and lon:
                existing = (
                    db.query(PetrolPump)
                    .filter(
                        PetrolPump.pump_name == p_name,
                        PetrolPump.latitude == lat,
                        PetrolPump.longitude == lon,
                    )
                    .first()
                )

            if existing:
                existing.petrol_price = petrol_p or existing.petrol_price
                existing.diesel_price = diesel_p or existing.diesel_price
                existing.has_cng = has_cng or existing.has_cng
                existing.direction_link = nav_link or existing.direction_link
                existing.company = company or existing.company
                existing.station_timing = timing or existing.station_timing
                existing.address = addr or existing.address
                existing.pincode = pincode or existing.pincode
                existing.district = c_dist or existing.district
                existing.state = c_state or existing.state
                updated += 1
            else:
                new_pump = PetrolPump(
                    ssr_id=ssr_id,
                    pump_name=p_name,
                    name=p_name,
                    company=company,
                    address=addr,
                    city=c_city,
                    district=c_dist,
                    state=c_state,
                    pincode=pincode,
                    latitude=lat,
                    longitude=lon,
                    petrol_price=petrol_p,
                    diesel_price=diesel_p,
                    has_petrol=has_petrol,
                    has_diesel=has_diesel,
                    has_cng=has_cng,
                    station_timing=timing,
                    direction_link=nav_link,
                    source_name=self.SOURCE_NAME,
                )
                db.add(new_pump)
                ingested += 1

            # Cross-sync into FuelStationRecord if lat/lon available
            if lat and lon:
                osm_existing = (
                    db.query(FuelStationRecord)
                    .filter(
                        FuelStationRecord.latitude == lat,
                        FuelStationRecord.longitude == lon,
                    )
                    .first()
                )
                if not osm_existing:
                    osm_existing = (
                        db.query(FuelStationRecord)
                        .filter(
                            FuelStationRecord.name == p_name,
                            FuelStationRecord.city == c_city,
                        )
                        .first()
                    )

                if not osm_existing:
                    new_fs = FuelStationRecord(
                        osm_id=f"ssr_{ssr_id}",
                        name=p_name,
                        brand=company,
                        operator=company,
                        latitude=lat,
                        longitude=lon,
                        address=addr or f"{c_city}, {c_state or ''}",
                        locality=c_dist or c_city,
                        city=c_city,
                        state=c_state,
                        pincode=pincode,
                        has_cng=has_cng,
                        has_petrol=has_petrol,
                        has_diesel=has_diesel,
                        opening_hours=timing,
                        source_provider="ssr_petrol_pumps",
                        attribution="SSR Innovation Lab (Live OMC Feed)",
                    )
                    db.add(new_fs)

        db.commit()
        logger.info(f"[ssr_petrol] Sync for {city}: {ingested} added, {updated} updated.")
        return {
            "city": city,
            "ingested": ingested,
            "updated": updated,
            "total_received": len(results),
        }


ssr_petrol_pump_client = SsrPetrolPumpClient()

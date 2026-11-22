"""
data.gov.in Hospital Directory Client (NIHFW / MoHFW)
Integrates authentic hospital records from the National Hospital Directory:
Resource ID: 98fa254e-c5f8-4910-a19b-4828939b477d
Published by Department of Health & Family Welfare, Ministry of Health and Family Welfare (NIHFW)
"""

import time
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.core.config import settings
from backend.app.database.models import HospitalDirectory, EmergencyFacility
from backend.app.services.api_tracker_service import ApiTrackerService

logger = logging.getLogger(__name__)


class HospitalApiClient:
    BASE_URL = "https://api.data.gov.in/resource/98fa254e-c5f8-4910-a19b-4828939b477d"
    RESOURCE_ID = "98fa254e-c5f8-4910-a19b-4828939b477d"
    SOURCE_NAME = "Ministry of Health and Family Welfare (NIHFW) - data.gov.in"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.DATA_GOV_IN_API_KEY
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    def _parse_coordinates(coord_str: Any) -> Tuple[Optional[float], Optional[float]]:
        if not coord_str:
            return None, None
        s = str(coord_str).strip()
        if s in ("0", "NA", "N/A", "null", "None", "-"):
            return None, None
        try:
            parts = s.split(",")
            if len(parts) >= 2:
                lat = float(parts[0].strip())
                lon = float(parts[1].strip())
                if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0 and not (lat == 0.0 and lon == 0.0):
                    return lat, lon
        except Exception:
            pass
        return None, None

    @staticmethod
    def _parse_int(val: Any, default: int = 0) -> int:
        if val is None:
            return default
        s = str(val).strip()
        if s in ("0", "NA", "N/A", "null", "None", "-"):
            return default
        try:
            return int(float(s))
        except Exception:
            return default

    def fetch_records(
        self,
        state: Optional[str] = None,
        district: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Fetches live hospital directory records from data.gov.in with filtering and pagination.
        Tracks API latency and consumption via ApiTrackerService.
        """
        if not self.api_key:
            logger.warning("[hospital_client] DATA_GOV_IN_API_KEY is not configured.")
            return {"total": 0, "records": [], "count": 0}

        params: Dict[str, Any] = {
            "api-key": self.api_key,
            "format": "json",
            "limit": min(limit, 250),
            "offset": offset,
        }

        if state and state.strip() and state.strip().lower() not in ("all", "all india", "india"):
            params["filters[state]"] = state.strip()

        if district and district.strip() and district.strip().lower() not in ("all", "all districts"):
            params["filters[district]"] = district.strip()

        start_time = time.time()
        is_success = False
        error_msg = None
        status_code = 0

        try:
            with httpx.Client(timeout=25.0, headers=self.headers) as client:
                resp = client.get(self.BASE_URL, params=params)
                status_code = resp.status_code
                latency_ms = (time.time() - start_time) * 1000

                if resp.status_code == 200:
                    data = resp.json()
                    is_success = True
                    records = data.get("records", [])
                    total = data.get("total", len(records))

                    ApiTrackerService.record_call(
                        provider_name="data.gov.in (Hospital Directory)",
                        endpoint=f"/resource/{self.RESOURCE_ID}",
                        feature_name="Healthcare & Emergency Hospitals",
                        status_code=status_code,
                        latency_ms=latency_ms,
                        is_success=True,
                    )
                    return {
                        "total": total,
                        "count": len(records),
                        "records": records,
                        "resource_id": self.RESOURCE_ID,
                        "source": self.SOURCE_NAME,
                    }
                else:
                    error_msg = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    logger.error(f"[hospital_client] Failed with status {resp.status_code}")
                    ApiTrackerService.record_call(
                        provider_name="data.gov.in (Hospital Directory)",
                        endpoint=f"/resource/{self.RESOURCE_ID}",
                        feature_name="Healthcare & Emergency Hospitals",
                        status_code=status_code,
                        latency_ms=latency_ms,
                        is_success=False,
                        error_message=error_msg,
                    )
                    return {"total": 0, "count": 0, "records": []}

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            error_msg = str(e)
            logger.error(f"[hospital_client] API request failed: {e}")
            ApiTrackerService.record_call(
                provider_name="data.gov.in (Hospital Directory)",
                endpoint=f"/resource/{self.RESOURCE_ID}",
                feature_name="Healthcare & Emergency Hospitals",
                status_code=status_code or 500,
                latency_ms=latency_ms,
                is_success=False,
                error_message=error_msg,
            )
            return {"total": 0, "count": 0, "records": []}

    def sync_to_database(
        self,
        db: Session,
        state: Optional[str] = None,
        district: Optional[str] = None,
        limit: int = 150,
        sync_emergency_facilities: bool = True,
    ) -> Dict[str, Any]:
        """
        Synchronizes live hospital records from data.gov.in into the local SQLite/PostgreSQL database.
        Applies idempotency and duplicate prevention:
        1. Unique checking on (hospital_name, state, district) and sr_no.
        2. Upsert / update of contact numbers, coordinates, and emergency facilities.
        3. Cross-populates verified geocoded hospitals into EmergencyFacility table.
        """
        raw_res = self.fetch_records(state=state, district=district, limit=limit)
        records = raw_res.get("records", [])

        if not records:
            return {"ingested": 0, "updated": 0, "emergency_synced": 0, "total_in_batch": 0}

        ingested_count = 0
        updated_count = 0
        emergency_synced_count = 0

        for r in records:
            # Field name normalizer (handles leading underscores if present)
            sr_no = self._parse_int(r.get("sr_no") or r.get("_sr_no"))
            h_name = self._clean_str(r.get("hospital_name") or r.get("_hospital_name"))
            if not h_name:
                continue

            st = self._clean_str(r.get("state") or r.get("_state")) or "India"
            dt = self._clean_str(r.get("district") or r.get("_district")) or "General"
            subdt = self._clean_str(r.get("subdistrict") or r.get("_subdistrict"))
            pincode = self._clean_str(r.get("pincode") or r.get("_pincode"))
            addr = self._clean_str(r.get("address_original_first_line") or r.get("_address_original_first_line"))
            loc = self._clean_str(r.get("location") or r.get("_location"))

            raw_coords = r.get("location_coordinates") or r.get("_location_coordinates")
            lat, lon = self._parse_coordinates(raw_coords)

            care_type = self._clean_str(r.get("hospital_care_type") or r.get("_hospital_care_type")) or "Hospital"
            cat = self._clean_str(r.get("hospital_category") or r.get("_hospital_category"))
            discipline = self._clean_str(r.get("discipline_systems_of_medicine") or r.get("_discipline_systems_of_medicine"))

            tel = self._clean_str(r.get("telephone") or r.get("_telephone"))
            mob = self._clean_str(r.get("mobile_number") or r.get("_mobile_number"))
            emg_num = self._clean_str(r.get("emergency_num") or r.get("_emergency_num"))
            amb_num = self._clean_str(r.get("ambulance_phone_no") or r.get("_ambulance_phone_no"))
            bld_num = self._clean_str(r.get("bloodbank_phone_no") or r.get("_bloodbank_phone_no"))
            tollfree = self._clean_str(r.get("tollfree") or r.get("_tollfree"))
            helpline = self._clean_str(r.get("helpline") or r.get("_helpline"))
            email = self._clean_str(r.get("hospital_primary_email_id") or r.get("_hospital_primary_email_id"))
            web = self._clean_str(r.get("website") or r.get("_website"))

            specialties = self._clean_str(r.get("specialties") or r.get("_specialties"))
            facilities = self._clean_str(r.get("facilities") or r.get("_facilities"))
            accreditation = self._clean_str(r.get("accreditation") or r.get("_accreditation"))
            beds = self._parse_int(r.get("total_num_beds") or r.get("_total_num_beds"), default=0)
            emg_services = self._clean_str(r.get("emergency_services") or r.get("_emergency_services"))

            has_emergency = bool(emg_services and emg_services.lower() in ("yes", "24/7", "available", "true", "1")) or (emg_num is not None)
            has_bloodbank = bool(bld_num is not None) or (facilities and "blood" in facilities.lower())
            has_ambulance = bool(amb_num is not None) or (facilities and "ambulance" in facilities.lower())

            # 1. Duplicate check in HospitalDirectory by sr_no or (hospital_name, state, district)
            existing = None
            if sr_no:
                existing = db.query(HospitalDirectory).filter(HospitalDirectory.sr_no == sr_no).first()
            if not existing:
                existing = (
                    db.query(HospitalDirectory)
                    .filter(
                        HospitalDirectory.hospital_name == h_name,
                        HospitalDirectory.state == st,
                        HospitalDirectory.district == dt,
                    )
                    .first()
                )

            if existing:
                # Update existing record
                existing.latitude = lat or existing.latitude
                existing.longitude = lon or existing.longitude
                existing.telephone = tel or existing.telephone
                existing.mobile_number = mob or existing.mobile_number
                existing.emergency_num = emg_num or existing.emergency_num
                existing.ambulance_phone = amb_num or existing.ambulance_phone
                existing.bloodbank_phone = bld_num or existing.bloodbank_phone
                existing.address = addr or existing.address
                existing.pincode = pincode or existing.pincode
                existing.care_type = care_type or existing.care_type
                existing.total_beds = beds or existing.total_beds
                existing.has_emergency = has_emergency or existing.has_emergency
                existing.has_bloodbank = has_bloodbank or existing.has_bloodbank
                existing.has_ambulance = has_ambulance or existing.has_ambulance
                updated_count += 1
            else:
                new_h = HospitalDirectory(
                    sr_no=sr_no,
                    hospital_name=h_name,
                    hospital_category=cat,
                    care_type=care_type,
                    discipline_system=discipline,
                    state=st,
                    district=dt,
                    subdistrict=subdt,
                    pincode=pincode,
                    address=addr,
                    location=loc,
                    latitude=lat,
                    longitude=lon,
                    telephone=tel,
                    mobile_number=mob,
                    emergency_num=emg_num,
                    ambulance_phone=amb_num,
                    bloodbank_phone=bld_num,
                    tollfree=tollfree,
                    helpline=helpline,
                    email=email,
                    website=web,
                    specialties=specialties,
                    facilities=facilities,
                    accreditation=accreditation,
                    total_beds=beds,
                    emergency_services=emg_services,
                    has_emergency=has_emergency,
                    has_bloodbank=has_bloodbank,
                    has_ambulance=has_ambulance,
                    source_name=self.SOURCE_NAME,
                    resource_id=self.RESOURCE_ID,
                )
                db.add(new_h)
                ingested_count += 1

            # 2. Cross-populate EmergencyFacility table if geocoded coordinates exist
            if sync_emergency_facilities and lat and lon:
                primary_phone = emg_num or mob or tel or amb_num or "108 / 112"
                ef_existing = (
                    db.query(EmergencyFacility)
                    .filter(
                        EmergencyFacility.name == h_name,
                        EmergencyFacility.state == st,
                    )
                    .first()
                )
                if not ef_existing:
                    new_ef = EmergencyFacility(
                        name=h_name,
                        facility_type=care_type or "Casualty & Trauma Center",
                        phone=primary_phone,
                        secondary_phone=amb_num or tel or "108",
                        address=addr or loc or f"{dt}, {st}",
                        locality=loc or dt,
                        city=dt,
                        state=st,
                        latitude=lat,
                        longitude=lon,
                        is_24_7=True,
                        trauma_level="Government Certified Facility (NIHFW)",
                        blood_bank_available=has_bloodbank,
                    )
                    db.add(new_ef)
                    emergency_synced_count += 1

        db.commit()
        logger.info(
            f"[hospital_client] Ingestion complete: {ingested_count} added, {updated_count} updated, {emergency_synced_count} emergency facilities cross-synced."
        )
        return {
            "ingested": ingested_count,
            "updated": updated_count,
            "emergency_synced": emergency_synced_count,
            "total_in_batch": len(records),
        }


hospital_client = HospitalApiClient()

"""
MyArea24 — Open Government Data (data.gov.in) Agmarknet Integration
Provides official daily wholesale APMC mandi price discovery for agricultural commodities,
fruits, vegetables, grains, pulses and spices across India.
"""

import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.models import MandiPrice, DataSource, DataSyncLog
from backend.app.services.api_tracker_service import ApiTrackerService

# Primary Agmarknet Mandi Dataset Resource ID on OGD Platform India (data.gov.in)
AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"
DATA_GOV_IN_BASE_URL = f"https://api.data.gov.in/resource/{AGMARKNET_RESOURCE_ID}"

# Standard Browser User-Agent required by Government Web Application Firewalls (NIC WAF)
NIC_WAF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Commodity Classification Lexicon
FRUIT_KEYWORDS = {
    "apple", "banana", "mango", "orange", "papaya", "pomegranate", "grapes",
    "guava", "watermelon", "melon", "lemon", "lime", "sweet lime", "mosambi",
    "chikoo", "custard apple", "pineapple", "coconut", "pear", "plum", "peach",
    "kinnow", "ber", "amla", "litchi", "strawberry", "fig", "jack fruit"
}

GRAIN_KEYWORDS = {
    "wheat", "paddy", "rice", "basmati", "maize", "bajra", "jowar", "barley",
    "arhar", "toor", "moong", "urd", "urad", "gram", "chana", "dal", "lentil",
    "peas", "soyabean", "ragi", "millet", "sorghum", "sesamum", "mustard seed"
}

SPICE_KEYWORDS = {
    "mustard", "til", "ginger", "garlic", "turmeric", "coriander", "dhania",
    "cumin", "jeera", "cardamom", "clove", "pepper", "chilli", "chili", "mirch",
    "methi", "fenugreek", "jaggery", "gur", "groundnut", "peanut", "cotton",
    "tamarind", "fennel", "saunf", "aniseed", "ajwain"
}


class AgmarknetClient:
    """
    Production-grade client for the data.gov.in Agmarknet Mandi Prices API.
    Handles authentication, parameter normalization, NIC firewall guards,
    metric tracking, unit conversion (₹/Quintal to ₹/kg), and error resilience.
    """

    def __init__(self, timeout_seconds: float = 25.0):
        self.timeout = timeout_seconds
        self.api_key = settings.DATA_GOV_IN_API_KEY
        self.resource_id = getattr(settings, "DATA_GOV_IN_MANDI_RESOURCE_ID", AGMARKNET_RESOURCE_ID)

    @staticmethod
    def classify_commodity(commodity_name: str) -> str:
        """Classifies raw commodity string into canonical agricultural category."""
        low = commodity_name.lower()
        for kw in FRUIT_KEYWORDS:
            if kw in low:
                return "Fruits"
        for kw in GRAIN_KEYWORDS:
            if kw in low:
                return "Grains & Pulses"
        for kw in SPICE_KEYWORDS:
            if kw in low:
                return "Spices & Commercial"
        return "Vegetables"

    @staticmethod
    def parse_arrival_date(date_str: Optional[str]) -> Tuple[datetime.datetime, str]:
        """Parses dd/mm/yyyy or yyyy-mm-dd date format from Agmarknet."""
        if not date_str:
            now = datetime.datetime.utcnow()
            return now, now.strftime("%d/%m/%Y")

        clean = date_str.strip().replace("\\", "")
        # Common format in Agmarknet is dd/mm/yyyy
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                dt = datetime.datetime.strptime(clean, fmt)
                return dt, clean
            except ValueError:
                continue

        now = datetime.datetime.utcnow()
        return now, clean

    def fetch_live_mandi_prices(
        self,
        state: Optional[str] = None,
        district: Optional[str] = None,
        commodity: Optional[str] = None,
        market: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Queries api.data.gov.in for live daily APMC mandi wholesale records.
        Returns parsed list of standardized records and pagination metadata.
        """
        if not self.api_key:
            logger.warning("[agmarknet] DATA_GOV_IN_API_KEY not configured.")
            return {"status": "error", "message": "API key missing", "records": [], "total": 0}

        url = f"https://api.data.gov.in/resource/{self.resource_id}"
        params: Dict[str, Any] = {
            "api-key": self.api_key,
            "format": "json",
            "limit": min(max(1, limit), 250),
            "offset": max(0, offset),
        }

        # Apply specific OGD filters if specified
        if state and state.strip() and state.strip().lower() not in ("all", "all india", "india"):
            params["filters[state]"] = state.strip()
        if district and district.strip() and district.strip().lower() not in ("all", "all districts"):
            params["filters[district]"] = district.strip()
        if commodity and commodity.strip() and commodity.strip().lower() not in ("all", "all commodities"):
            params["filters[commodity]"] = commodity.strip()
        if market and market.strip() and market.strip().lower() not in ("all", "all markets"):
            params["filters[market]"] = market.strip()

        start_time = datetime.datetime.utcnow()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(url, params=params, headers=NIC_WAF_HEADERS)
                latency_ms = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)

                # Track API request usage
                try:
                    ApiTrackerService.record_call(
                        provider_name="data.gov.in (Agmarknet)",
                        endpoint="/resource/daily-mandi-price",
                        feature_name="Civic Market Rates",
                        status_code=resp.status_code,
                        latency_ms=latency_ms,
                        is_success=(resp.status_code == 200),
                    )
                except Exception:
                    pass

                if resp.status_code != 200:
                    logger.warning(
                        f"[agmarknet] Non-200 response ({resp.status_code}): {resp.text[:200]}"
                    )
                    return {
                        "status": "error",
                        "status_code": resp.status_code,
                        "message": f"data.gov.in returned HTTP {resp.status_code}",
                        "records": [],
                        "total": 0,
                    }

                payload = resp.json()
                raw_records = payload.get("records", [])
                total_count = int(payload.get("total", len(raw_records)))

                parsed_items: List[Dict[str, Any]] = []
                for r in raw_records:
                    comm_raw = str(r.get("commodity") or "").strip()
                    if not comm_raw:
                        continue

                    # Filter out non-food agricultural waste
                    if any(ex in comm_raw.lower() for ex in ["firewood", "timber", "eucalyptus", "grass"]):
                        continue

                    # Modal price in INR per Quintal (100 kg)
                    try:
                        modal_quintal = float(r.get("modal_price") or 0.0)
                        min_quintal = float(r.get("min_price") or modal_quintal)
                        max_quintal = float(r.get("max_price") or modal_quintal)
                    except (ValueError, TypeError):
                        continue

                    if modal_quintal <= 0:
                        continue

                    # Normalized retail/consumer comparison in INR per kg
                    modal_kg = round(modal_quintal / 100.0, 2)
                    min_kg = round(min_quintal / 100.0, 2)
                    max_kg = round(max_quintal / 100.0, 2)

                    obs_dt, rep_date = self.parse_arrival_date(r.get("arrival_date"))
                    variety = str(r.get("variety") or "Standard").strip()
                    grade = str(r.get("grade") or "Medium").strip()
                    mandi_name = str(r.get("market") or "").strip()
                    st = str(r.get("state") or "").strip()
                    dist = str(r.get("district") or "").strip()

                    parsed_items.append({
                        "commodity": comm_raw,
                        "variety": variety,
                        "grade": grade,
                        "mandi_name": mandi_name or f"{dist} Mandi",
                        "state": st,
                        "district": dist,
                        "city": dist,
                        "category": self.classify_commodity(comm_raw),
                        # Normalized ₹/kg
                        "modal_price": modal_kg,
                        "min_price": min_kg,
                        "max_price": max_kg,
                        "unit": "kg",
                        # Authentic Wholesale ₹/Quintal
                        "raw_modal_price": modal_quintal,
                        "raw_min_price": min_quintal,
                        "raw_max_price": max_quintal,
                        "raw_unit": "Quintal",
                        "source_name": "Government of India - Agmarknet (data.gov.in)",
                        "reported_at": rep_date,
                        "observed_date": obs_dt,
                        "arrival_volume": "Daily Arrivals",
                        "price_trend": "Official APMC Daily",
                    })

                return {
                    "status": "success",
                    "total": total_count,
                    "count": len(parsed_items),
                    "records": parsed_items,
                    "attribution": "Ministry of Agriculture and Farmers Welfare, Government of India (data.gov.in)",
                }

        except Exception as exc:
            logger.error(f"[agmarknet] API request failed: {exc}")
            return {
                "status": "error",
                "message": str(exc),
                "records": [],
                "total": 0,
            }

    def sync_to_database(
        self,
        db,
        state: Optional[str] = None,
        district: Optional[str] = None,
        commodity: Optional[str] = None,
        limit: int = 150,
    ) -> Dict[str, Any]:
        """
        Synchronizes live data.gov.in mandi wholesale prices into the local SQLite/PostgreSQL
        database with idempotency and duplicate prevention.
        """
        res = self.fetch_live_mandi_prices(
            state=state,
            district=district,
            commodity=commodity,
            limit=limit,
        )

        records = res.get("records", [])
        if not records:
            return {"status": "NO_RECORDS", "persisted": 0, "total_in_feed": 0}

        persisted_count = 0
        updated_count = 0
        now_dt = datetime.datetime.utcnow()

        for item in records:
            # Composite idempotency check
            existing = (
                db.query(MandiPrice)
                .filter(
                    MandiPrice.commodity == item["commodity"],
                    MandiPrice.mandi_name == item["mandi_name"],
                    MandiPrice.state == item["state"],
                )
                .first()
            )

            if existing:
                existing.variety = item["variety"]
                existing.grade = item["grade"]
                existing.district = item["district"]
                existing.city = item["city"]
                existing.category = item["category"]
                existing.modal_price = item["modal_price"]
                existing.min_price = item["min_price"]
                existing.max_price = item["max_price"]
                existing.unit = item["unit"]
                existing.raw_modal_price = item["raw_modal_price"]
                existing.raw_min_price = item["raw_min_price"]
                existing.raw_max_price = item["raw_max_price"]
                existing.raw_unit = item["raw_unit"]
                existing.source_name = item["source_name"]
                existing.reported_at = item["reported_at"]
                existing.observed_date = item["observed_date"]
                existing.fetched_at = now_dt
                updated_count += 1
            else:
                new_row = MandiPrice(
                    commodity=item["commodity"],
                    variety=item["variety"],
                    grade=item["grade"],
                    mandi_name=item["mandi_name"],
                    state=item["state"],
                    district=item["district"],
                    city=item["city"],
                    category=item["category"],
                    modal_price=item["modal_price"],
                    min_price=item["min_price"],
                    max_price=item["max_price"],
                    unit=item["unit"],
                    raw_modal_price=item["raw_modal_price"],
                    raw_min_price=item["raw_min_price"],
                    raw_max_price=item["raw_max_price"],
                    raw_unit=item["raw_unit"],
                    source_name=item["source_name"],
                    reported_at=item["reported_at"],
                    arrival_volume=item["arrival_volume"],
                    price_trend=item["price_trend"],
                    observed_date=item["observed_date"],
                    fetched_at=now_dt,
                )
                db.add(new_row)
                persisted_count += 1

        try:
            db.commit()
            logger.info(
                f"[agmarknet] Persisted {persisted_count} new and updated {updated_count} mandi price records."
            )
        except Exception as e:
            db.rollback()
            logger.error(f"[agmarknet] Database commit error: {e}")
            return {"status": "ERROR", "error": str(e), "persisted": 0}

        return {
            "status": "SUCCESS",
            "persisted_new": persisted_count,
            "updated": updated_count,
            "total_synced": persisted_count + updated_count,
            "total_available_in_dataset": res.get("total", 0),
        }


# Singleton Client Instance
agmarknet_client = AgmarknetClient()

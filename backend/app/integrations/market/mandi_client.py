import datetime
from typing import Any, Dict, List, Optional
import httpx

from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient


class MandiApiClient(BaseProviderClient):
    """
    Client for fetching dynamic live APMC mandi wholesale & modal commodity prices
    from the open-access Mandi Price API (https://mandi-api.onrender.com).
    """

    BASE_URL = "https://mandi-api.onrender.com/v1"
    SUPPORTED_STATES = [
        "Uttar Pradesh",
        "Maharashtra",
        "Karnataka",
        "Punjab",
        "Madhya Pradesh",
    ]

    EXCLUDED_COMMODITIES = {
        "wood",
        "firewood",
        "eucalyptus",
        "timber",
        "bamboo",
        "grass",
    }

    FRUIT_KEYWORDS = [
        "apple", "banana", "mango", "orange", "papaya", "pomegranate", "grapes",
        "guava", "watermelon", "melon", "lemon", "sweet lime", "mosambi", "chikoo",
        "custard apple", "pineapple", "coconut", "pear", "plum", "peach"
    ]

    GRAIN_KEYWORDS = [
        "wheat", "paddy", "rice", "basmati", "maize", "bajra", "jowar", "barley",
        "arhar", "toor", "moong", "urd", "gram", "chana", "dal", "lentil", "peas",
        "soyabean", "ragi", "millet"
    ]

    SPICE_KEYWORDS = [
        "mustard", "sesamum", "til", "ginger", "garlic", "turmeric", "coriander",
        "cumin", "jeera", "cardamom", "clove", "pepper", "chilli", "chili",
        "methi", "fenugreek", "jaggery", "gur", "groundnut", "cotton"
    ]

    def __init__(self, timeout_seconds: float = 12.0):
        super().__init__(provider_name="mandi_api", timeout_seconds=timeout_seconds)

    def classify_category(self, commodity_name: str) -> str:
        name_lower = commodity_name.lower()
        for kw in self.FRUIT_KEYWORDS:
            if kw in name_lower:
                return "Fruits"
        for kw in self.GRAIN_KEYWORDS:
            if kw in name_lower:
                return "Grains & Pulses"
        for kw in self.SPICE_KEYWORDS:
            if kw in name_lower:
                return "Spices & Oils"
        return "Vegetables"

    async def fetch_prices_for_state(
        self, state: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetches live mandi commodity prices for a given state.
        Returns parsed, validated list of commodity records with prices normalized to INR / kg.
        """
        url = f"{self.BASE_URL}/prices"
        params = {"state": state, "limit": limit}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    logger.warning(
                        f"[mandi_api] Non-200 response ({resp.status_code}) for state {state}: {resp.text[:200]}"
                    )
                    return []

                payload = resp.json()
                if not payload.get("success"):
                    return []

                raw_items = payload.get("data", [])
                valid_items: List[Dict[str, Any]] = []

                for item in raw_items:
                    comm_raw = str(item.get("commodity") or "").strip()
                    if not comm_raw:
                        continue

                    # Filter out non-food/civic commodities
                    if any(ex in comm_raw.lower() for ex in self.EXCLUDED_COMMODITIES):
                        continue

                    # Upstream modal_price is in INR per Quintal (100 kg)
                    modal_raw = float(item.get("modal_price") or 0.0)
                    min_raw = float(item.get("min_price") or modal_raw)
                    max_raw = float(item.get("max_price") or modal_raw)

                    if modal_raw <= 0:
                        continue

                    # Convert to retail INR / kg
                    modal_kg = round(modal_raw / 100.0, 2)
                    min_kg = round(min_raw / 100.0, 2)
                    max_kg = round(max_raw / 100.0, 2)

                    arrival_date_str = item.get("arrival_date")
                    try:
                        obs_date = (
                            datetime.datetime.strptime(arrival_date_str, "%Y-%m-%d")
                            if arrival_date_str
                            else datetime.datetime.utcnow()
                        )
                    except Exception:
                        obs_date = datetime.datetime.utcnow()

                    valid_items.append({
                        "commodity": comm_raw,
                        "variety": item.get("variety") or "Standard",
                        "mandi_name": item.get("market") or f"{item.get('district', state)} APMC",
                        "state": item.get("state") or state,
                        "district": item.get("district") or "",
                        "city": item.get("district") or "",
                        "category": self.classify_category(comm_raw),
                        "modal_price": modal_kg,
                        "min_price": min_kg,
                        "max_price": max_kg,
                        "unit": "kg",
                        "arrival_volume": "Regular Arrivals",
                        "price_trend": "Live Mandi",
                        "observed_date": obs_date,
                    })

                return valid_items
        except Exception as exc:
            logger.error(f"[mandi_api] Failed to fetch prices for {state}: {exc}")
            return []

    async def sync_all_supported_states(self, db) -> Dict[str, Any]:
        """
        Synchronizes mandi prices for all supported states into the database.
        Uses upsert logic on (commodity, mandi_name, state).
        """
        from backend.app.database.models import MandiPrice, DataSource, DataSyncLog

        start_time = datetime.datetime.utcnow()
        total_fetched = 0
        total_persisted = 0
        errors = []

        # Ensure DataSource record exists
        ds = db.query(DataSource).filter(DataSource.id == "mandi_api").first()
        if not ds:
            ds = DataSource(
                id="mandi_api",
                name="Mandi Price API (APMC Live Feeds)",
                base_url=self.BASE_URL,
                is_active=True,
            )
            db.add(ds)
            db.commit()

        for state in self.SUPPORTED_STATES:
            try:
                items = await self.fetch_prices_for_state(state, limit=60)
                total_fetched += len(items)

                for item in items:
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
                        existing.modal_price = item["modal_price"]
                        existing.min_price = item["min_price"]
                        existing.max_price = item["max_price"]
                        existing.variety = item["variety"]
                        existing.category = item["category"]
                        existing.price_trend = item["price_trend"]
                        existing.observed_date = item["observed_date"]
                    else:
                        new_record = MandiPrice(**item)
                        db.add(new_record)
                    total_persisted += 1

                db.commit()
            except Exception as err:
                errors.append(f"{state}: {err}")
                logger.error(f"[mandi_api] Failed sync for {state}: {err}")

        # Update data source and log
        end_time = datetime.datetime.utcnow()
        duration_ms = int((end_time - start_time).total_seconds() * 1000)
        status = "FAILED" if errors and total_persisted == 0 else "SUCCESS"

        ds.last_sync_at = end_time
        ds.last_status = status
        if status == "FAILED":
            ds.error_count += 1
        db.add(ds)

        sync_log = DataSyncLog(
            source_id="mandi_api",
            sync_started_at=start_time,
            sync_ended_at=end_time,
            duration_ms=duration_ms,
            records_fetched=total_fetched,
            records_persisted=total_persisted,
            records_rejected=0,
            status=status,
            error_message="; ".join(errors) if errors else None,
            metadata_json={"supported_states": self.SUPPORTED_STATES},
        )
        db.add(sync_log)
        db.commit()

        return {
            "status": status,
            "total_fetched": total_fetched,
            "total_persisted": total_persisted,
            "errors": errors,
        }


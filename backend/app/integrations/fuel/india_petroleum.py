import datetime
from typing import Any, Dict, List, Optional

from backend.app.core.config import settings
from backend.app.core.errors import ProviderError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.integrations.fuel.base import BaseFuelProvider


class IndiaPetroleumClient(BaseProviderClient, BaseFuelProvider):
    """
    Client for India Petroleum API (PPAC MoPNG public data feed).
    Upstream URL: https://india-petroleum-api.vercel.app
    Endpoints:
      - /v1/prices/latest : Latest petrol & diesel rates
      - /v1/cities        : Supported Indian cities
      - /v1/prices        : Historical price ranges by date and city
    """

    provider_id = "india_petroleum_api"
    provider_name = "India Petroleum API (PPAC MoPNG)"

    def __init__(self, base_url: Optional[str] = None, timeout_seconds: Optional[float] = None):
        super().__init__(provider_name=self.provider_name, timeout_seconds=timeout_seconds)
        self.base_url = (base_url or getattr(settings, "INDIA_PETROLEUM_API_BASE_URL", "https://india-petroleum-api.vercel.app")).rstrip("/")

    async def fetch_latest_prices(self) -> Dict[str, Any]:
        """
        Fetches the latest petrol and diesel prices across Indian cities.
        """
        url = f"{self.base_url}/v1/prices/latest"
        headers = {
            "User-Agent": "MyArea24-Intelligence-Engine/1.0 (+https://myarea24.in)",
            "Accept": "application/json",
        }

        logger.info(f"[{self.provider_id}] Fetching latest dynamic retail fuel prices from {url}")
        response = await self._get(url, headers=headers)

        try:
            payload = response.json()
        except Exception as e:
            raise ProviderError(self.provider_id, f"Invalid JSON response from upstream: {e}")

        if not payload.get("success"):
            err_msg = payload.get("error", {}).get("message", "Unknown upstream error")
            raise ProviderError(self.provider_id, f"Upstream API reported error: {err_msg}")

        data = payload.get("data", {})
        meta = payload.get("meta", {})
        source_date = data.get("date", datetime.date.today().isoformat())
        petrol_map = data.get("petrol", {})
        diesel_map = data.get("diesel", {})

        attribution = meta.get(
            "attribution",
            "Petroleum Planning & Analysis Cell (PPAC), Ministry of Petroleum and Natural Gas, Government of India"
        )
        source_posted_date = meta.get("source_posted_date")
        latest_fetched_at = meta.get("latest_fetched_at") or datetime.datetime.utcnow().isoformat()

        all_cities = set(list(petrol_map.keys()) + list(diesel_map.keys()))
        prices: Dict[str, Dict[str, Any]] = {}

        for slug in sorted(all_cities):
            norm_slug = slug.strip().lower()
            p_val = petrol_map.get(slug)
            d_val = diesel_map.get(slug)
            prices[norm_slug] = {
                "city_slug": norm_slug,
                "city_name": norm_slug.title(),
                "petrol": float(p_val) if p_val is not None else None,
                "diesel": float(d_val) if d_val is not None else None,
            }

        return {
            "success": True,
            "source_date": source_date,
            "source_posted_date": source_posted_date,
            "attribution": attribution,
            "latest_fetched_at": latest_fetched_at,
            "prices": prices,
        }

    async def fetch_available_cities(self) -> List[Dict[str, str]]:
        """
        Fetches list of supported cities from upstream.
        """
        url = f"{self.base_url}/v1/cities"
        headers = {
            "User-Agent": "MyArea24-Intelligence-Engine/1.0 (+https://myarea24.in)",
            "Accept": "application/json",
        }

        logger.info(f"[{self.provider_id}] Fetching supported cities from {url}")
        response = await self._get(url, headers=headers)

        try:
            payload = response.json()
        except Exception as e:
            raise ProviderError(self.provider_id, f"Invalid JSON response from upstream cities: {e}")

        if not payload.get("success"):
            err_msg = payload.get("error", {}).get("message", "Failed to retrieve cities")
            raise ProviderError(self.provider_id, f"Upstream API reported error: {err_msg}")

        raw_cities = payload.get("data", [])
        return [
            {"slug": c.get("slug", "").strip().lower(), "name": c.get("name", "").strip()}
            for c in raw_cities
            if c.get("slug")
        ]

    async def fetch_historical_prices(
        self,
        from_date: str,
        to_date: str,
        city: Optional[str] = None,
        fuel: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches historical price records within date range [from_date, to_date].
        """
        url = f"{self.base_url}/v1/prices"
        params: Dict[str, str] = {
            "from": from_date,
            "to": to_date,
        }
        if city:
            params["city"] = city.strip().lower()
        if fuel:
            params["fuel"] = fuel.strip().lower()

        headers = {
            "User-Agent": "MyArea24-Intelligence-Engine/1.0 (+https://myarea24.in)",
            "Accept": "application/json",
        }

        logger.info(f"[{self.provider_id}] Fetching historical prices: {params}")
        response = await self._get(url, params=params, headers=headers)

        try:
            payload = response.json()
        except Exception as e:
            raise ProviderError(self.provider_id, f"Invalid JSON response from upstream historical prices: {e}")

        if not payload.get("success"):
            err_msg = payload.get("error", {}).get("message", "Failed to retrieve historical prices")
            raise ProviderError(self.provider_id, f"Upstream API reported error: {err_msg}")

        return payload.get("data", [])

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseFuelProvider(ABC):
    """
    Abstract base interface for Indian retail fuel telemetry providers.
    Allows seamlessly plugging in additional data sources (PPAC, IOCL/BPCL/HPCL OMC scrapers,
    API Mitra, ONDC fuel pumps) without altering business logic or database schemas.
    """

    provider_id: str = "base_fuel"
    provider_name: str = "Base Fuel Provider"

    @abstractmethod
    async def fetch_latest_prices(self) -> Dict[str, Any]:
        """
        Fetches the latest city-wise retail fuel prices (petrol, diesel).
        Must return normalized dictionary:
        {
            "success": bool,
            "source_date": str (YYYY-MM-DD),
            "source_posted_date": Optional[str],
            "attribution": str,
            "latest_fetched_at": str,
            "prices": {
                "city_slug": {
                    "city_name": str,
                    "petrol": float,
                    "diesel": float,
                }
            }
        }
        """
        pass

    @abstractmethod
    async def fetch_available_cities(self) -> List[Dict[str, str]]:
        """
        Returns list of available/supported cities:
        [{"slug": "delhi", "name": "Delhi"}, ...]
        """
        pass

    @abstractmethod
    async def fetch_historical_prices(
        self,
        from_date: str,
        to_date: str,
        city: Optional[str] = None,
        fuel: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches historical price revisions between from_date and to_date.
        """
        pass

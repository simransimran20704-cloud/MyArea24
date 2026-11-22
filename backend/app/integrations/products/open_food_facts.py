"""
Open Food Facts API client for MyArea24.
Retrieves packaged food product metadata, barcodes, brands, and imagery.
Respects ODbL license and API terms (User-Agent header, caching, rate awareness).
"""
import logging
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

class OpenFoodFactsClient:
    """
    Client for Open Food Facts India & Global REST API.
    Provides barcode metadata lookup and product catalog queries.
    """

    BASE_URL = "https://world.openfoodfacts.org"
    USER_AGENT = "MyArea24-Platform/1.0 (contact@myarea24.in; https://myarea24.in)"

    def __init__(self, timeout_seconds: float = 6.0):
        self.timeout = timeout_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def lookup_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        Looks up a product by its EAN-13 / UPC barcode.
        Returns normalized product metadata with ODbL attribution.
        """
        clean_code = str(barcode).strip().replace(" ", "")
        if not clean_code or not clean_code.isdigit():
            return None

        # Check in-memory cache
        if clean_code in self._cache:
            return self._cache[clean_code]

        url = f"{self.BASE_URL}/api/v2/product/{clean_code}.json"
        headers = {
            "User-Agent": self.USER_AGENT,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    return None

                data = resp.json()
                if data.get("status") != 1:
                    return None

                prod = data.get("product", {})
                name = prod.get("product_name_en") or prod.get("product_name") or prod.get("generic_name")
                if not name:
                    return None

                # Extract best image
                img = (
                    prod.get("image_front_url")
                    or prod.get("image_url")
                    or (prod.get("selected_images", {}).get("front", {}).get("display", {}).get("en"))
                )

                brand = prod.get("brands") or prod.get("brand_owner") or "Generic"
                categories_str = prod.get("categories") or "Packaged Food"
                category_primary = categories_str.split(",")[0].strip() if categories_str else "Grocery"

                normalized = {
                    "barcode": clean_code,
                    "name": name,
                    "brand": brand,
                    "category": category_primary,
                    "categories": categories_str,
                    "quantity": prod.get("quantity") or "",
                    "image_url": img,
                    "ingredients": prod.get("ingredients_text") or "",
                    "nutriscore_grade": prod.get("nutriscore_grade", "").upper() or None,
                    "source": "Open Food Facts",
                    "attribution": "Open Food Facts (ODbL Open Database Licence)",
                    "is_open_data": True,
                    "price_available": False,
                    "notice": "Price & stock are managed by local merchants; open data provides product identity & imagery only.",
                }

                self._cache[clean_code] = normalized
                return normalized
        except Exception as exc:
            logger.warning(f"[OpenFoodFacts] Barcode lookup failed for {clean_code}: {exc}")
            return None

    async def search_packaged_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Searches Indian packaged products by keyword."""
        clean_query = query.strip()
        if not clean_query:
            return []

        url = f"{self.BASE_URL}/cgi/search.pl"
        params = {
            "search_terms": clean_query,
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "page_size": min(limit, 25),
        }
        headers = {
            "User-Agent": self.USER_AGENT,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code != 200:
                    return []

                data = resp.json()
                raw_prods = data.get("products", [])
                results: List[Dict[str, Any]] = []

                for prod in raw_prods:
                    name = prod.get("product_name_en") or prod.get("product_name")
                    if not name:
                        continue
                    code = prod.get("code") or prod.get("_id")
                    img = prod.get("image_front_url") or prod.get("image_url")
                    brand = prod.get("brands") or "Generic"
                    results.append({
                        "barcode": code,
                        "name": name,
                        "brand": brand,
                        "category": (prod.get("categories") or "Grocery").split(",")[0].strip(),
                        "quantity": prod.get("quantity") or "",
                        "image_url": img,
                        "source": "Open Food Facts",
                        "attribution": "Open Food Facts (ODbL)",
                    })

                return results
        except Exception as exc:
            logger.warning(f"[OpenFoodFacts] Search failed for {clean_query}: {exc}")
            return []

open_food_facts_client = OpenFoodFactsClient()

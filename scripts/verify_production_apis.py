"""
MyArea24 — Production API Verification Suite
Tests all core APIs against the running backend server or in-memory ASGI TestClient.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_api(name, method, url, **kwargs):
    try:
        if method == "GET":
            response = client.get(url, **kwargs)
        elif method == "POST":
            response = client.post(url, **kwargs)
        else:
            raise ValueError(f"Unsupported method: {method}")

        status = response.status_code
        data = response.json() if "application/json" in response.headers.get("content-type", "") else response.text
        is_ok = 200 <= status < 300
        print(f"[{'PASS' if is_ok else 'FAIL'}] {name} ({method} {url}) -> HTTP {status}")
        if not is_ok:
            print(f"       Error details: {data}")
        return is_ok, data
    except Exception as e:
        print(f"[ERROR] {name} ({method} {url}) -> Exception: {e}")
        return False, str(e)

def run_suite():
    print("=" * 70)
    print("MyArea24 Production API Verification Suite")
    print("=" * 70)

    results = []

    # 1. Health & Readiness
    results.append(test_api("Health Endpoint", "GET", "/api/v1/health")[0])
    results.append(test_api("Readiness Endpoint", "GET", "/api/v1/ready")[0])

    # 2. Maps & Config
    results.append(test_api("Maps Config", "GET", "/api/v1/maps/config")[0])

    # 3. Location & Hierarchy
    results.append(test_api("Location States", "GET", "/api/v1/location/states")[0])
    results.append(test_api("Location Districts", "GET", "/api/v1/location/districts?state=Delhi")[0])

    # 4. Emergency Facilities & Hospital Directory
    results.append(test_api("Emergency Facilities", "GET", "/api/v1/emergency/facilities?lat=28.6304&lng=77.2177&radius_km=10")[0])
    results.append(test_api("Hospital Directory", "GET", "/api/v1/emergency/hospitals/directory?state=Delhi")[0])

    # 5. Market Rates & Fuel
    results.append(test_api("Mandi Market Rates", "GET", "/api/v1/market-rates?state=Delhi")[0])
    results.append(test_api("Fuel Rates", "GET", "/api/v1/fuel-rates?city=Delhi")[0])

    # 6. Intelligence Telemetry
    results.append(test_api("Weather Intelligence", "GET", "/api/v1/intelligence/weather?lat=28.6304&lon=77.2177")[0])
    results.append(test_api("Air Quality Intelligence", "GET", "/api/v1/intelligence/air-quality?lat=28.6304&lon=77.2177")[0])
    results.append(test_api("Traffic Intelligence", "GET", "/api/v1/intelligence/traffic?lat=28.6304&lon=77.2177")[0])

    # 7. Products, Services & Offers
    results.append(test_api("Search Products", "GET", "/api/v1/products?city=Delhi&locality=Dwarka")[0])
    results.append(test_api("List Services", "GET", "/api/v1/services?city=Delhi&locality=Dwarka")[0])
    results.append(test_api("List Offers", "GET", "/api/v1/offers?city=Delhi&locality=Dwarka")[0])

    # 8. Merchant Storefront & Categories
    results.append(test_api("Business Categories", "GET", "/api/v1/businesses/categories")[0])

    # 9. SMS Gateway & Auth
    results.append(test_api("SMS Gateway Status", "GET", "/api/v1/auth/sms-gateway/status")[0])

    print("=" * 70)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Results: {passed}/{total} APIs passed verification.")
    print("=" * 70)
    return passed == total

if __name__ == "__main__":
    success = run_suite()
    sys.exit(0 if success else 1)

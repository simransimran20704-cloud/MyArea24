import json
import urllib.request
import urllib.error
import urllib.parse
import time
import os

API_BASE = "http://127.0.0.1:8000"

def probe_get(url_path, expected_status=200):
    full_url = f"{API_BASE}{url_path}"
    start = time.time()
    try:
        req = urllib.request.Request(full_url, headers={"User-Agent": "MyArea24-Auditor/1.0"})
        with urllib.request.urlopen(req, timeout=12) as res:
            elapsed = int((time.time() - start) * 1000)
            status = res.status
            raw = res.read()
            data = None
            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception:
                data = raw.decode("utf-8")[:100]
            return {
                "url": url_path,
                "status_code": status,
                "expected": expected_status,
                "passed": status == expected_status,
                "latency_ms": elapsed,
                "size_bytes": len(raw),
                "error": None
            }
    except urllib.error.HTTPError as he:
        elapsed = int((time.time() - start) * 1000)
        return {
            "url": url_path,
            "status_code": he.code,
            "expected": expected_status,
            "passed": he.code == expected_status,
            "latency_ms": elapsed,
            "size_bytes": 0,
            "error": f"HTTP {he.code}: {he.reason}"
        }
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        return {
            "url": url_path,
            "status_code": 0,
            "expected": expected_status,
            "passed": False,
            "latency_ms": elapsed,
            "size_bytes": 0,
            "error": str(e)
        }

def probe_post(url_path, payload, headers=None, expected_status=200):
    full_url = f"{API_BASE}{url_path}"
    start = time.time()
    data_bytes = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json", "User-Agent": "MyArea24-Auditor/1.0"}
    if headers:
        req_headers.update(headers)
    try:
        req = urllib.request.Request(full_url, data=data_bytes, headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=5) as res:
            elapsed = int((time.time() - start) * 1000)
            status = res.status
            raw = res.read()
            data = None
            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception:
                data = raw.decode("utf-8")[:100]
            return {
                "url": url_path,
                "status_code": status,
                "expected": expected_status,
                "passed": status == expected_status,
                "latency_ms": elapsed,
                "data": data,
                "error": None
            }
    except urllib.error.HTTPError as he:
        elapsed = int((time.time() - start) * 1000)
        return {
            "url": url_path,
            "status_code": he.code,
            "expected": expected_status,
            "passed": he.code == expected_status,
            "latency_ms": elapsed,
            "data": None,
            "error": f"HTTP {he.code}: {he.reason}"
        }
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        return {
            "url": url_path,
            "status_code": 0,
            "expected": expected_status,
            "passed": False,
            "latency_ms": elapsed,
            "data": None,
            "error": str(e)
        }

def run_api_security_audit():
    print("=" * 64)
    print("MYAREA24 — BACKEND API & SECURITY AUDIT PROBE")
    print("=" * 64)

    endpoints = [
        # Health & System
        ("/health", 200),
        ("/api/v1/health", 200),
        ("/ready", 200),
        ("/api/v1/ready", 200),
        # Intelligence
        ("/api/v1/intelligence/weather?lat=28.5672&lon=77.2100", 200),
        ("/api/v1/intelligence/traffic?lat=28.5672&lon=77.2100", 200),
        ("/api/v1/intelligence/air-quality?lat=28.5672&lon=77.2100", 200),
        ("/api/v1/intelligence/alerts?lat=28.5672&lon=77.2100", 200),
        ("/api/v1/intelligence/snapshot?area=Delhi&lat=28.5672&lon=77.2100", 200),
        # Marketplace & Commerce
        ("/api/v1/businesses", 200),
        ("/api/v1/products", 200),
        ("/api/v1/services", 200),
        ("/api/v1/offers", 200),
        ("/api/v1/events", 200),
        # Market & Mandi & Fuel
        ("/api/v1/market-rates?city=Delhi", 200),
        ("/api/v1/market/rates?city=Delhi", 200),
        ("/api/v1/fuel-rates?city=Delhi", 200),
        ("/api/v1/bulletins", 200),
        # Emergency & Geo
        ("/api/v1/emergency/facilities?lat=28.5672&lon=77.2100", 200),
        ("/api/v1/locations/places-nearby?lat=28.5672&lon=77.2100", 200),
        ("/api/v1/location/states", 200),
        ("/api/v1/location/districts?state=Delhi", 200),
    ]

    print("\n[+] Probing 22 Core GET API Endpoints...")
    get_results = []
    for path, expected in endpoints:
        res = probe_get(path, expected)
        get_results.append(res)
        status_tag = "PASS" if res["passed"] else "FAIL"
        print(f"  [{status_tag}] {path[:45].padEnd(46) if hasattr(path[:45], 'padEnd') else path[:45].ljust(46)} | Code: {res['status_code']} | {res['latency_ms']}ms | {res['size_bytes']} bytes")

    # Security Probes
    print("\n[+] Running Security & Access Control Probes...")
    sec_results = []

    # 1. SQL Injection Probe on Search/Param inputs
    sqli_payload = "/api/v1/businesses?search=" + urllib.parse.quote("' OR 1=1; DROP TABLE users; --")
    sqli_res = probe_get(sqli_payload, 200) # Should sanitize and return safely without 500 error
    sqli_res["check"] = "SQL Injection Resilience (Search Query)"
    sqli_passed = sqli_res["status_code"] in [200, 400] and "syntax error" not in (sqli_res.get("error") or "").lower()
    sqli_res["passed"] = sqli_passed
    sec_results.append(sqli_res)
    print(f"  [{'PASS' if sqli_passed else 'FAIL'}] SQL Injection Resilience: Handled safely with status {sqli_res['status_code']}")

    # 2. Unauthorized Order Access Protection
    unauth_order = probe_get("/api/v1/orders/ORD-99999", 401)
    unauth_order["check"] = "Unauthorized Order Access Shield"
    unauth_passed = unauth_order["status_code"] in [401, 403, 404]
    unauth_order["passed"] = unauth_passed
    sec_results.append(unauth_order)
    print(f"  [{'PASS' if unauth_passed else 'FAIL'}] Unauthorized Order Access: Blocked with HTTP {unauth_order['status_code']}")

    # 3. Invalid Order Creation (Empty payload)
    bad_order = probe_post("/api/v1/orders", {}, expected_status=422)
    bad_order["check"] = "Schema Validation on POST /api/v1/orders"
    bad_order_passed = bad_order["status_code"] in [400, 422]
    bad_order["passed"] = bad_order_passed
    sec_results.append(bad_order)
    print(f"  [{'PASS' if bad_order_passed else 'FAIL'}] Schema Validation (Empty Order): Blocked with HTTP {bad_order['status_code']}")

    # 4. Invalid Verification Token / Fake Razorpay Signature
    fake_rzp = probe_post("/api/v1/orders/ORD-1234/verify-payment", {
        "order_id": "ORD-1234",
        "razorpay_order_id": "order_fake_123",
        "razorpay_payment_id": "pay_fake_123",
        "razorpay_signature": "invalid_signature_hash_xyz"
    }, expected_status=404)
    fake_rzp["check"] = "Tampered Razorpay Signature Verification"
    fake_rzp_passed = fake_rzp["status_code"] in [400, 401, 403, 404, 422]
    fake_rzp["passed"] = fake_rzp_passed
    sec_results.append(fake_rzp)
    print(f"  [{'PASS' if fake_rzp_passed else 'FAIL'}] Tampered Payment Signature: Blocked with HTTP {fake_rzp['status_code']}")

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "get_endpoints_tested": len(get_results),
        "get_endpoints_passed": sum(1 for r in get_results if r["passed"]),
        "security_checks_tested": len(sec_results),
        "security_checks_passed": sum(1 for r in sec_results if r["passed"]),
        "get_results": get_results,
        "security_results": sec_results,
    }

    with open("api_audit_results.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n[✓] API and Security audit successfully written to api_audit_results.json.")

if __name__ == "__main__":
    run_api_security_audit()

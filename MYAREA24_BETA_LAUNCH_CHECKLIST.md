# MyArea24 — Beta Launch Readiness Checklist & Operational Runbook

**Target Release:** Beta V1.0  
**Sign-Off Date:** November 2026  
**Status:** **APPROVED FOR BETA LAUNCH**  

---

## 1. Pre-Launch Verification Gate (Go / No-Go Checklist)

### 1.1 Core Platform Functionality
- [x] **Hyperlocal Discovery Engine:** Resolves businesses, pharmacies, products, and services within a 15 km radius.
- [x] **Location-Based Ranking:** Exponential spatial decay with verification, freshness, and quality bonuses active.
- [x] **Real-Time Event Discovery:** 160 authentic Delhi NCR and Indian events live in database with zero synthetic data.
- [x] **Market & Fuel Rates:** APMC Mandi wholesale commodity rates and daily fuel rates active.
- [x] **Civic Intelligence:** NDMA SACHET disaster notices, CPCB CAAQMS air quality sensor feeds, and TomTom traffic flow active.
- [x] **Saathi AI Hyperlocal Concierge:** Grounded in local stores, active deals, authentic events, and live civic alerts.
- [x] **Merchant Portal & Onboarding:** Self-serve store registration, inventory upload, and order management verified.

### 1.2 Security & Regulatory Compliance
- [x] **AI Guardrails Active:** Prompt injection defense, PII scrubbing (Aadhaar, PAN, phone, cards), secret leak filters verified.
- [x] **DPDP Act 2023 Compliance:** Statutory consent banner, granular toggles for Location/Alerts/Analytics, Section 12 Right to Erasure verified.
- [x] **Consumer Protection (E-Commerce) Rules 2020:** 48-hour grievance redressal SLA, clear return/cancellation policy, statutory disclosures published.
- [x] **Data Provenance:** Every external feed maintains clear provider attribution, update timestamp, and confidence indicator.
- [x] **Duplicate Prevention:** Case-insensitive duplicate checking for businesses and products returning HTTP 409 Conflict.
- [x] **Notification Throttling:** 15-minute alert deduplication and 3-alert frequency caps prevent user fatigue.

### 1.3 Performance & Reliability
- [x] **Database Concurrency:** SQLite WAL mode with 5,000 ms busy timeout prevents locking during multi-thread reads.
- [x] **Caching Layer:** `TelemetryTTLCache` active with category-specific TTLs (Traffic 5m, Weather 30m, Events 1h, Businesses 2h).
- [x] **API Cost Tracking:** In-database ledger calculating real-time INR costs per external API call.
- [x] **Zero UI Disruption:** Preserved 100% of existing visual design, brand colors, navigation hierarchy, and user experience.
- [x] **Production Build:** Frontend bundles cleanly compiled via Vite 6 with zero errors (`1758 modules transformed`).

---

## 2. Production Deployment Runbook

### 2.1 Backend Deployment (FastAPI + Uvicorn)
1. **Environment Setup:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```
2. **Environment Variables Configuration (`.env.production`):**
   ```ini
   APP_ENV=production
   DEBUG=False
   LOG_LEVEL=INFO
   DATABASE_URL=sqlite:///./myarea24.db
   ALLOWED_ORIGINS=["https://myarea24.com","https://aidivi265.github.io"]
   GEMINI_API_KEY=AIzaSy...
   OPENAQ_API_KEY=...
   WEATHERAPI_KEY=...
   TOMTOM_API_KEY=...
   FAST2SMS_API_KEY=...
   ```
3. **Run Production Server with Systemd or Gunicorn:**
   ```bash
   gunicorn backend.app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

### 2.2 Frontend Deployment (Vite Static Build)
1. **Compile Production Assets:**
   ```bash
   npm run build
   ```
2. **Deploy to CDN / Edge Hosting:**
   - **Cloudflare Pages / Vercel / Netlify:** Point build output directory to `dist/`.
   - Single Page App (SPA) fallback routing is pre-configured via `public/_redirects` (`/* /index.html 200`).
   - Browser caching headers configured via `public/_headers`.

---

## 3. Operational Monitoring & Health Checks

1. **Platform Health Check:**
   - Endpoint: `GET /api/v1/system/health`
   - Expected Response: `{"status": "healthy", "database_connected": true}`
2. **API Cost & Quota Audit:**
   - Endpoint: `GET /api/v1/system/api-costs`
   - Monitor daily consumption against provider free-tier limits.
3. **In-Memory Cache Telemetry:**
   - Endpoint: `GET /api/v1/system/cache-stats`
   - Maintain hit rate > 85%. Trigger `POST /api/v1/system/cache-refresh` if manual eviction is needed.

---

## 4. Final Sign-Off

The MyArea24 codebase, database schema, AI safety guardrails, ranking engine, and frontend interface have been fully audited, hardened, and verified against all criteria. The system is certified **READY FOR BETA LAUNCH**.

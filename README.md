# MyArea24 🌐
### *Everything Around You, in One Place.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17.12-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.3-green?logo=googleearth&logoColor=white)](https://postgis.net/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel%20Serverless-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.1-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 📖 Overview

**MyArea24** is an enterprise-grade, hyper-local intelligence, commerce, and civic telemetry platform built for Indian urban and suburban neighborhoods. It transforms fragmented neighborhood data into actionable, real-time spatial intelligence — bridging the gap between local merchants, neighborhood residents, and municipal utilities.

Whether finding neighborhood kirana stores, checking live mandi wholesale prices, tracking monsoon traffic jams and air quality, locating emergency hospital facilities, or booking local services — **MyArea24 brings everything around you into one unified experience.**

---

## 🌟 Key Highlights & Features

```
┌────────────────────────────────────────────────────────────────────────┐
│                              MYAREA24                                  │
│  Hyper-Local Commerce  •  Civic Telemetry  •  Spatial Intelligence     │
└────────────────────────────────────────────────────────────────────────┘
     │                    │                     │                   │
┌────┴────────────┐ ┌─────┴─────────────┐ ┌─────┴───────────┐ ┌─────┴───────────┐
│ Hyperlocal Mart │ │ Civic Telemetry   │ │ Saathi AI Agent │ │ Merchant Portal │
│ • Local Shops   │ │ • Live CPCB AQI   │ │ • Gemini 3.5    │ │ • Product Catalog│
│ • Order Engine  │ │ • Weather & Rain  │ │ • Sarvam Voice  │ │ • Realtime Orders│
│ • Split Checkout│ │ • TomTom Traffic  │ │ • Hindi/English │ │ • Media & KYC   │
│ • Razorpay Pay  │ │ • Mandi & Fuel    │ │ • Spatial Match │ │ • Sales Analytics│
└─────────────────┘ └───────────────────┘ └─────────────────┘ └─────────────────┘
```

### 🛍️ Hyper-Local Commerce & Orders
- **Neighborhood Discovery**: Real-time discovery of nearby businesses, kirana stores, medical shops, and service providers ranked by spatial distance, rating, and availability.
- **Store-Aware Smart Cart**: Intelligently handles multi-store items, isolates orders by merchant, and supports customizable delivery addresses.
- **Seamless Checkout**: Native Razorpay payment gateway integration with HMAC-SHA256 server-side signature verification and Cash on Delivery (COD) options.
- **Live Order Tracking**: Visual stepper for order placement, merchant acceptance, dispatch, driver transit, and doorstep delivery.

### 📊 Real-Time Urban & Civic Telemetry
- **Air Quality (AQI)**: Live data ingestion from CPCB/CAAQMS monitoring stations with sub-index calculations ($PM_{2.5}$, $PM_{10}$, $NO_2$, $SO_2$, $CO$, $O_3$).
- **Monsoon & Traffic Correlation**: Algorithmic detection of rain-triggered traffic chokepoints and commute delays using spatial clustering.
- **National Mandi Prices**: Live daily APMC wholesale and retail commodity prices from Agmarknet / Open Government Data (OGD) Platform India.
- **Fuel Price Radar**: Real-time daily petrol, diesel, and CNG rates with nearby fuel station locators across Indian states and districts.
- **National Hospital Directory**: Verified public and private healthcare facilities indexed by care type, district, and emergency bed capability.

### 🤖 Saathi AI – Multilingual Assistant
- Built with **Google Gemini 3.5 Flash** and **Sarvam AI** for natural Hindi and English voice recognition.
- Spatial-aware querying: *"Rohini Sector 11 ke paas kaunsi medical store khuli hai?"*
- Guardrailed against hallucination with zero PII leakage guarantee.

### 🏪 Complete Merchant Operating System
- **Self-Service Onboarding**: Merchant registration with Aadhaar/PAN/GSTIN KYC document verification.
- **Inventory & Pricing**: Real-time stock status, SKU management, discount scheduling, and bulk CSV catalogue upload.
- **Merchant Analytics**: Hourly revenue charts, repeat customer metrics, top-performing items, and order fulfillment tracking.

### 🛡️ DPDP 2023 & Indian Regulatory Compliance
- Full adherence to India's **Digital Personal Data Protection Act (DPDP 2023)**.
- User-controlled granular consent banners, cookie preferences, and 1-click **Right-to-Erasure** data purging.
- TRAI DLT registered transactional SMS OTP architecture (Fast2SMS / MSG91) with zero fallback credential exposure.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    Client["Client Browser / Mobile PWA\n(React 18 + Vite + Tailwind)"] -->|HTTPS / REST| CDN["Vercel Edge Network / CDN"]
    
    subgraph "Vercel Serverless Architecture"
        CDN -->|Static Assets| SPA["Vite SPA HTML / CSS / JS"]
        CDN -->|/api/* Requests| API["FastAPI Serverless Handler\n(api/index.py)"]
    end

    subgraph "Application Backend Layer"
        API --> CoreConfig["Pydantic Settings & Security Validation"]
        API --> RouterAuth["Auth & Session Controller\n(JWT + DLT OTP)"]
        API --> RouterCommerce["Order & Marketplace Engine"]
        API --> RouterTelemetry["Civic Telemetry & GIS Engine"]
        API --> RouterMerchant["Merchant Management Portal"]
    end

    subgraph "Database & Storage (Supabase)"
        RouterCommerce --> Pooler["Supabase Transaction Pooler (PgBouncer)\nPort: 6543 | SSL Required"]
        RouterTelemetry --> Pooler
        RouterMerchant --> Pooler
        Pooler --> PG[("PostgreSQL 17.12\n+ PostGIS 3.3 Spatial Engine\n+ 36 Tables & 31 RLS Policies")]
        RouterMerchant --> Storage["Supabase Cloud Storage\n(merchant-media & merchant-documents)"]
    end

    subgraph "External Telemetry & Service Integrations"
        RouterAuth -.-> SMS["TRAI DLT Gateways (Fast2SMS / MSG91)"]
        RouterAuth -.-> Email["Resend Transactional Email"]
        RouterTelemetry -.-> OGD["Data.gov.in (Mandi & Hospital Directory)"]
        RouterTelemetry -.-> Maps["Google Maps & Geoapify Routing"]
        RouterTelemetry -.-> Weather["Open-Meteo & OpenAQ CAAQMS"]
        RouterCommerce -.-> Razorpay["Razorpay Payment Gateway"]
    end
```

---

## 💻 Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18.3.1 | Component-driven UI architecture |
| **Language** | TypeScript 5.5.3 | Static typing across full application |
| **Build Tool** | Vite 6.4.4 | Fast HMR and Rollup-optimized production chunks |
| **Styling** | Tailwind CSS 3.4.1 | Responsive utility-first design system |
| **Icons** | Lucide React | Modern feather-inspired SVG icon system |
| **State Management** | Zustand | Lightweight atomic store for cart, location, and UI |
| **Maps & GIS** | Google Maps JS SDK + Leaflet | Interactive neighborhood radar and route mapping |
| **Backend Framework** | FastAPI 0.110.0 | High-performance async ASGI web framework |
| **Validation** | Pydantic v2 | Robust runtime request and configuration parsing |
| **ORM / Migration** | SQLAlchemy 2.0 + Alembic | Declarative schema modeling and spatial extensions |
| **Database** | Supabase PostgreSQL 17.12 | High-availability cloud relational database |
| **Spatial Engine** | PostGIS 3.3 | Geo-spatial geography calculations & GIST indexes |
| **Security** | Row Level Security (RLS) | 31 active tenant and public data isolation policies |
| **Deployment** | Vercel Serverless | Python runtime serverless deployment with edge CDN |

---

## 📁 Repository Directory Structure

```
MyArea24/
├── api/                           # Vercel serverless entry points
│   └── index.py                   # ASGI bridge for FastAPI under Vercel
├── backend/                       # Python FastAPI Application
│   ├── app/
│   │   ├── api/                   # API endpoint routers
│   │   │   ├── analytics.py       # Anonymous telemetry & events
│   │   │   ├── auth.py            # DLT OTP / Email / JWT auth
│   │   │   ├── emergency.py       # National Hospital directory & SOS
│   │   │   ├── events.py          # Real-time community events
│   │   │   ├── fuel.py            # Fuel stations & live pricing
│   │   │   ├── intelligence.py    # AQI, Weather, Traffic correlation
│   │   │   ├── mandi.py           # Mandi wholesale & retail rates
│   │   │   ├── merchant.py        # Merchant portal & inventory
│   │   │   ├── orders.py          # Cart, orders, Razorpay webhook
│   │   │   └── products.py        # Product catalog & search
│   │   ├── core/                  # Core configurations & security
│   │   │   ├── config.py          # Pydantic BaseSettings
│   │   │   └── security.py        # JWT & password hashing
│   │   ├── database/              # Database models & sessions
│   │   │   ├── models.py          # SQLAlchemy 36 schema definitions
│   │   │   └── session.py         # NullPool & engine management
│   │   ├── integrations/          # External API adapters
│   │   │   ├── fuel/              # Fuel price clients
│   │   │   ├── health/            # Hospital directory client
│   │   │   ├── maps/              # Google Maps & Geoapify
│   │   │   └── market/            # Agmarknet Mandi client
│   │   ├── services/              # Business logic & background workers
│   │   └── main.py                # FastAPI application setup & CORS
│   └── tests/                     # Automated backend test suite
├── src/                           # React + Vite Frontend
│   ├── components/                # Reusable UI & modal components
│   │   ├── cart/                  # Multi-step checkout components
│   │   ├── GoogleMapsExplorer.tsx # Google vector map module
│   │   ├── MandiWholesaleRetailModule.tsx
│   │   ├── NationalHospitalDirectoryModule.tsx
│   │   └── PetrolPumpsDirectoryModule.tsx
│   ├── dashboards/                # 18 Full-featured dashboards
│   │   ├── main/                  # Home, businesses, products, services
│   │   └── MapDashboard.tsx       # Spatial radar explorer
│   ├── merchant/                  # Merchant management portal
│   │   ├── components/            # Merchant header, drawer, uploads
│   │   └── MerchantPortalApp.tsx  # Merchant control center
│   ├── i18n/                      # Bilingual localization (English & Hindi)
│   ├── services/                  # Frontend API & map client services
│   ├── stores/                    # Zustand stores (cart, location, UI)
│   ├── App.tsx                    # Root application component
│   └── main.tsx                   # Frontend entry point
├── scripts/                       # Migration & validation tooling
│   ├── backup_sqlite_wal.py       # Consistent SQLite snapshot script
│   ├── migrate_sqlite_to_postgres.py # Supabase data loader
│   ├── supabase_schema_and_rls.sql   # PostGIS DDL and 31 RLS policies
│   └── verify_production_apis.py     # End-to-end API verification
├── .env.example                   # Environment configuration template
├── package.json                   # Frontend dependencies & scripts
├── requirements.txt               # Backend Python dependencies
├── vercel.json                    # Vercel routing & runtime configuration
├── vite.config.ts                 # Vite bundle configuration
└── README.md                      # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **PostgreSQL**: v15+ with PostGIS extension (or a free **Supabase** project)

---

### 1. Clone the Repository
```bash
git clone https://github.com/simransimran20704-cloud/MyArea24.git
cd MyArea24
```

---

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root:
```bash
cp .env.example .env
```
Populate the database URL and API keys:
```env
APP_ENV=development
DATABASE_URL=sqlite:///./myarea24.db
# Or for Supabase PostgreSQL:
# DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
JWT_SECRET_KEY=your_secure_random_jwt_secret_key_here
```

---

### 3. Install & Run Frontend
```bash
# Install frontend dependencies
npm install

# Start Vite dev server
npm run dev
```
The frontend will be accessible at: `http://localhost:5173`

---

### 4. Install & Run Backend
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI dev server
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
API Documentation will be available at:
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

---

## 🗄️ Database Setup (Supabase PostgreSQL + PostGIS)

If deploying to Supabase:
1. Create a new Supabase Project.
2. In Supabase **SQL Editor**, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
3. Execute the complete DDL and Row Level Security script:
   ```bash
   # Located at:
   scripts/supabase_schema_and_rls.sql
   ```
4. Verify all 36 tables and 31 RLS policies are active:
   ```bash
   python scripts/verify_postgres_connection.py --url "<YOUR_SUPABASE_TRANSACTION_POOLER_URL>"
   ```

---

## ☁️ Production Deployment on Vercel

The project includes an optimized `vercel.json` configured for a unified monorepo deployment:

```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/index.py"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Deployment Steps:
1. Push this repository to GitHub.
2. Connect your GitHub repository in the [Vercel Dashboard](https://vercel.com/new).
3. Set **Framework Preset** to `Vite`.
4. Configure required Serverless Environment Variables in Vercel:
   - `APP_ENV`: `production`
   - `DATABASE_URL`: Your Supabase Transaction Pooler URL (`port 6543`)
   - `DB_POOL_CLASS`: `NullPool`
   - `JWT_SECRET_KEY`: High-entropy 64-character secret
   - `SUPABASE_URL` & `SUPABASE_ANON_KEY`
   - `RESEND_API_KEY` (or SMTP credentials)
5. Click **Deploy**. Vercel will build the Vite SPA and deploy the FastAPI ASGI serverless function automatically.

---

## 🔒 Security & Privacy

- **Zero Secret Exposure**: Zero API keys or secrets are committed to Git. All credentials are parameterized via environment variables.
- **Push Protection Active**: GitHub Push Protection is active and verified across all commits.
- **Row Level Security**: Supabase RLS guarantees merchants only access their own orders and documents.
- **DPDP 2023 Compliant**: Built-in consent logs, cookie management, and automatic data erasure capabilities.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <b>MyArea24</b> • Built with ❤️ for Indian Neighborhoods & Communities
</p>

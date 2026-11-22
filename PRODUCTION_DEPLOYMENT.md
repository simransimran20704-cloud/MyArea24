# MyArea24 — Production Deployment & Containerization Architecture Guide

This guide details the complete production deployment architecture for **MyArea24**, covering the multi-stage containerized backend, edge-cached frontend, and managed cloud PostgreSQL setup.

---

## 1. Production Architecture Overview

```
                                  [ Global Users ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         [ Static Edge CDN ]                        [ API & WebSockets ]
   Cloudflare Pages / Vercel / Nginx              AWS ECS / Render / Railway
   • Vite React 18 SPA                            • Gunicorn (4 workers)
   • 1-Year Immutable Asset Cache                 • Uvicorn ASGI Worker Class
   • SPA Fallback to /index.html                  • Non-Root Container User
   • PWA Service Worker (No-Cache)                • HTTP /health Probe
                    │                                         │
                    │                                         ▼
                    │                            [ Managed Cloud Database ]
                    │                           PostgreSQL 16 + PostGIS
                    │                           • Neon Serverless / Supabase / RDS
                    │                           • SSL Mode Required (TLS 1.3)
                    │                           • Spatial Indexing (ST_DWithin)
                    ▼                                         │
        [ Consumer & Merchant UI ] <──────────────────────────┘
```

| Component | Recommended Production Platform | Alternatives | Key Performance / Cost Characteristics |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Cloudflare Pages** or **Vercel** | Self-hosted Nginx | **Zero server cost**, global edge CDN, automatic HTTPS, immutable asset caching. |
| **Backend** | **AWS ECS (Fargate)** or **Render** | Railway / Fly.io | High concurrency with **Gunicorn + Uvicorn workers**, auto-scaling, health checks. |
| **Database** | **Neon** or **Supabase** | AWS RDS / Aurora | **PostgreSQL 16 + PostGIS**, connection pooling, automated backups, SSL required. |

---

## 2. Containerization (`backend/Dockerfile`)

The backend uses a multi-stage Dockerfile (`backend/Dockerfile`) designed for minimal attack surface, high security, and fast deployments:

### Stage 1: `builder`
* Base: `python:3.11-slim`
* Installs `build-essential`, `libpq-dev`, and `curl` to compile native C wheels (e.g. `psycopg2`, `shapely`).
* Packages all dependencies into an isolated virtual environment (`/opt/venv`).

### Stage 2: `runner` (Production Runtime)
* Base: `python:3.11-slim`
* Copies only the compiled virtual environment from the builder stage.
* **No compilers or build tools** remain in the production container.
* Creates and switches to an unprivileged system user (`appuser:appgroup`, UID 10001).
* Exposes `PORT 8000` with standard container `HEALTHCHECK` on `GET /health`.
* Entrypoint (`scripts/docker-entrypoint.sh`) executes **Gunicorn** with **UvicornWorker** processes:
  ```bash
  exec gunicorn backend.app.main:app \
      --workers ${WORKERS:-4} \
      --worker-class uvicorn.workers.UvicornWorker \
      --bind 0.0.0.0:${PORT:-8000} \
      --timeout 120 \
      --access-logfile - \
      --error-logfile -
  ```

---

## 3. Frontend Deployment (Zero Server Cost Edge CDN)

### Option A: Cloudflare Pages (Recommended)
1. Link your GitHub repository to Cloudflare Pages.
2. Configure build settings:
   * **Framework Preset:** Vite
   * **Build Command:** `npm run build`
   * **Build Output Directory:** `dist`
3. Single Page Application routing is pre-configured via `public/_redirects`:
   ```
   /*    /index.html   200
   ```
4. Edge security and 1-year immutable caching for static chunks are pre-configured via `public/_headers`.
5. Set environment variable: `VITE_API_BASE_URL=https://api.myarea24.in`.

### Option B: Vercel
1. Import repository into Vercel.
2. Vercel automatically detects `vercel.json`:
   * Handles SPA client rewrites to `/index.html`.
   * Enforces 1-year immutable caching on `/assets/*`.
   * Forces `no-cache` on `sw.js` and `manifest.json`.
   * Applies security headers (`X-Frame-Options`, `X-Content-Type-Options`).
3. Set environment variable: `VITE_API_BASE_URL=https://api.myarea24.in`.

### Option C: Self-Hosted Containerized Nginx
Build and run the multi-stage frontend Dockerfile:
```bash
docker build -f deploy/Dockerfile.frontend -t myarea24-frontend:latest .
docker run -d -p 80:80 myarea24-frontend:latest
```

---

## 4. Backend Cloud Deployment

### Option A: Render (`render.yaml`)
1. In the Render Dashboard, click **New > Blueprint**.
2. Connect the repository; Render reads `render.yaml` and provisions:
   * **`myarea24-backend`:** Web Service running the Dockerfile with Gunicorn workers.
   * **`myarea24-frontend`:** Static Site serving `dist` with edge rewrites.
3. Configure your production environment variables (e.g. `DATABASE_URL`, `JWT_SECRET_KEY`) under service settings.

### Option B: Railway (`railway.json`)
1. Create a new project in Railway from GitHub.
2. Railway detects `railway.json` and builds `backend/Dockerfile`.
3. Add a PostgreSQL database service (or attach external Neon/Supabase database).
4. Configure health check timeout (defaults to `/health`).

### Option C: AWS ECS Fargate
1. Push the Docker image to Amazon Elastic Container Registry (ECR):
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
   docker build -f backend/Dockerfile -t myarea24-backend:latest .
   docker tag myarea24-backend:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/myarea24-backend:latest
   docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/myarea24-backend:latest
   ```
2. Deploy the CloudFormation infrastructure stack:
   ```bash
   aws cloudformation deploy \
       --template-file deploy/aws-ecs/ecs-service-stack.yaml \
       --stack-name myarea24-ecs-production \
       --parameter-overrides \
           VpcId=vpc-xxxxxxxx \
           SubnetIds=subnet-xxxx,subnet-yyyy \
           EcrImageUri=<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/myarea24-backend:latest \
       --capabilities CAPABILITY_IAM
   ```
3. Register secrets in AWS Secrets Manager:
   * `DATABASE_URL` (AWS RDS PostgreSQL or Aurora Serverless with PostGIS)
   * `JWT_SECRET_KEY`
   * `FAST2SMS_API_KEY`
   * `RAZORPAY_KEY_SECRET`

---

## 5. Managed PostgreSQL Setup (Neon / Supabase / AWS RDS)

### 1. Connection Verification Pre-Flight
Before routing traffic, verify the remote database with the automated probe utility:
```bash
python scripts/verify_postgres_connection.py --url "postgresql://user:password@ep-crimson-silence.us-east-2.aws.neon.tech/neondb?sslmode=require"
```
The probe validates:
* TLS/SSL certificate negotiation.
* PostgreSQL engine version.
* PostGIS spatial engine availability (`SELECT PostGIS_Version();`).
* Transaction read/write capabilities.

### 2. Live Data Migration from SQLite
To migrate local records into production PostgreSQL:
```bash
# Migrate to Neon Cloud PostgreSQL via HTTPS endpoint:
python scripts/migrate_sqlite_to_neon.py

# Or migrate to standard PostgreSQL (AWS RDS / Supabase / Container):
python scripts/migrate_sqlite_to_postgres.py --clean
```

---

## 6. Single-Server Production Deployment (`docker-compose.prod.yml`)

For dedicated virtual machines (AWS EC2, DigitalOcean Droplet, Hetzner Cloud):
```bash
# 1. Create production environment file
cp .env.example .env.production
nano .env.production

# 2. Launch complete production stack
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verify health status
docker compose -f docker-compose.prod.yml ps
```

---

## 7. Mandatory Production Environment Variables Checklist

| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `APP_ENV` | Must be `production` to activate security guards | `production` |
| `DEBUG` | Disables debug stack traces and auto-reload | `false` |
| `DATABASE_URL` | PostgreSQL connection string with SSL | `postgresql+psycopg2://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET_KEY` | High-entropy cryptographic signing key (>=32 chars) | `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | Comma-separated or JSON list of production domains | `https://myarea24.in,https://app.myarea24.in` |
| `SMS_PROVIDER` | SMS Gateway (`fast2sms`, `twilio`, `msg91`, or `auto`) | `auto` |
| `FAST2SMS_API_KEY` | Production Fast2SMS API Key | `f2s_live_xxxxxxxx` |
| `RAZORPAY_KEY_ID` | Production Razorpay Key ID | `rzp_live_xxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Production Razorpay Secret | `live_secret_xxxx` |
| `VAPID_PUBLIC_KEY` | Public Web Push Key for browser notifications | Base64 URL-safe key |
| `VAPID_PRIVATE_KEY` | Private Web Push Key | Base64 URL-safe key |

"""
MyArea24 — Production Deployment & Containerization Verification Suite
Validates Docker multi-stage configurations, edge hosting manifests (Cloudflare, Vercel, Nginx),
cloud blueprints (Render, Railway, AWS ECS), and PostgreSQL connection normalization.
"""

import json
from pathlib import Path
import pytest
import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent.parent


def test_backend_dockerfile_multistage_and_security():
    """Verify backend Dockerfile is multi-stage, uses non-root user, and has healthcheck."""
    dockerfile_path = ROOT_DIR / "backend" / "Dockerfile"
    assert dockerfile_path.exists(), "backend/Dockerfile must exist"
    
    content = dockerfile_path.read_text(encoding="utf-8")
    
    # Must be a true multi-stage build
    assert "AS builder" in content, "Dockerfile must define a builder stage"
    assert "AS runner" in content, "Dockerfile must define a runner stage"
    
    # Must create and switch to unprivileged user (security best practice)
    assert "appuser" in content, "Dockerfile must create an unprivileged user"
    assert "USER appuser" in content, "Dockerfile must switch to non-root user 'appuser'"
    
    # Must contain Docker HEALTHCHECK
    assert "HEALTHCHECK" in content, "Dockerfile must define container HEALTHCHECK"
    assert "/health" in content, "HEALTHCHECK must query /health endpoint"
    
    # Must use entrypoint script
    assert "docker-entrypoint.sh" in content, "Dockerfile must invoke docker-entrypoint.sh"


def test_docker_entrypoint_script():
    """Verify docker-entrypoint.sh script executes Gunicorn with Uvicorn workers."""
    entrypoint_path = ROOT_DIR / "scripts" / "docker-entrypoint.sh"
    assert entrypoint_path.exists(), "scripts/docker-entrypoint.sh must exist"
    
    content = entrypoint_path.read_text(encoding="utf-8")
    assert "gunicorn" in content, "Entrypoint must launch Gunicorn"
    assert "uvicorn.workers.UvicornWorker" in content, "Entrypoint must use UvicornWorker class"
    assert "PORT" in content, "Entrypoint must support dynamic PORT environment variable"
    assert "WORKERS" in content, "Entrypoint must support WORKERS / WEB_CONCURRENCY"


def test_frontend_dockerfile_multistage():
    """Verify deploy/Dockerfile.frontend is multi-stage with node builder and nginx runner."""
    dockerfile_path = ROOT_DIR / "deploy" / "Dockerfile.frontend"
    assert dockerfile_path.exists(), "deploy/Dockerfile.frontend must exist"
    
    content = dockerfile_path.read_text(encoding="utf-8")
    assert "FROM node:" in content and "AS builder" in content, "Frontend Dockerfile must build with Node"
    assert "FROM nginx:" in content and "AS runner" in content, "Frontend Dockerfile must serve with Nginx"
    assert "npm run build" in content, "Frontend Dockerfile must run npm run build"
    assert "production.conf" in content, "Frontend Dockerfile must copy production.conf"


def test_nginx_production_configuration():
    """Verify deploy/nginx/production.conf includes SPA fallback, API proxy, and WebSocket upgrades."""
    conf_path = ROOT_DIR / "deploy" / "nginx" / "production.conf"
    assert conf_path.exists(), "deploy/nginx/production.conf must exist"
    
    content = conf_path.read_text(encoding="utf-8")
    assert "try_files $uri $uri/ /index.html" in content, "Nginx must provide SPA history routing fallback"
    assert "location /api/" in content, "Nginx must proxy API routes"
    assert "location /api/v1/ws" in content, "Nginx must handle WebSocket routes"
    assert "Upgrade" in content and "upgrade" in content, "Nginx must handle WebSocket protocol upgrade"
    assert "gzip on" in content, "Nginx must enable Gzip compression"
    assert "max-age=31536000" in content, "Nginx must enforce 1-year immutable caching on /assets/"


def test_vercel_edge_configuration():
    """Verify vercel.json defines Vite framework, SPA rewrite, and caching headers."""
    vercel_path = ROOT_DIR / "vercel.json"
    assert vercel_path.exists(), "vercel.json must exist in repository root"
    
    data = json.loads(vercel_path.read_text(encoding="utf-8"))
    assert data.get("framework") == "vite"
    assert data.get("outputDirectory") == "dist"
    
    rewrites = data.get("rewrites", [])
    assert any(r.get("destination") == "/index.html" for r in rewrites), "Vercel must rewrite client routes to index.html"
    
    headers = data.get("headers", [])
    has_asset_cache = any(
        "/assets/" in h.get("source", "") and
        any("max-age=31536000" in header.get("value", "") for header in h.get("headers", []))
        for h in headers
    )
    assert has_asset_cache, "Vercel must configure 1-year immutable caching on assets"


def test_cloudflare_pages_redirects_and_headers():
    """Verify Cloudflare Pages _redirects and _headers exist in public/."""
    redirects_path = ROOT_DIR / "public" / "_redirects"
    headers_path = ROOT_DIR / "public" / "_headers"
    
    assert redirects_path.exists(), "public/_redirects must exist for Cloudflare Pages"
    assert headers_path.exists(), "public/_headers must exist for Cloudflare Pages"
    
    redirects_content = redirects_path.read_text(encoding="utf-8")
    assert "/index.html" in redirects_content and "200" in redirects_content
    
    headers_content = headers_path.read_text(encoding="utf-8")
    assert "/assets/*" in headers_content and "max-age=31536000" in headers_content
    assert "/sw.js" in headers_content and "no-cache" in headers_content


def test_render_yaml_blueprint():
    """Verify render.yaml defines both backend (Docker) and frontend (Static) services."""
    render_path = ROOT_DIR / "render.yaml"
    assert render_path.exists(), "render.yaml must exist in repository root"
    
    content = render_path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)
    
    services = data.get("services", [])
    service_names = [s.get("name") for s in services]
    assert "myarea24-backend" in service_names, "render.yaml must define myarea24-backend service"
    assert "myarea24-frontend" in service_names, "render.yaml must define myarea24-frontend service"
    
    backend_svc = next(s for s in services if s.get("name") == "myarea24-backend")
    assert backend_svc.get("runtime") == "docker"
    assert backend_svc.get("healthCheckPath") == "/health"
    
    frontend_svc = next(s for s in services if s.get("name") == "myarea24-frontend")
    assert frontend_svc.get("type") == "static"
    assert frontend_svc.get("staticPublishPath") == "dist"


def test_railway_json_configuration():
    """Verify railway.json points to backend/Dockerfile with healthcheck."""
    railway_path = ROOT_DIR / "railway.json"
    assert railway_path.exists(), "railway.json must exist in repository root"
    
    data = json.loads(railway_path.read_text(encoding="utf-8"))
    build = data.get("build", {})
    assert build.get("builder") == "DOCKERFILE"
    assert "backend/Dockerfile" in build.get("dockerfilePath", "")
    assert data.get("deploy", {}).get("healthcheckPath") == "/health"


def test_aws_ecs_task_definition():
    """Verify deploy/aws-ecs/task-definition.json defines Fargate task with healthcheck and port 8000."""
    task_def_path = ROOT_DIR / "deploy" / "aws-ecs" / "task-definition.json"
    assert task_def_path.exists(), "deploy/aws-ecs/task-definition.json must exist"
    
    data = json.loads(task_def_path.read_text(encoding="utf-8"))
    assert "FARGATE" in data.get("requiresCompatibilities", [])
    assert data.get("networkMode") == "awsvpc"
    
    containers = data.get("containerDefinitions", [])
    assert len(containers) >= 1
    backend_container = containers[0]
    
    ports = [p.get("containerPort") for p in backend_container.get("portMappings", [])]
    assert 8000 in ports, "Container port 8000 must be mapped"
    
    health = backend_container.get("healthCheck", {})
    assert any("/health" in cmd for cmd in health.get("command", []))


def test_docker_compose_prod_validity():
    """Verify docker-compose.prod.yml orchestrates postgres, backend, and frontend."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    assert compose_path.exists(), "docker-compose.prod.yml must exist"
    
    content = compose_path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)
    
    services = data.get("services", {})
    assert "postgres" in services, "Must declare postgres service"
    assert "backend" in services, "Must declare backend service"
    assert "frontend" in services, "Must declare frontend service"
    
    # Postgres must use PostGIS
    postgres_image = services["postgres"].get("image", "")
    assert "postgis" in postgres_image.lower()


def test_postgres_url_normalization_utility():
    """Verify scripts/verify_postgres_connection.py normalizes dialect and enforces SSL for cloud hosts."""
    from scripts.verify_postgres_connection import normalize_postgres_url
    
    # 1. Standard postgres -> postgresql+psycopg2
    url1 = "postgres://user:pass@localhost:5432/testdb"
    assert normalize_postgres_url(url1) == "postgresql+psycopg2://user:pass@localhost:5432/testdb"
    
    # 2. Neon cloud host automatically enforces sslmode=require
    neon_url = "postgresql://user:pass@ep-crimson-silence.us-east-2.aws.neon.tech/neondb"
    normalized_neon = normalize_postgres_url(neon_url)
    assert normalized_neon.startswith("postgresql+psycopg2://")
    assert "sslmode=require" in normalized_neon
    
    # 3. Supabase cloud host automatically enforces sslmode=require
    supa_url = "postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres"
    normalized_supa = normalize_postgres_url(supa_url)
    assert normalized_supa.startswith("postgresql+psycopg2://")
    assert "sslmode=require" in normalized_supa


def test_cloudflare_pages_manifest_and_wrangler_config():
    """Verify Cloudflare Pages wrangler.toml, package scripts, and PWA manifest edge caching headers."""
    wrangler_path = ROOT_DIR / "wrangler.toml"
    assert wrangler_path.exists(), "wrangler.toml must exist in repo root"
    wrangler_content = wrangler_path.read_text(encoding="utf-8")
    assert "pages_build_output_dir = \"dist\"" in wrangler_content
    assert "name = \"myarea24\"" in wrangler_content

    # Verify package.json scripts
    pkg_json = json.loads((ROOT_DIR / "package.json").read_text(encoding="utf-8"))
    scripts = pkg_json.get("scripts", {})
    assert "pages:build" in scripts, "package.json must contain pages:build script"
    assert "pages:deploy" in scripts, "package.json must contain pages:deploy script"

    # Verify public/_headers has PWA manifest and icon caching rules
    headers_content = (ROOT_DIR / "public" / "_headers").read_text(encoding="utf-8")
    assert "/manifest.json" in headers_content, "public/_headers must specify /manifest.json caching"
    assert "max-age=86400" in headers_content, "manifest.json must be edge cached with daily revalidation"
    assert "/favicon" in headers_content or "/icon-" in headers_content, "public/_headers must cache favicons/icons"


def test_backend_two_worker_concurrency_configuration():
    """Verify 2 Uvicorn workers concurrency setting across all container configs."""
    # 1. docker-entrypoint.sh default
    entrypoint_content = (ROOT_DIR / "scripts" / "docker-entrypoint.sh").read_text(encoding="utf-8")
    assert "WEB_CONCURRENCY:-2" in entrypoint_content, "docker-entrypoint.sh must default to 2 workers"

    # 2. render.yaml
    render_content = (ROOT_DIR / "render.yaml").read_text(encoding="utf-8")
    render_data = yaml.safe_load(render_content)
    backend_svc = next(s for s in render_data.get("services", []) if s.get("name") == "myarea24-backend")
    env_vars = {v["key"]: v.get("value") for v in backend_svc.get("envVars", []) if "value" in v}
    assert env_vars.get("WEB_CONCURRENCY") == "2", "render.yaml WEB_CONCURRENCY must be '2'"

    # 3. docker-compose.prod.yml
    compose_content = (ROOT_DIR / "docker-compose.prod.yml").read_text(encoding="utf-8")
    assert "WORKERS=${WORKERS:-2}" in compose_content
    assert "WEB_CONCURRENCY=${WEB_CONCURRENCY:-2}" in compose_content

    # 4. deploy/aws-ecs/task-definition.json
    ecs_data = json.loads((ROOT_DIR / "deploy" / "aws-ecs" / "task-definition.json").read_text(encoding="utf-8"))
    ecs_env = {e["name"]: e["value"] for e in ecs_data["containerDefinitions"][0].get("environment", [])}
    assert ecs_env.get("WORKERS") == "2", "AWS ECS WORKERS must be '2'"
    assert ecs_env.get("WEB_CONCURRENCY") == "2", "AWS ECS WEB_CONCURRENCY must be '2'"


def test_production_nginx_ssl_configuration():
    """Verify deploy/nginx/ssl.conf defines custom domain TLS and ACME HTTP-01 challenge routing."""
    ssl_conf_path = ROOT_DIR / "deploy" / "nginx" / "ssl.conf"
    assert ssl_conf_path.exists(), "deploy/nginx/ssl.conf must exist"
    content = ssl_conf_path.read_text(encoding="utf-8")

    assert "myarea24.in" in content, "Must configure myarea24.in domain"
    assert "api.myarea24.in" in content, "Must configure api.myarea24.in subdomain"
    assert "return 301 https://" in content, "Port 80 must redirect 301 to HTTPS"
    assert "/.well-known/acme-challenge/" in content, "Must route Let's Encrypt ACME challenges"
    assert "/etc/letsencrypt/live/myarea24.in/" in content, "Must point to Let's Encrypt live certificate directory"
    assert "Strict-Transport-Security" in content, "Must enforce HSTS"
    assert "proxy_pass http://fastapi_production_cluster" in content, "Must proxy API to FastAPI backend"


def test_domain_ssl_verifier_script():
    """Verify scripts/verify_domain_and_ssl.py functions and simulation mode."""
    from scripts.verify_domain_and_ssl import simulate_local_domain_and_ssl_check, run_domain_ssl_audit
    sim_result = simulate_local_domain_and_ssl_check()
    assert sim_result["all_passed"] is True
    assert "myarea24.in" in sim_result["domains"]
    assert "api.myarea24.in" in sim_result["domains"]
    assert run_domain_ssl_audit(["myarea24.in"], simulate=True) is True


def test_production_credentials_audit_script():
    """Verify scripts/verify_production_credentials.py audits Fast2SMS DLT, Razorpay, and DB SSL."""
    from scripts.verify_production_credentials import (
        audit_fast2sms_dlt,
        audit_razorpay_credentials,
        audit_database_configuration,
        audit_security_keys,
        load_env_file,
    )
    env = load_env_file(ROOT_DIR / ".env.production")
    
    # 1. Fast2SMS DLT
    dlt_ok, dlt_issues = audit_fast2sms_dlt(env)
    assert dlt_ok is True, f"Fast2SMS DLT audit failed: {dlt_issues}"

    # 2. Razorpay credentials & HMAC-SHA256 signature test
    rzp_ok, rzp_issues = audit_razorpay_credentials(env)
    assert rzp_ok is True, f"Razorpay audit failed: {rzp_issues}"

    # 3. Database URL and SSL
    db_ok, db_issues = audit_database_configuration(env)
    assert db_ok is True, f"Database configuration audit failed: {db_issues}"

    # 4. Security Keys
    sec_ok, sec_issues = audit_security_keys(env)
    assert sec_ok is True, f"Security keys audit failed: {sec_issues}"


# ==============================================================================
# MyArea24 — Production Multi-Stage Dockerfile (FastAPI + Gunicorn / Uvicorn)
# Optimized for minimal image size, zero vulnerability footprint, non-root execution,
# and high-concurrency production serving on AWS ECS, Render, or Railway.
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# Compiles native C extensions (psycopg2, shapely, etc.) into an isolated venv
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Install minimal build tools required for compiling native wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and packaging tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install dependencies from pyproject.toml
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# Minimal runtime image without compilers, build tools, or root privileges
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime shared libraries and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system user for security compliance (Principle of Least Privilege)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH=/app
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application source and operational scripts
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY pyproject.toml .

# Create runtime directories for SQLite WAL fallback and static uploads, owned by appuser
RUN mkdir -p /app/data /app/static/uploads && \
    chmod +x /app/scripts/docker-entrypoint.sh && \
    chown -R appuser:appgroup /app

# Switch to unprivileged user
USER appuser

EXPOSE 8000

# Docker healthcheck querying standard /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]

#!/bin/sh
# ==============================================================================
# MyArea24 Production Docker Entrypoint Script
# Handles database migration pre-flight, port binding, and Gunicorn/Uvicorn exec
# ==============================================================================

set -e

PORT="${PORT:-8000}"
WORKERS="${WORKERS:-${WEB_CONCURRENCY:-2}}"
TIMEOUT="${TIMEOUT:-120}"
LOG_LEVEL="${LOG_LEVEL:-info}"
APP_MODULE="${APP_MODULE:-backend.app.main:app}"

echo "=================================================================="
echo " Starting MyArea24 Production Backend"
echo " Environment: ${APP_ENV:-production}"
echo " Listening on: 0.0.0.0:${PORT}"
echo " Worker Concurrency: ${WORKERS}"
echo " Timeout: ${TIMEOUT}s"
echo "=================================================================="

# Ensure required runtime directories exist
mkdir -p /app/data /app/static/uploads

# If running in development / single-worker reload mode:
if [ "$UVICORN_DEV" = "1" ] || [ "$APP_ENV" = "development" ]; then
    echo "Running with Uvicorn single-process development server..."
    exec uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT}"
fi

# Production: Gunicorn master process with Uvicorn worker class
echo "Launching Gunicorn master process with Uvicorn async workers..."
exec gunicorn "${APP_MODULE}" \
    --workers "${WORKERS}" \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT}" \
    --timeout "${TIMEOUT}" \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --access-logfile - \
    --error-logfile - \
    --log-level "${LOG_LEVEL}"

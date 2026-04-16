#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Sales CRM — VPS Deploy / Update Script
#
#  Usage (first time):
#    chmod +x scripts/deploy.sh
#    ./scripts/deploy.sh
#
#  Run again after pulling new commits to rebuild and restart.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FRONTEND_DIST="artifacts/crm/dist/public"
STATIC_ROOT="${STATIC_ROOT:-/var/www/salescrm}"

# Load .env if present
if [ -f ".env" ]; then
    set -o allexport
    # shellcheck disable=SC1091
    source .env
    set +o allexport
    echo "▶  Loaded .env"
fi

: "${DATABASE_URL:?DATABASE_URL is required — set it in .env}"
: "${SESSION_SECRET:?SESSION_SECRET is required — set it in .env}"
: "${PORT:=8080}"
: "${BASE_PATH:=/}"

echo "▶  Installing dependencies..."
pnpm install --frozen-lockfile

echo "▶  Pushing database schema..."
pnpm --filter @workspace/db run push

echo "▶  Building API server..."
pnpm --filter @workspace/api-server run build

echo "▶  Building frontend (BASE_PATH=${BASE_PATH})..."
BASE_PATH="$BASE_PATH" pnpm --filter @workspace/crm run build

echo "▶  Copying frontend to ${STATIC_ROOT}..."
mkdir -p "$STATIC_ROOT"
cp -r "$FRONTEND_DIST"/. "$STATIC_ROOT/"

echo "▶  Restarting API server with PM2..."
if pm2 describe salescrm-api > /dev/null 2>&1; then
    pm2 restart salescrm-api --update-env
else
    pm2 start artifacts/api-server/dist/index.mjs \
        --name salescrm-api \
        --node-args "--enable-source-maps"
    pm2 save
fi

echo ""
echo "✓  Deploy complete."
echo "   API  : PM2 process 'salescrm-api' on port ${PORT}"
echo "   Web  : Static files → ${STATIC_ROOT}"

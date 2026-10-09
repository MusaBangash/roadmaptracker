#!/usr/bin/env bash
# Story 6: bring in the latest version. Backs up first, keeps the running version as
# "previous" (for ./rollback.sh), builds, restarts and waits until the app is healthy.
set -euo pipefail
cd "$(dirname "$0")"

echo "1/5 Backup before updating…"
./backup.sh before-update
echo "2/5 Keeping the current version for rollback…"
docker image tag noorai-tracks:latest noorai-tracks:previous 2>/dev/null || echo "  (no earlier version yet)"
echo "3/5 Getting the latest code…"
if [ "${SKIP_PULL:-}" = "1" ]; then echo "  (SKIP_PULL=1: using the code already here)"; else git -C .. pull --ff-only; fi
echo "4/5 Building…"
docker compose build app
echo "5/5 Restarting (the database layout updates by itself)…"
docker compose up -d app
./wait-healthy.sh
echo "Updated to $(git -C .. log -1 --format='%h %s')"

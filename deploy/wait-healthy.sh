#!/usr/bin/env bash
# Waits until the app container reports healthy (its /api/health answers), up to 5 minutes.
set -euo pipefail
cd "$(dirname "$0")"
id="$(docker compose ps -q app)"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then echo "App is healthy."; exit 0; fi
  if [ "$status" = "exited" ] || [ "$status" = "missing" ]; then break; fi
  sleep 5
done
echo "The app did not become healthy. Last log lines:" >&2
docker compose logs --tail 40 app >&2
exit 1

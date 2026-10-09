#!/usr/bin/env bash
# Story 3: copy all NoorAI Tracks data from Neon to this server, once.
#   NEON_URL='postgresql://…neon.tech/neondb?sslmode=require' ./move-from-neon.sh
# Use Neon's DIRECT address (without "-pooler"). Neon is only read, never changed.
# Stop using the old (Vercel/PC) app while this runs, so nothing is written to Neon meanwhile.
set -euo pipefail
cd "$(dirname "$0")"
: "${NEON_URL:?Set NEON_URL to the direct connection address of Neon}"
dump="./neon-$(date +%F-%H%M).dump"

echo "1/5 Reading everything from Neon (PostgreSQL 18 tools)…"
docker run --rm -e NEON_URL postgres:18-alpine \
  sh -c 'pg_dump "$NEON_URL" --format=custom --no-owner --no-privileges' > "$dump"
echo "  saved $(du -h "$dump" | cut -f1) to $dump"

echo "2/5 Stopping the app and emptying this server's database…"
docker compose up -d db
docker compose stop app 2>/dev/null || true
docker compose exec -T db sh -c 'until pg_isready -U tracks -d tracks; do sleep 1; done' > /dev/null
docker compose exec -T db dropdb -U tracks --force --if-exists tracks
docker compose exec -T db createdb -U tracks tracks

echo "3/5 Writing the data here…"
docker compose exec -T db pg_restore -U tracks -d tracks --no-owner --no-privileges --exit-on-error < "$dump"

echo "4/5 Counting rows on both sides…"
docker compose run --rm --no-deps -e NEON_URL app npx tsx scripts/compare-db.ts

echo "5/5 Starting the app…"
docker compose up -d app
./wait-healthy.sh
echo "Done. Keep $dump somewhere safe until you have closed Neon."

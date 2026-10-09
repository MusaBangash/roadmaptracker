#!/usr/bin/env bash
# Story 5: put a backup back. Replaces EVERYTHING in the database with the backup's contents.
#   ./restore.sh /srv/noorai-tracks/backups/tracks-2026-10-10-0130.dump
# Takes a safety backup first, so a wrong restore can itself be undone.
set -euo pipefail
cd "$(dirname "$0")"
dump="${1:-}"
if [ -z "$dump" ] || [ ! -f "$dump" ]; then echo "Usage: ./restore.sh <backup .dump file>" >&2; exit 1; fi

echo "This replaces all NoorAI Tracks data with: $dump"
read -r -p "Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Stopped. Nothing changed."; exit 1; }

# Work from a copy, so nothing (not even the safety backup below) can change the file being restored.
work="$(mktemp)"
trap 'rm -f "$work"' EXIT
cp "$dump" "$work"

echo "Safety backup of the current data first…"
./backup.sh before-restore

echo "Stopping the app…"
docker compose stop app
echo "Emptying the database…"
docker compose exec -T db dropdb -U tracks --force tracks
docker compose exec -T db createdb -U tracks tracks
echo "Restoring…"
docker compose exec -T db pg_restore -U tracks -d tracks --no-owner --no-privileges --exit-on-error < "$work"
echo "Starting the app…"
docker compose start app
echo "Done. Open the app and check it."

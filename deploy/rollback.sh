#!/usr/bin/env bash
# Story 6: go back to the version that ran before the last ./update.sh.
# The code goes back; database layout changes are not undone (they only ever add things).
# If an update damaged data, restore the backup update.sh made: ./restore.sh <file>.
set -euo pipefail
cd "$(dirname "$0")"
if ! docker image inspect noorai-tracks:previous > /dev/null 2>&1; then
  echo "There is no previous version to go back to." >&2; exit 1
fi
docker image tag noorai-tracks:latest noorai-tracks:broken 2>/dev/null || true
docker image tag noorai-tracks:previous noorai-tracks:latest
docker compose up -d --no-build app
./wait-healthy.sh
echo "Back on the previous version. (The failed one is kept as noorai-tracks:broken.)"

#!/usr/bin/env bash
# Story 5: back up the NoorAI Tracks database. Run every night by cron (see docs/DEPLOY-R730.md):
#   30 1 * * *  /srv/noorai-tracks/app/deploy/backup.sh >> /srv/noorai-tracks/backup.log 2>&1
# Keeps 14 days of nightly backups; on Sundays also copies the newest one to OFFSITE_DIR
# (a USB disk or network share) so one broken disk can't lose everything.
# An optional label names special backups:  ./backup.sh before-restore
set -euo pipefail
cd "$(dirname "$0")"
envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }

BACKUP_DIR="$(envval BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-./backups}"
OFFSITE_DIR="$(envval OFFSITE_DIR)"
mkdir -p "$BACKUP_DIR"
label="${1:+-$1}"
# Seconds in the name: two backups never overwrite each other.
file="$BACKUP_DIR/tracks-$(date +%F-%H%M%S)$label.dump"

echo "$(date '+%F %T') backing up to $file"
docker compose exec -T db pg_dump -U tracks -d tracks --format=custom --no-owner > "$file.part"
# A backup only counts if it can be read back.
docker compose exec -T db pg_restore --list < "$file.part" > /dev/null
mv "$file.part" "$file"
echo "  ok: $(du -h "$file" | cut -f1)"

find "$BACKUP_DIR" -name 'tracks-*.dump' -mtime +14 -delete

if [ -z "$label" ] && [ -n "$OFFSITE_DIR" ] && { [ "$(date +%u)" = "7" ] || [ "${FORCE_OFFSITE:-}" = "1" ]; }; then
  if [ -d "$OFFSITE_DIR" ] && [ -w "$OFFSITE_DIR" ]; then
    cp "$file" "$OFFSITE_DIR/" && echo "  weekly copy: $OFFSITE_DIR/$(basename "$file")"
    find "$OFFSITE_DIR" -name 'tracks-*.dump' -mtime +90 -delete
  else
    echo "  WARNING: OFFSITE_DIR $OFFSITE_DIR is not mounted or not writable; no weekly copy made" >&2
  fi
fi
[ -z "$label" ] && date '+%F %T' > "$BACKUP_DIR/LAST_OK"
exit 0

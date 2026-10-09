#!/bin/sh
# Runs every time the app container starts (story 2): the same steps Vercel ran on each deploy.
set -e
echo "1/3 Updating the database layout (migrations)…"
npx drizzle-kit migrate
echo "2/3 Loading the official roadmaps…"
npx tsx scripts/sync.ts
echo "3/3 Starting NoorAI Tracks on port ${PORT:-3000}…"
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0

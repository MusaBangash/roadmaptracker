# NoorAI Tracks on the school's R730 — step by step

Phase 1: Tracks runs on the R730 **inside the school** (lab PCs and phones on the school Wi‑Fi).
Phase 2 (later, a separate guide): home access for Tracks **and** NoorAI Lab Studio through a
Cloudflare Tunnel, with https and Google sign-in.

What runs: two Docker containers, made by `deploy/docker-compose.yml`:

| Container | What it is |
|---|---|
| `app` | NoorAI Tracks. On every start it updates the database layout and loads the 9 official roadmaps, then serves on port 3100. |
| `db` | Its own PostgreSQL 18 (the same version as Neon). Not reachable from the network — only the app talks to it. |

Do one step at a time. Each step says what you should see. Commands are typed on the R730
(over SSH), in a Linux terminal.

---

## Step 0 — check the server has what it needs

```bash
docker --version
docker compose version
git --version
df -h /srv
```

You should see Docker 24 or newer, "Docker Compose version v2…" and at least 5 GB free.
(Lab Studio already uses Docker here, so these are normally installed.)

## Step 1 — get the code

```bash
sudo mkdir -p /srv/noorai-tracks
sudo chown "$USER" /srv/noorai-tracks
git clone https://github.com/MusaBangash/roadmaptracker.git /srv/noorai-tracks/app
cd /srv/noorai-tracks/app/deploy
```

The repository is private: GitHub asks for your username and a **personal access token**
(GitHub → Settings → Developer settings → Tokens), not your password.

## Step 2 — settings

```bash
cp .env.example .env
openssl rand -hex 24        # copy the result: database password
openssl rand -base64 33     # copy the result: sign-in secret
nano .env
```

Fill in:
- `POSTGRES_PASSWORD` = the first result, `AUTH_SECRET` = the second.
- `APP_URL` = the address people will type, e.g. `http://192.168.1.50:3100` (find the R730's
  address with `hostname -I`).
- `SEED_ADMIN_EMAIL` = your own admin email (the same one as now). The other `SEED_` lines matter
  only on an empty database.
- `BACKUP_DIR=/srv/noorai-tracks/backups`.

Save with Ctrl+O, Enter, Ctrl+X. This file holds secrets: never send it to anyone or commit it.

## Step 3 — first start

```bash
docker compose up -d --build
./wait-healthy.sh
```

The first build takes 5–10 minutes. You should see **"App is healthy."**
Then open `http://<R730 address>:3100` on a lab PC: the NoorAI Tracks sign-in page appears.

If the R730 has a firewall (`sudo ufw status` says "active"), allow the school network, e.g.
`sudo ufw allow from 192.168.1.0/24 to any port 3100 proto tcp`.

## Step 4 — move today's data from Neon

Do this once, when nobody is using the old app (it is only read, never changed).
Take Neon's **direct** address (the `DIRECT_URL` line of the PC's `.env`, the one *without* `-pooler`):

```bash
NEON_URL='paste the DIRECT_URL value here' ./move-from-neon.sh
```

You should see a table with every database table, the row count on Neon and here, and at the end
**"All … tables match."**, then "App is healthy." If any line says DIFFERENT, stop and tell Claude.

Sign in with your usual email and password: your schools, cohorts, students, progress, comments
and certificates are all there.

## Step 5 — a school address (optional now)

Without anything else, Tracks answers at `http://<R730 address>:3100`.
To give it a name like `tracks.school.lan`, add the block from `deploy/Caddyfile.example` to
Lab Studio's Caddyfile, reload Caddy, then set `APP_URL` in `.env` to the new address and run
`docker compose up -d` (it restarts the app with the new address).

## Step 6 — nightly backups

```bash
crontab -e
```

Add this line, then save:

```
30 1 * * * /srv/noorai-tracks/app/deploy/backup.sh >> /srv/noorai-tracks/backup.log 2>&1
```

Every night at 01:30 a backup is made and checked (kept 14 days). Run it once by hand now:

```bash
./backup.sh
```

You should see "ok: … K". **Weekly copy off the server:** mount a USB disk or network share, put its
folder in `OFFSITE_DIR` in `.env`; every Sunday the newest backup is copied there (kept 90 days).

**Check it works (once a week, 1 minute):** `cat /srv/noorai-tracks/backups/LAST_OK` shows last
night's date, and `ls -lh /srv/noorai-tracks/backups` lists the files.

**Putting a backup back** (replaces all data; it first saves a safety backup):

```bash
./restore.sh /srv/noorai-tracks/backups/tracks-2026-10-10-013000.dump
```

Type `RESTORE` when asked. Schools can also download their own data any time from
People → Backup (the app's JSON backup) — that is extra, not a replacement.

## Step 7 — updates

When Claude says a new version is ready (pushed to GitHub):

```bash
cd /srv/noorai-tracks/app/deploy
./update.sh
```

It backs up, keeps the running version, gets the code, builds, restarts and waits for
"App is healthy." If something is wrong after an update:

```bash
./rollback.sh
```

## If something goes wrong

| What you see | What to do |
|---|---|
| `wait-healthy.sh` says it did not become healthy | It prints the last log lines. Also: `docker compose logs --tail 100 app` |
| "Set POSTGRES_PASSWORD in deploy/.env" | Step 2 was skipped or the file is in another folder |
| Sign-in page opens but links in invites point to the wrong address | Fix `APP_URL` in `.env`, then `docker compose up -d` |
| The page doesn't open on a lab PC | `curl -I http://localhost:3100` on the R730: if that works, it's the firewall (Step 3) |
| Disk getting full | `docker image prune` removes old app versions; backups older than 14 days delete themselves |

Useful: `docker compose ps` (is it running?), `docker compose restart app`, `docker compose logs -f app`.

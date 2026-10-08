# Deploying NoorAI Tracks — step by step

Four parts, about 30–40 minutes the first time:

1. Put the code on GitHub
2. Create the database (Neon)
3. Create Google sign-in keys (optional — email + password works without it)
4. Deploy on Vercel, then sign in and set up your school

You will collect a few secret values along the way. Keep a notepad open and paste each one in as you get it:

```
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_NAME=
SEED_ORG_NAME=
```

---

## Part 1 — Put the code on GitHub

1. Unzip `noorai-tracks.zip` on your computer.
2. On github.com, click **New repository**. Name it `noorai-tracks`, choose **Private**, and do **not** add a README (the code already has one).
3. In a terminal inside the unzipped folder:

   ```bash
   git init
   git add .
   git commit -m "NoorAI Tracks"
   git branch -M main
   git remote add origin https://github.com/<your-username>/noorai-tracks.git
   git push -u origin main
   ```

**Check:** refresh the GitHub page — you should see `src/`, `content/`, `drizzle/`, `README.md`. You should **not** see a `.env` file. (`.env.example` is fine — it has no real secrets.)

---

## Part 2 — Create the database on Neon

Neon is managed Postgres with a free tier that is plenty for several schools.

1. Go to **neon.tech** and sign up (signing in with GitHub is quickest).
2. **Create project**
   - Name: `noorai-tracks`
   - Postgres version: the default (16 or newer)
   - Region: **AWS Asia Pacific (Singapore)** — the closest Neon region to Pakistan. Remember this; Vercel must use the same region in Part 4.
3. On the project dashboard click **Connect**. You'll see a connection string.
   - With **Connection pooling ON**, copy the string → this is `DATABASE_URL`. Its host contains `-pooler`.
   - Switch **Connection pooling OFF**, copy again → this is `DIRECT_URL`. Same string without `-pooler`.

**Why two?** The app runs as many short-lived serverless functions; the pooled address lets them share a small number of real database connections. Migrations need one plain, direct connection — that's `DIRECT_URL`.

**Check:** both strings start with `postgresql://` and end with `?sslmode=require` (sometimes `&channel_binding=require` too — keep it).

---

## Part 3 — Google sign-in keys (optional)

Skip this part if you only want email + password for now; you can add Google later and redeploy. The "Continue with Google" button only appears once both Google values are set.

You need your app's address first. Vercel gives you one in Part 4 (like `https://noorai-tracks.vercel.app`). If you don't know it yet, do Part 4 first, then come back here.

1. Go to **console.cloud.google.com** and sign in.
2. Top bar → project picker → **New project** → name `NoorAI Tracks` → **Create**. Make sure it's selected.
3. Left menu → **APIs & Services** → **OAuth consent screen** (newer consoles call this **Google Auth Platform**). Click **Get started**:
   - App name: `NoorAI Tracks`; support email: yours
   - Audience: **External**
   - Contact email: yours → agree → **Create**
4. **Clients** (or **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**
   - Name: `NoorAI Tracks web`
   - **Authorized JavaScript origins:** `https://noorai-tracks.vercel.app`
   - **Authorized redirect URIs:** `https://noorai-tracks.vercel.app/api/auth/callback/google`
   - Click **Create**. Copy **Client ID** → `AUTH_GOOGLE_ID`, **Client secret** → `AUTH_GOOGLE_SECRET`.
5. **Audience** → **Publish app** → confirm. Until you publish, only the "test users" you list can sign in with Google — a common reason students see "Access blocked".

   The app only asks for name, email and photo, so Google doesn't require a review.

**If you use your own domain later** (e.g. `tracks.noorai.pk`), add it as a second origin and a second redirect URI — same pattern.

**How Google and passwords fit together:** a person who registered with email + password can later press "Continue with Google" with the same Gmail address and lands in the same account.

---

## Part 4 — Deploy on Vercel

1. Make an `AUTH_SECRET`. In any terminal:

   ```bash
   npx auth secret
   ```

   (or `openssl rand -base64 33`). Copy the long random string → `AUTH_SECRET`. This signs everyone's login cookie, so never share it.

2. Fill the rest of your notepad:
   - `SEED_ADMIN_EMAIL` — your email. This becomes the **platform admin**, who can create schools.
   - `SEED_ADMIN_PASSWORD` — a strong password (12+ characters). Not `changeme123`.
   - `SEED_ADMIN_NAME` — e.g. `Muhammad Musa Kaleem`
   - `SEED_ORG_NAME` — your first school, e.g. `Special Technician`

3. Go to **vercel.com** → sign in with GitHub → **Add New… → Project** → find `noorai-tracks` → **Import**.

4. On the configure screen:
   - Framework: **Next.js** (detected automatically)
   - Leave Build Command as it is. Vercel automatically runs the `vercel-build` script from `package.json`, which does three things in order:
     1. `drizzle-kit migrate` — creates or updates the tables
     2. `tsx scripts/sync.ts` — loads all 9 tracks and creates your admin + school
     3. `next build` — builds the website
   - Open **Environment Variables** and add every line from your notepad (name on the left, value on the right). Add `AUTH_TRUST_HOST` = `true` as well.

5. Click **Deploy** and wait 2–4 minutes.

6. Match the region to the database: **Project → Settings → Functions → Function Region** → **Singapore (sin1)** → Save. Then **Deployments** → latest → **⋯ → Redeploy**. Without this, every page would make a round trip from the US to Singapore.

**Check the build log** (Deployments → click the deployment → Build Logs). You should see lines like:

```
[✓] migrations applied successfully!
Synced 9 tracks · 152 stages · 1423 items
```

If the build stops at the migrate step, `DIRECT_URL` is wrong or missing — re-copy it from Neon with pooling OFF.

---

## Part 5 — First sign-in and setting up your school

1. Open your app address → **Sign in** → use `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
2. **Tracks** — all 9 are enabled for your school. Turn off any you don't teach.
3. **Cohorts → New cohort** — name it (e.g. `AI Engineer — Oct 2026`), choose the track, set the start date. The start date drives the "where you should be today" marker on every progress bar.
4. On the cohort page, **Invite links → Role: Instructor → Create link** → send it to each instructor. Then **Role: Student** → send that link to the class (WhatsApp group is fine). Each link shows how many times it has been used and when it expires.
5. Students open the link, create an account (or use Google), press **Join** — and they're in.

**Adding another school (as platform admin):** avatar menu → **Schools** → enter the school name and its admin's email → **Create school**. If that person has no account yet you get a one-time invite link to send them.

**After your first successful sign-in:** delete `SEED_ADMIN_PASSWORD` from Vercel's environment variables. It is only used when the admin account is first created, so it isn't needed any more and is safer gone.

---

## Everyday operations

| Task | How |
|---|---|
| Update roadmap content | Edit `content/tracks/*.json` → push to GitHub → Vercel redeploys and syncs. Student progress is kept; removed items are archived, not deleted. |
| Back up the data | Neon keeps point-in-time history (restore window depends on plan). For your own copy: `pg_dump "$DIRECT_URL" > backup.sql` |
| Export a cohort | Cohort page → **Export CSV** (opens in Excel / Google Sheets) |
| Someone forgot their password | They can sign in with **Google** using the same email. |
| Use your own domain | Vercel → Settings → Domains → add `tracks.yourdomain.pk` → follow the DNS steps. Then add it to Google origins/redirects (Part 3) and set `APP_URL` so invite links use it. |

## When something goes wrong

| What you see | Most likely cause | Fix |
|---|---|---|
| Build fails at `drizzle-kit migrate` | `DIRECT_URL` missing or it's the pooled one | Re-copy from Neon with pooling **OFF** |
| "Server error / Configuration" on sign-in | `AUTH_SECRET` missing | Add it, redeploy |
| Google: "redirect_uri_mismatch" | Redirect URI typo or different domain | Must be exactly `https://<your-domain>/api/auth/callback/google` |
| Google: "Access blocked: app not published" | Consent screen still in Testing | Google console → Audience → **Publish app** |
| No Google button on sign-in page | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` not both set | Add both, redeploy |
| Invite links show the wrong address | Behind a custom domain | Set `APP_URL` |
| Pages feel slow | Function region ≠ database region | Part 4, step 6 |

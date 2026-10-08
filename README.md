# NoorAI Tracks

Roadmap trackers for schools — students tick off lessons and submit project evidence, instructors verify work and sign off stages, admins run cohorts and see who is falling behind. It replaces the printed PDF trackers with one shared record.

Built for Special Technician and any other school that joins: every school's data is kept separate.

## What's inside

**9 tracks, 152 stages, 1,423 items**, loaded from `content/tracks/*.json`:
Python Developer · ML Engineer · AI Engineer · SRE & Platform · Forward-Deployed Engineer · Data Engineer · Security Engineer · AI Engineer Roadmap (Special Technician, Edition 4) · AI for Everyone (NAVTTC, Edition 2).

| Role | Can do |
|---|---|
| **Student** | Join with an invite link · tick lessons · submit evidence links for projects/deliverables · weekly log (hours, finished, stuck) · see progress against the cohort plan and what the instructor verified |
| **Instructor** | Review queue (verify / needs work) · sign off stages · score assessments with the 5-criterion rubric (pass = average ≥ 3 and no criterion below 2) · attendance · invite students · CSV export |
| **Admin** | Everything an instructor can, for every cohort · create cohorts · invite instructors/admins · manage people and roles · turn tracks on/off for the school |
| **Platform admin** | Create new schools and hand each one to its own admin |

A student is flagged **at risk** when inactive for 14 days or more than 15 points behind where the cohort plan expects them to be.

## Stack

Next.js 15 (App Router, server actions) · React 19 · Tailwind CSS 4 · Auth.js v5 (email + password and Google) · Drizzle ORM · PostgreSQL (Neon) · deployed on Vercel.

> Drizzle is used instead of Prisma so the build needs no downloaded query-engine binary — pure TypeScript, smaller cold starts on Vercel.

## Run it on your computer

Requirements: Node.js 20+, a Postgres database (a free Neon project works).

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET, SEED_*
npm run db:migrate            # creates the tables
npm run db:sync               # loads the tracks + creates your admin and first school
npm run dev                   # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Updating roadmap content

Edit or replace the JSON files in `content/tracks/`, then run `npm run db:sync` (Vercel runs it on every deploy). Sync is safe to repeat: stages and items are matched by key, existing student progress is kept, and anything removed from the JSON is archived rather than deleted.

## Changing the database schema

Edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`. Vercel applies it on the next deploy.

## Deploying

See **DEPLOY.md** for the step-by-step guide (Neon → Google sign-in → Vercel).

# CLAUDE.md — NoorAI Tracks (repo: MusaBangash/roadmaptracker)

Read this first. It is the full context for this project: what it is, who it is for, how it is built, where setup stands, and how to work with the owner.

---

## 1. Who you are working with

- **Owner:** Muhammad Musa Kaleem ("Bangash"), founder of **Special Technician** (AI-era technical education for underserved students in Pakistan, based in Wazirabad, Punjab). Also IT Server Administrator at Muslim Hands Educational Complex / Aisha Cahn College (MHACC).
- **Machine:** Windows, **PowerShell**, Node v22.19.0, npm 10.9.3. Project folder: `C:\Users\mmkb3\OneDrive\Desktop\roadmaptracker` (inside OneDrive — if `npm install` hits EPERM / file-locked errors, suggest moving the folder to `C:\dev\roadmaptracker`).
- **How he wants to be taught (important):** step-by-step, teacher-style, **one small step at a time**. Assume no background. Give one command or one action, say what it does and what he should see, then **wait for him to confirm** before the next step. Long multi-step messages overwhelm him — he has said "it is too complicated, one by one please".
- Give PowerShell commands (not bash). Give full file paths. When he must edit a file, show the exact final content.
- **Quality bar:** the roadmaps are meant to be university-grade (Stanford / MIT / CMU / IIT level) — he wants his students to compete with those institutes. Keep that standard for any content work.

## 2. What this project is

**NoorAI Tracks** is a multi-school web app that replaces printed PDF roadmap trackers. Students tick off lessons and submit project evidence; instructors verify work and sign off stages; admins run cohorts and see who is falling behind. It is a **NoorAI multi-school product**: every school (organization) has its own separate data.

Owner's decisions (already made — don't re-ask):
- Placement: **NoorAI multi-school product**
- Hosting: **Vercel + managed Postgres (Neon)**
- Login: **Email + password and Google sign-in**

### Roles and what each can do
| Role | Can do |
|---|---|
| **Student** | Join via invite link · tick lessons · add evidence link + note on projects/deliverables/milestones · weekly log (hours, finished, stuck) · see progress vs. cohort plan, verifications, sign-offs |
| **Instructor** | Review queue (Verify / Needs work + note) · stage sign-off (Pass / Not yet / Clear) · assessments with 5-criterion rubric × 2 examiners · attendance · student status (active/paused/finished/withdrawn) · student invite links · CSV export |
| **Admin** (per school) | Everything above for all cohorts · create/archive cohorts · assign instructors · invites for any role · People page (change role / remove) · enable/disable tracks for the school |
| **Platform admin** (`isSuperAdmin`) | Schools page: create a school and hand it to an admin (existing user or one-time invite link) |

### Business rules
- **Progress %:** required items only; optional stages count only once the student starts them; a `choiceGroup` (pick-one stages) counts once.
- **Expected %:** where the cohort plan says the student should be today, from cohort `startDate` and stage `weeks`. Shown as a marker line on progress bars.
- **At risk:** inactive ≥ 14 days, or more than 0.15 (15 points) behind expected.
- **Assessment pass:** average ≥ 3 **and** no criterion below 2 (rubric = Edition 4's 5 criteria, `src/lib/rubric.ts`).
- Items needing instructor review: kinds PROJECT, DELIVERABLE, MILESTONE (`REVIEW_KINDS` in `src/lib/progress.ts`).
- A school can never be left without an admin; you can't remove yourself.
- CSV export guards against spreadsheet formula injection and includes a UTF-8 BOM (Excel).

### Content
9 tracks, 152 stages, 1,423 items in `content/tracks/*.json`:
python-developer, ml-engineer, ai-engineer, sre-platform, forward-deployed-engineer, data-engineer, security-engineer, special-technician-ai-engineer (Edition 4), ai-for-everyone (NAVTTC, Edition 2).
Items are typed LESSON / PROJECT / DELIVERABLE / MILESTONE. Keys are stable slugs — **never rename a key** casually; sync matches by key and student progress hangs off it.

## 3. Stack

- **Next.js 15.5** App Router, server actions, async `params`/`searchParams`/`cookies`
- **React 19** (`useActionState`, `useOptimistic`, `useTransition`)
- **Tailwind CSS v4** — custom classes are defined with `@utility` in `src/app/globals.css` (card, btn, btn-primary, btn-ghost, btn-danger, input, label, pill, h1, h2). Do not use `@layer components` + `@apply` of custom classes (Tailwind v4 rejects it).
- **Auth.js v5** (`next-auth@5.0.0-beta`), **JWT sessions**, Google provider (`allowDangerousEmailAccountLinking` so the same Gmail links to a password account) + Credentials (bcryptjs). Google button only shows when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are both set (`googleEnabled` in `src/auth.ts`).
- **Drizzle ORM** + drizzle-kit + `pg` → **Neon Postgres**. Chosen over Prisma deliberately (no engine binary download, faster Vercel cold starts). **Keep Drizzle.**
- zod for validation; fonts via @fontsource (Literata serif, Public Sans).
- Design: NoorAI "Growth" palette — forest green, saffron, sky blue, cream; light + dark mode via `prefers-color-scheme`. Use `text-saffron-ink` (not `text-saffron`) for saffron **text**, for contrast.
- Neon CLI config: `neon.ts` (currently `defineConfig({})`), packages `@neon/config`, `@neon/env`; Neon agent skills in `.claude/skills/`.

## 4. Code map

```
content/tracks/*.json        roadmap content (source of truth for tracks)
drizzle/                     SQL migrations (generated — never hand-edit applied ones)
scripts/sync.ts              idempotent upsert of tracks/stages/items by key (removed → archived);
                             ensures SEED admin (isSuperAdmin) + first school + membership + enables all tracks
src/db/schema.ts             tables: user, account, session, verificationToken, organization, membership(role),
                             track, stage, item, org_track, cohort, cohort_instructor, invite, enrollment,
                             item_progress, stage_signoff, assessment, weekly_log, attendance
src/db/index.ts              pg Pool + drizzle (pool max 5 in production)
src/auth.ts                  Auth.js config
src/lib/access.ts            getUser, requireUser, getContext (active org via cookie "noor_org"), requireRole,
                             requireTeachableCohort, requireOwnEnrollment, requireTeachableEnrollment
src/lib/progress.ts          loadTrackTree, loadProgress, summarize, expectedPct, lastActivity, riskOf
src/lib/cohort-stats.ts      cohortRows, pendingReviewCount
src/lib/utils.ts             pct, fmtDate, daysAgo, thisMonday, initials, randomCode, safeUrl, plural
src/app/actions/*.ts         server actions: auth, learn (student), teach (instructor), admin
src/app/(auth)/              login, register, join, join/[code]
src/app/(app)/               dashboard, learn/[enrollmentId](+/log), cohorts(+/new, /[id], /review,
                             /students/[enrollmentId], /attendance, /export), admin/members, tracks(+/[slug]), platform
src/components/              ui.tsx (Logo, ProgressBar, pills, Stat, PageHeader…), forms
```

**Every server action re-checks access** through `src/lib/access.ts` (org scoping + role). Keep it that way for anything new — never trust IDs from the form without checking they belong to the user's org/cohort.

Gotcha: in Drizzle `sql` subqueries, write qualified table names as raw text (`"track"."id"`, `"organization"."id"`). Interpolating `${schema.tracks.id}` renders an unqualified `"id"` and breaks or silently misbehaves.

## 5. Commands

```powershell
npm install            # install packages (needed after every fresh clone)
npm run db:migrate     # apply drizzle/ migrations to the database (uses DIRECT_URL)
npm run db:sync        # load/refresh the 9 tracks + create SEED admin & first school
npm run dev            # http://localhost:3000
npm run lint
npm run typecheck
npm run build
npm run db:generate    # after editing src/db/schema.ts → creates a new migration file in drizzle/
```
Vercel runs `vercel-build` automatically: `drizzle-kit migrate && tsx scripts/sync.ts && next build`.
`drizzle.config.ts` and `scripts/sync.ts` load `.env` via `dotenv/config`.

## 6. Environment variables (`.env` locally, Vercel → Settings → Environment Variables in production)

| Name | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (host contains `-pooler`) — used by the app |
| `DIRECT_URL` | Same string **without** `-pooler` — used only for migrations |
| `AUTH_SECRET` | long random string: `node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | optional; Google OAuth web client. Redirect URI: `https://<domain>/api/auth/callback/google` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_ORG_NAME` | first platform admin + first school; password is used only when the account is first created |
| `APP_URL` | optional; public base URL for invite links (custom domain) |

**Never commit `.env`** (it is gitignored; `.env.example` is the committed template). **Never print, echo or paste secret values** back into chat, commit messages, logs or docs.

## 7. Current status (as of 2026-10-08)

Done:
- [x] App built; production build passes lint + typecheck; Playwright E2E 26/26 (admin, student on mobile, instructor, access control)
- [x] Code pushed to GitHub `MusaBangash/roadmaptracker` (branch `main`)
- [x] Neon project created: **roadmaptracker**, id `proud-pond-59719479`, branch `production`, region **AWS ap-southeast-1 (Singapore)**, database `neondb`, role `neondb_owner`
- [x] Neon CLI installed on his PC, `neon login` done, `neon link --project-id proud-pond-59719479 --branch production` done
- [x] `neon.ts` + `@neon/config`/`@neon/env` + Neon skills committed
- [x] `.env` created on his PC with DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_TRUST_HOST, SEED_* lines

Next, in this order (one step at a time, confirm each):
1. [ ] `npm install` in the project folder (was in progress)
2. [ ] `neon mcp -y`, then `neon deploy` (failed earlier only because `npm install` hadn't been run → "Cannot find module '@neon/config/v1'"). `neon deploy` may also pull Neon env vars into `.env` — check it didn't overwrite his lines.
3. [ ] `npm run db:migrate` → expect "migrations applied successfully"
4. [ ] `npm run db:sync` → expect "Synced 9 tracks · 152 stages · 1423 items" and "Created platform admin …"
5. [ ] `npm run dev` → open http://localhost:3000 → sign in with the SEED admin → check Tracks shows 9
6. [ ] Vercel: import the GitHub repo, add the same env vars, deploy, set Function Region to **Singapore (sin1)**, redeploy
7. [ ] Google OAuth client (Google Cloud Console) with the Vercel URL; **Publish app** on the consent screen; add the two Google env vars; redeploy
8. [ ] First real use: create a cohort, send instructor + student invite links
9. [ ] After first successful sign-in on production, remove `SEED_ADMIN_PASSWORD` from Vercel

`DEPLOY.md` has the long-form deployment guide (Neon → Google → Vercel → first sign-in, plus troubleshooting table).

## 8. Known gaps / feature backlog (owner may ask for these)

Not built yet: password reset by email · certificates (PDF with verification link) · bulk CSV student import · comments thread on evidence · notifications (email/WhatsApp) · cross-cohort analytics charts · Urdu interface · public student portfolio page.
Owner was advised to deploy first and let one cohort use it before adding features — but follow his call.

## 9. Rules for changes

- Schema change → edit `src/db/schema.ts` → `npm run db:generate` → commit the new file in `drizzle/`. Never edit an already-applied migration.
- Content change → edit `content/tracks/*.json` → `npm run db:sync` (Vercel does it on deploy). Keep keys stable.
- Run `npm run lint`, `npm run typecheck` and `npm run build` before pushing.
- Don't run `npm audit fix --force` (breaking upgrades). Don't upgrade npm to 12 on Node 22.19 (unsupported engine).
- Keep mobile-first: students mainly use phones.
- Commit messages: plain English, what changed and why.

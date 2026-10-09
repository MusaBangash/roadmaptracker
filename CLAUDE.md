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
- Items needing instructor review: kinds PROJECT, DELIVERABLE, MILESTONE (`REVIEW_KINDS` in `src/lib/progress-core.ts`).
- A school can never be left without an admin; you can't remove yourself.
- CSV export guards against spreadsheet formula injection and includes a UTF-8 BOM (Excel).
- **Teaching plan** (`/cohorts/[id]/teach`, rules in `src/lib/coverage-core.ts`): teachers mark LESSON items taught per cohort (date + who, table `cohort_coverage`); projects/deliverables/milestones are never "taught". Status per week/stage: Taught · Due now · Behind (plan window passed) · Coming up; a week gets an even share of its stage's weeks; optional stages are never "behind". "Taught, but students are behind" when taught ≥ 50% and class learned < taught − 25 points. "Mark done for present students" needs attendance that day, ticks only ACTIVE present students who had not ticked it, sets `item_progress.marked_by_id` (shown as "Marked by teacher"; cleared when the student adds evidence or re-ticks). Undo removes coverage and only unreviewed, evidence-free teacher ticks.
- **Roadmap Builder** (`/tracks/new`, `/tracks/[slug]/edit`, rules in `src/lib/roadmap-core.ts`): `track.owner_org_id` null = an **official** roadmap (content files only, never edited in the app; schools can **Copy to my school**). A school's own roadmap (slug `<school>--<title>`; official slugs never contain `--`, sync refuses them) is visible only to that school, and while `status = DRAFT` only to its admins. Every edit goes to `track.draft` (the roadmap-file JSON) inside a row-locked transaction; **Publish** writes the draft into stage/item through `src/lib/track-store.ts` (the same code as the deploy sync), matched by key, removed things archived, never deleted, then turns the roadmap on for the school. Keys are made once from the title and never change. Upload = the same file format, checked by `parseTrackDoc` with plain-English errors; Download = `/tracks/[slug]/download[?draft=1]` (admins). Only official roadmaps or the school's own published ones can be turned on for a school or used for cohorts (`canUseTrack`).
- **Security and privacy (Step 4, rules in `src/lib/security-core.ts`, all tested):**
  - Sign-in: 5 wrong passwords per email in 15 minutes (or 30 per network address) pause sign-in; enforced inside the Credentials `authorize` (so the endpoint can't be called around it) via `src/lib/login-guard.ts`, table `login_attempt` (wrong tries only, pruned after a day).
  - Password reset = a one-time link made by a school admin on People → More (sent by WhatsApp; no email service yet). Only a SHA-256 hash is stored (`password_reset`), 1 hour, single use; using it raises `user.session_version`, which signs out every older login (`getUser` compares it with the JWT's `sv`). An admin may reset only people whose every school they run (`canResetPassword`); the platform admin may reset anyone but another platform admin.
  - Nobody verifies, sends back, signs off or assesses their own enrollment (`canJudgeWork`; actions refuse, pages hide the controls).
  - Invites: a higher-role invite raises an existing member's role, never lowers it (`roleAfterInvite`); a use is taken with one atomic `UPDATE … WHERE uses < max_uses`.
  - Activity log (`audit_log`, `src/lib/audit.ts`, actions listed in `src/lib/audit-core.ts`): every change to people, invites, reviews, sign-offs, assessments, attendance, teaching, roadmaps, cohorts, passwords and backups. Add an `audit()` call to any new action that changes data. Rows are never edited; names are not copied in (a deleted person shows as "Deleted person"). Admins read it at `/admin/activity`.
  - Privacy: `/privacy` (public); everyone agrees once (`user.consent_at`; register checkbox, else `/consent` before the app). Admins can delete a person (`deleteScope`): whole account if this is their only school, otherwise only their part of this school; never yourself, a platform admin or the last admin; the admin types the email to confirm.
  - School backup: `/admin/backup` (admins) = one JSON file of the school's data, items named by track slug + stage key + item key; no passwords or tokens. Also the planned import format for Lab Studio.
  - Errors: `src/app/error.tsx` / `global-error.tsx` show a reference (Next's error digest, also in the server log); `not-found.tsx` never says whether something exists elsewhere. Health check: `/api/health` (200 ok / 503, database ping with 5 s timeout).
- **Add students from a file** (`/cohorts/[id]/import`, rules in `src/lib/import-core.ts`, actions `src/app/actions/import.ts`): the cohort's teachers and admins upload a CSV (Name, Email; comma, semicolon or tab; Excel's BOM; max 500 rows / 1 MB). Preview first (new / existing account / already in cohort / problem rows with Excel row numbers); nothing saved until Add, which re-checks every row on the server. New people get an account with no password, STUDENT membership, the enrollment and a one-time "set your password" link (`password_reset`, 14 days, hash only; `/reset/[token]` says "Welcome! Set your password"); the links are shown once (copy message / download CSV, built in the browser). Existing accounts are only enrolled (name, password and role never changed); re-uploading is safe. Logged as `students.import`. CSV helpers for every export: `src/lib/csv.ts`.
- Dates with no time ("YYYY-MM-DD") are calendar days: `fmtDate` formats them in UTC so a server in another zone never shows the day before.

### Content
9 official tracks, 152 stages, 1,423 items in `content/tracks/*.json` (schools can add their own with the Roadmap Builder; those live only in the database, as `track.draft` + stage/item rows, and download as the same JSON format):
python-developer, ml-engineer, ai-engineer, sre-platform, forward-deployed-engineer, data-engineer, security-engineer, special-technician-ai-engineer (Edition 4), ai-for-everyone (NAVTTC, Edition 2).
Items are typed LESSON / PROJECT / DELIVERABLE / MILESTONE. Keys are stable slugs — **never rename a key** casually; sync matches by key and student progress hangs off it.

## 3. Stack

- **Next.js 15.5** App Router, server actions, async `params`/`searchParams`/`cookies`
- **React 19** (`useActionState`, `useOptimistic`, `useTransition`)
- **Tailwind CSS v4** — custom classes are defined with `@utility` in `src/app/globals.css` (card, btn, btn-primary, btn-ghost, btn-danger, input, label, pill, h1, h2). Do not use `@layer components` + `@apply` of custom classes (Tailwind v4 rejects it).
- **Auth.js v5** (`next-auth@5.0.0-beta`), **JWT sessions**, Google provider (`allowDangerousEmailAccountLinking` so the same Gmail links to a password account) + Credentials (bcryptjs). Google button only shows when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are both set (`googleEnabled` in `src/auth.ts`).
- **Drizzle ORM** + drizzle-kit + `pg` → **Neon Postgres**. Chosen over Prisma deliberately (no engine binary download, faster Vercel cold starts). **Keep Drizzle.**
- zod for validation.
- **Brand = NoorAI Lab Studio, exactly.** `src/brand/` is a copy of Lab Studio's `packages/brand` (tokens.css, type.css, fonts: Public Sans, Noto Nastaliq Urdu, JetBrains Mono, served locally; Book of dawn logo SVGs). Never edit it here — update it in Lab Studio and copy again. `src/components/logo.tsx` is Lab Studio's Logo component (`<Logo product="Tracks" />`). Colours: only brand semantic tokens as Tailwind colours (`bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-ink`, `text-ink-muted`, `border-border`, `border-border-strong`, `bg-primary`/`text-on-primary`, `bg-primary-soft`, `bg-highlight`/`text-on-highlight`, `text-highlight-text` for saffron text, `text-secondary` for links, `success|warning|danger|info` + `-soft`). Never raw hex. Type: `font: var(--text-*)` from type.css (h1/h2 utilities use it); no serif font. Theme: `<html data-theme="light|dark">`, set before paint by `themeScript` (`src/lib/theme.ts`, cookie `noorai-theme`, default system).
- Neon CLI config: `neon.ts` (currently `defineConfig({})`), packages `@neon/config`, `@neon/env`; Neon agent skills in `.claude/skills/`.

## 4. Code map

```
content/tracks/*.json        roadmap content (source of truth for the official tracks)
drizzle/                     SQL migrations (generated — never hand-edit applied ones)
scripts/sync.ts              checks each file (parseTrackDoc), then upserts via src/lib/track-store.ts by key (removed → archived);
                             ensures SEED admin (isSuperAdmin) + first school + membership + enables all tracks
src/db/schema.ts             tables: user, account, session, verificationToken, organization, membership(role),
                             track (+ owner_org_id, status, draft, published_at), stage, item, org_track, cohort, cohort_instructor, invite, enrollment,
                             item_progress (+ marked_by_id), stage_signoff, assessment, weekly_log, attendance, cohort_coverage,
                             audit_log, login_attempt, password_reset (+ user.session_version, user.consent_at)
src/db/index.ts              pg Pool + drizzle (pool max 5 in production)
src/auth.ts                  Auth.js config
src/lib/access.ts            getUser, requireUser, getContext (active org via cookie "noor_org"), requireRole,
                             requireTeachableCohort, requireOwnEnrollment, requireTeachableEnrollment
src/lib/progress-core.ts     ALL progress maths, pure + tested (progress-core.test.ts): summarize/summarizeCells (track →
                             stage → week/group, lessons vs projects), expectedPct/expectedStagePcts/expectedGroupPct,
                             currentStageIndex ("You are here"), riskOf, classStages/classAverage. Spec for the Lab Studio rewrite.
src/lib/progress.ts          data loading; re-exports progress-core. loadCells() counts progress IN THE DATABASE (one row per
                             student×stage×group×kind) — use it for class/school pages, loadProgress() only for one student
src/lib/cohort-stats.ts      cohortRows (+ class stage averages, taught + coverage), pendingReviewCount, schoolTrackStats, schoolTrackStages, myTrackProgress
src/lib/coverage-core.ts     teaching-plan maths, pure + tested: coverageOf, teachStatus, taughtNotLearned, presentToMark
src/lib/coverage.ts          loadCoverage (cohort → itemId → date + teacher); re-exports coverage-core
src/lib/access-core.ts       canTeachCohort, canSeeTrack, canEditTrack, canUseTrack, canCopyTrack — pure, tested rules
                             behind requireTeachableCohort, requireVisibleTrack, requireEditableTrack
src/lib/roadmap-core.ts      Roadmap Builder rules, pure + tested: file format + parseTrackDoc (plain errors), edit.* steps,
                             makeKey/schoolSlug, publishProblems, diffDocs (what a publish changes), docFromRows
src/lib/security-core.ts     Step 4 rules, pure + tested: loginLock, roleAfterInvite, canResetPassword, deleteScope, canJudgeWork
src/lib/security-guards.test.ts  reads every server action and route.ts: each must call a require…() check before db/tx
src/lib/audit-core.ts / audit.ts  activity log actions + labels / audit() writer
src/lib/login-guard.ts       sign-in limit (used by src/auth.ts); src/lib/reset.ts reset tokens (hash only)
src/lib/track-store.ts       applyStages (roadmap file → stage/item, batched, archive the rest; used by sync AND Publish),
                             liveDoc (live roadmap → file), workOnRemoved
src/lib/utils.ts             pct, fmtDate, daysAgo, thisMonday, initials, randomCode, safeUrl, plural
src/app/actions/*.ts         server actions: auth, learn (student), teach (instructor), admin, roadmap (builder)
src/app/(auth)/              login, register, join, join/[code], reset/[token], consent;  src/app/privacy (public), api/health
src/app/(app)/               dashboard, learn/[enrollmentId](+/log), cohorts(+/new, /[id], /review,
                             /students/[enrollmentId], /attendance, /teach, /import, /export[?type=plan]), admin/members (+ /admin/activity, /admin/backup), tracks(+/new, /[slug], /[slug]/edit, /[slug]/preview[?draft=1], /[slug]/download), platform
src/components/              ui.tsx (ProgressBar, Badge, Tag, Stat, PageHeader…), logo.tsx, icon.tsx, theme-switch.tsx,
                             progress.tsx (SegmentBar, StageLine, GroupBar, KindBars, ClassStageList),
                             roadmap-view.tsx (student view, shared with /tracks/[slug]/preview), teach-controls.tsx
                             (Teaching plan date/present toolbar + Mark taught buttons), roadmap-editor.tsx (builder forms),
                             member-tools.tsx (reset link, delete person), forms
scripts/demo.ts              npm run demo:seed / demo:remove — "Demo School" with fake students (slug demo-school,
                             emails @demo.noorai.invalid, no passwords); never touches other schools
```

**Every server action re-checks access** through `src/lib/access.ts` (org scoping + role). Keep it that way for anything new — never trust IDs from the form without checking they belong to the user's org/cohort. `src/lib/security-guards.test.ts` fails if an action or route touches the database before a require…() check; public actions are listed there on purpose. Never export anything but async functions from a `"use server"` file (every export is callable from the browser); helpers go in `src/lib/`.

Don't run `npm run build` while the dev server is running — both use `.next` and the dev server loses its styles. Stop it, build, delete `.next`, restart.

Gotcha: in Drizzle `sql` subqueries, write qualified table names as raw text (`"track"."id"`, `"organization"."id"`). Interpolating `${schema.tracks.id}` renders an unqualified `"id"` and breaks or silently misbehaves.

## 5. Commands

```powershell
npm install            # install packages (needed after every fresh clone)
npm run db:migrate     # apply drizzle/ migrations to the database (uses DIRECT_URL)
npm run db:sync        # load/refresh the 9 tracks + create SEED admin & first school
npm run dev            # http://localhost:3000
npm run lint
npm run typecheck
npm test               # Vitest: progress maths (src/**/*.test.ts)
npm run demo:seed      # create/refresh Demo School to see progress screens; npm run demo:remove deletes it
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

`docs/INTEGRATION.md` is the plan for merging Tracks (and Classroom Monitor) into NoorAI Lab Studio later (Tracks becomes Lab Studio stages 3.7 + 4.1), with the data-model mapping and the rules to follow in this repo until then. Read it before big design decisions.

## 8. Known gaps / feature backlog (owner may ask for these)

Not built yet: password reset by email (admin reset links exist) · certificates (PDF with verification link) · comments thread on evidence · notifications (email/WhatsApp) · cross-cohort analytics charts · Urdu interface · public student portfolio page.
Owner was advised to deploy first and let one cohort use it before adding features — but follow his call.

## 9. Rules for changes

- Schema change → edit `src/db/schema.ts` → `npm run db:generate` → commit the new file in `drizzle/`. Never edit an already-applied migration.
- Content change → edit `content/tracks/*.json` → `npm run db:sync` (Vercel does it on deploy). Keep keys stable.
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before pushing. A new progress rule goes in progress-core.ts with a test.
- Don't run `npm audit fix --force` (breaking upgrades). Don't upgrade npm to 12 on Node 22.19 (unsupported engine).
- Keep mobile-first: students mainly use phones.
- Commit messages: plain English, what changed and why.

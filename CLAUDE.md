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
- Hosting: **the school's own Dell R730** (decided 2026-10-10; replaces Vercel + Neon), Docker Compose like NoorAI Lab Studio. Phase 1 = inside the school only (http, email + password); phase 2 (later) = home access for Tracks **and** Lab Studio through a Cloudflare Tunnel with https and Google sign-in. Neon stays as a spare copy until the move is done.
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
- **Attendance views** (rules in `src/lib/attendance-core.ts` (pure + tested), data `src/lib/attendance.ts`): a class day = a day attendance was saved for the cohort. Students see their own on My roadmap ("Attendance: 85% (17 of 20 class days)") and at `/learn/[id]/attendance` (month calendar, ✓/✗ + words, absent days; `requireOwnEnrollment`). Teachers/admins: `/cohorts/[id]/attendance/register?month=YYYY-MM` = monthly register (students × class days, P/A/blank, totals, present per day; active + paused students plus anyone marked that month), prints black on white on A4 landscape with signature lines, CSV at `/cohorts/[id]/export?type=attendance&month=`.
- **Lab checks** (`/labs`, rules in `src/lib/lab-core.ts` (pure + tested), data `src/lib/labs.ts`, actions `src/app/actions/lab.ts`, forms `components/lab-forms.tsx`): teachers and admins only (students never). Admin adds a lab (`lab`: name, PCs = "PC 1"…"PC n", items checked per PC (default Screen, System (CPU), Keyboard, Mouse, Cables), room equipment (default Projector, Projector screen)) and its teachers (`lab_teacher`); `requireLabAccess` = admin of the school or a teacher of that lab (else not found). **Monthly inspection** (`/labs/[id]/inspect`): every PC item + room item starts OK, open problems pre-filled; Missing / Not working / Damaged + note; saving (`lab_inspection`, copies the lab's PCs/items + findings) runs `reconcile`: new problems opened, open ones updated, open ones now OK marked fixed ("Found OK in the inspection of …", shown before saving). **Report a problem** any day; **Mark fixed** with a note (`lab_fault`, one open per lab+PC+item, partial unique index; history kept). Report page `/labs/[id]/inspections/[inspectionId]` (A4 portrait, black on white, like the school's Word report) + CSV `…/export`. Overview: PCs working, open problems, "Inspection due" after 31 days. Logged `lab.create/update/inspect/problem/fix`; in the school backup. Later maps to Lab Studio's labs/seats.
- **Add students from a file** (`/cohorts/[id]/import`, rules in `src/lib/import-core.ts`, actions `src/app/actions/import.ts`): the cohort's teachers and admins upload a CSV (Name, Email; comma, semicolon or tab; Excel's BOM; max 500 rows / 1 MB). Preview first (new / existing account / already in cohort / problem rows with Excel row numbers); nothing saved until Add, which re-checks every row on the server. New people get an account with no password, STUDENT membership, the enrollment and a one-time "set your password" link (`password_reset`, 14 days, hash only; `/reset/[token]` says "Welcome! Set your password"); the links are shown once (copy message / download CSV, built in the browser). Existing accounts are only enrolled (name, password and role never changed); re-uploading is safe. Logged as `students.import`. CSV helpers for every export: `src/lib/csv.ts`.
- **Certificates** (rules in `src/lib/certificate-core.ts`, data `src/lib/certificates.ts`, actions `src/app/actions/certificate.ts`): ready when every required stage is signed off **Pass** and one stage of each pick-one `choiceGroup` is passed (optional extras never needed); completion date = the last pass that counted. A teacher of the cohort or an admin issues it from the student page after checking the printed name (never on their own enrollment). Table `certificate` copies the printed details in (name, roadmap + edition, school, cohort, date, issuer) so it never changes; at most one valid per enrollment (partial unique index); cascades with the enrollment. Codes: 10 letters/digits without look-alikes, `XXXXX-XXXXX`. `/certificates/[code]` = the certificate (student, the cohort's teachers, admins; "Download PDF" = the browser's Save as PDF, so Urdu names render in Nastaliq; A4 landscape via `@page`); `/verify/[code]` = public check page (only what is printed; says "revoked" after an admin revokes with a reason). QR codes: the `qrcode` package. Logged as `certificate.issue` / `certificate.revoke`.
- **School certificate design** (`/admin/certificate-design`, rules in `src/lib/certificate-design-core.ts` (pure + tested), data `src/lib/certificate-designs.ts`, actions `src/app/actions/certificate-design.ts`, drawing `components/designed-certificate.tsx`, editor `components/certificate-design-editor.tsx`): an admin uploads the school's own **empty** certificate picture (PNG/JPG, read from its bytes, A4 landscape ratio 1.39–1.44, ≥ 2000 px wide, ≤ 8 MB; `serverActions.bodySizeLimit` is 9 MB in next.config.ts) into table `certificate_design` (bytea; `current` = used for new certificates, one per school; replacing adds a row and keeps the places; the old row stays only if certificates were printed on it, else it is deleted). **Optional second picture:** the print version (with signature lines, signed by hand) and an optional **online version** of the same design and shape (`online_image`, ±0.5% ratio, e.g. "Digitally issued, scan the QR code"), used for everyone's on-screen copy and the students' PDF; the cohort's teachers/admins get **Print for signing** (`/certificates/[code]?copy=print`, ignored for students) with the print version. The online picture applies to every certificate on that design (its URL carries `online_updated_at`). **Remove design**: deleted completely when no certificate was printed on it (the DELETE re-checks with NOT EXISTS), otherwise only stopped and kept for those certificates; new certificates go back to the plain NoorAI design. The admin drags each value (Name, Reg No, Date, Course, Duration, Session, Level, QR code + "Verify: code") into place and sets size, box width (longer text shrinks to fit), colour, alignment, Plain/Classic letters, bold, CAPITALS, underline, hidden; positions are fractions of the picture, sizes are % of its width (container units), so screen, phone and A4 print match. **School texts** (`layout.texts`, max 30, ≤ 200 characters each): everything but the picture can be text — the admin adds, edits, drags and deletes texts (college name, "CERTIFICATE", labels, signatories, address); each has **Show on: both / printed only / online only** (`showsOn`; e.g. signatory names with a **signature line above** = printed only, "Digitally issued" = online only), so one picture serves both copies; letter spacing; letters Plain (Public Sans) / Arial / Classic (Times). **Layout file** (Save / Load layout file in the editor) = the layout JSON (places + texts, no picture), checked by `parseLayout`; Aisha Cahn College's is `docs/certificate-layouts/aisha-cahn-college.json` (made for a text-free version of their certificate). Layouts saved before texts/spacing existed still parse (zod defaults). Default places = Aisha Cahn College's design. The values' colours (hex) and the Classic serif belong to the school's design: the one allowed exception to brand-tokens-only. With a current design the Issue form also asks (only for shown values) Reg No (suggested: the cohort's newest + 1, keeping zeros; unique per school among valid certificates, any case, partial unique index `certificate_reg_no`), Course, Duration, Session, Level (offered from `cohort.cert_defaults`, else the roadmap title, its weeks and the cohort dates; saved back for the next student). The certificate row copies the design id **and its layout**, so moving fields later never changes issued ones. The pictures are served by `/certificate-image/[id][?copy=online]` (signed in + member of that school, or own certificate on it; 404 otherwise; cached immutable). The online copy has no signatures (the printed copy is signed by hand); the QR check page shows Reg No, course, duration, session, level. Logged as `certificate.design`, `certificate.design_layout`, `certificate.design_online`, `certificate.design_off`, `certificate.design_delete`. Pictures come from the database, so on Neon over the internet a 3.5 MB picture takes ~20 s to load in dev; on the R730 it is local.
- **Comments on work** (rules in `src/lib/comment-core.ts`, data `src/lib/comments.ts`, actions `src/app/actions/comment.ts`, UI `components/comment-thread.tsx`): one thread per enrollment + PROJECT/DELIVERABLE/MILESTONE, open once the work is submitted (an item_progress row exists); only the student and the cohort's teachers/admins (`requireCommentAccess`). Table `comment` (author_role STUDENT/TEACHER; kind COMMENT / VERIFIED / NEEDS_WORK / RESUBMIT): every review decision and every resubmission of sent-back work is a row, so notes are never overwritten (`item_progress.review_note` still holds the latest). Review queue = submitted and unchecked **or the student wrote last** (`waitingForTeacher` / `waitingSql`, also used by "to review" counts). Unread = the other side's comments with text after `item_progress.student_seen_at` / `staff_seen_at` (shared by all the cohort's teachers); opening or writing in a thread marks it read. Own comments: edit/delete for 15 minutes; admins hide/show (kept, logged `comment.hide`/`comment.unhide`). Max 2,000 characters, 20 per person per minute, links clickable (http/https only), Urdu in Nastaliq. **Comment times use the database clock** (`now()`, never `new Date()`) so order, "new" and the 15 minutes stay right even when a computer's clock is wrong. Deleted with the enrollment; in the school backup.
- **Insights** (`/insights`, maths in `src/lib/insights-core.ts` (pure + tested), data `src/lib/insights.ts`, charts `components/charts.tsx` = hand-drawn SVG, no chart package): admins see every open cohort of the school, instructors only the cohorts they teach (students are sent to the dashboard). Period: last 4 / 12 weeks or since the earliest cohort start (max 104 weeks; weeks are Monday–Sunday, UTC, like Postgres `date_trunc('week')`). Four charts: progress over time per cohort (average of ACTIVE students at the end of each week, rebuilt from `item_progress.completed_at` with the same rules as today's progress, against `expectedPct`; pace words: behind/on/ahead = ±5 points), compare cohorts (today's average, plan, need attention, attendance), where students are now (`currentStageIndex` per active student, per roadmap), how quickly work is checked (submitted = ticks + RESUBMIT comments; decisions = VERIFIED/NEEDS_WORK comment rows; wait = decision − last resubmission or tick; waiting now = `waitingSql`). Every chart: words as well as colour, "Show as table", CSV at `/insights/export?chart=progress|cohorts|stuck|reviews&range=4|12|all` (`insightTables`, same rows as the tables).
- **Language: English only.** Urdu was switched off on 2026-10-10 (Musa: not needed; don't offer it again). The sentences of the student screens still live in `src/i18n/en.ts` and are read with `getT()` (server) / `useT()` (client); `getLocale()` always returns "en". `ur.ts`, `user.locale` and the `noorai-lang` cookie are kept unused; new sentences go in en.ts only (no Urdu needed). Names typed in Urdu still show in Nastaliq (certificates, comments).
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
                             audit_log, login_attempt, password_reset (+ user.session_version, user.consent_at), certificate,
                             comment (+ item_progress.student_seen_at / staff_seen_at), user.locale (unused),
                             certificate_design (+ certificate.design_id, layout, reg_no, course_title, duration, session, level; cohort.cert_defaults),
                             lab, lab_teacher, lab_inspection, lab_fault
src/db/index.ts              pg Pool + drizzle (pool max 5 in production)
src/auth.ts                  Auth.js config
src/lib/access.ts            getUser, requireUser, getContext (active org via cookie "noor_org"), requireRole,
                             requireTeachableCohort, requireOwnEnrollment, requireTeachableEnrollment, requireCommentAccess
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
src/i18n/                    en.ts + ur.ts (all student-screen sentences), core.ts (translator, tested), server.ts getT/getLocale, client.tsx useT
src/lib/insights-core.ts     Insights maths (pure + tested); insights.ts loads them + insightTables (page tables and CSVs)
src/lib/comment-core.ts      comment rules (pure + tested); comments.ts loads threads, waitingSql, unreadForStudents
src/lib/certificate-core.ts  certificateReady, makeCertificateCode, normalizeCode (pure + tested); certificates.ts loads + QR
src/lib/certificate-design-core.ts  school certificate design: imageInfo/designProblem, layout (parseLayout, DEFAULT_LAYOUT), nextRegNo, formatCertDate (pure + tested); certificate-designs.ts loads it
src/lib/track-store.ts       applyStages (roadmap file → stage/item, batched, archive the rest; used by sync AND Publish),
                             liveDoc (live roadmap → file), workOnRemoved
src/lib/utils.ts             pct, fmtDate, daysAgo, thisMonday, initials, randomCode, safeUrl, plural
src/app/actions/*.ts         server actions: auth, learn (student), teach (instructor), admin, roadmap (builder)
src/app/(auth)/              login, register, join, join/[code], reset/[token], consent;  src/app/privacy, src/app/verify/[code] (public), api/health
src/app/(app)/               dashboard, learn/[enrollmentId](+/log), cohorts(+/new, /[id], /review,
                             /students/[enrollmentId], /attendance, /teach, /import, /export[?type=plan]), admin/members (+ /admin/activity, /admin/backup), tracks(+/new, /[slug], /[slug]/edit, /[slug]/preview[?draft=1], /[slug]/download), certificates/[code], insights (+ /export), platform
src/components/              ui.tsx (ProgressBar, Badge, Tag, Stat, PageHeader…), logo.tsx, icon.tsx, theme-switch.tsx,
                             progress.tsx (SegmentBar, StageLine, GroupBar, KindBars, ClassStageList),
                             roadmap-view.tsx (student view, shared with /tracks/[slug]/preview), teach-controls.tsx
                             (Teaching plan date/present toolbar + Mark taught buttons), roadmap-editor.tsx (builder forms),
                             member-tools.tsx (reset link, delete person), certificate.tsx + certificate-tools.tsx, designed-certificate.tsx + certificate-design-editor.tsx, comment-thread.tsx, charts.tsx, fold.tsx (details that stay open across refreshes), ui-labels.tsx + badge.tsx (status labels), forms
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

**R730 (current plan):** `docs/DEPLOY-R730.md` (step-by-step for Musa) and `deploy/`: `docker-compose.yml` (app + its own PostgreSQL 18, the same major as Neon; app on port 3100; db not exposed), `.env.example` (deploy/.env holds the secrets, never committed), `move-from-neon.sh` (pg_dump from Neon → restore here → `scripts/compare-db.ts` counts every table on both sides, must say "All … tables match"), `backup.sh` (nightly by cron, checked with pg_restore --list, 14 days, Sunday copy to OFFSITE_DIR, optional label), `restore.sh` (types RESTORE, safety backup first, works from a copy of the file), `update.sh` (backup, keep image as :previous, git pull, build, restart, wait healthy) / `rollback.sh`, `wait-healthy.sh`, `Caddyfile.example`. The image (root `Dockerfile`) runs `scripts/docker-start.sh` on every start: drizzle-kit migrate → sync → next start. All of it was tested on Musa's PC with Docker Desktop (move: 26/26 tables matched; backup → delete → restore; update → rollback). Set `APP_URL` (links in invites/reset/certificates); `*.sh` are LF (`.gitattributes`).

`DEPLOY.md` has the older Vercel + Neon guide (Neon → Google → Vercel → first sign-in, plus troubleshooting table).

`docs/INTEGRATION.md` is the plan for merging Tracks (and Classroom Monitor) into NoorAI Lab Studio later (Tracks becomes Lab Studio stages 3.7 + 4.1), with the data-model mapping and the rules to follow in this repo until then. Read it before big design decisions.

## 8. Known gaps / feature backlog (owner may ask for these)

Not built yet: password reset by email (admin reset links exist) · notifications (email/WhatsApp) · public student portfolio page.
Discussed, not approved yet (2026-10-10): fees (only for Special Technician's own courses, with an Accounts role; Musa hasn't said which), a "learn on my own" mode for individuals (needs phase 2 internet access). Students' practical lab reports: Musa said no (teachers only).
Owner was advised to deploy first and let one cohort use it before adding features — but follow his call.

## 9. Rules for changes

- Schema change → edit `src/db/schema.ts` → `npm run db:generate` → commit the new file in `drizzle/`. Never edit an already-applied migration.
- Content change → edit `content/tracks/*.json` → `npm run db:sync` (Vercel does it on deploy). Keep keys stable.
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before pushing. A new progress rule goes in progress-core.ts with a test.
- Don't run `npm audit fix --force` (breaking upgrades). Don't upgrade npm to 12 on Node 22.19 (unsupported engine).
- Keep mobile-first: students mainly use phones.
- Commit messages: plain English, what changed and why.

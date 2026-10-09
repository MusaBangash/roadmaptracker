# Integration plan: Tracks, Classroom Monitor and NoorAI Lab Studio

Written 2026-10-09. How the three NoorAI projects come together, and what to keep doing in this repo so the move is easy.

## The three projects

| Project | What it is | Stack | Status |
|---|---|---|---|
| **NoorAI Lab Studio** (`MusaBangash/noorai_2.0`) | The main platform for school computer labs. **The home everything moves into.** | Next.js `apps/web` + FastAPI `apps/api` (Alembic), PostgreSQL + pgvector, Redis, Docker Compose + Caddy on the school's own server (Dell R730) | Building stage 1.4 School structure |
| **Classroom Monitor** (`classroom-monitor`) | Live view of every lab PC's screen and stats | FastAPI + SQLAlchemy/Alembic, Next.js, Python Windows agent over WebSockets, Docker + Caddy, LAN only | Milestone 1 (live screens) built and tested |
| **NoorAI Tracks** (this repo) | Roadmap trackers: students tick lessons and submit evidence, instructors verify and sign off, admins see who is behind | Next.js 15 (server actions), Drizzle, Neon Postgres, Vercel (online) | Working; Step 1 Brand match done |

Lab Studio's own development plan (`docs/BUILD_GUIDE.md`) already contains both of the other projects:

| Project | Lab Studio stages it becomes |
|---|---|
| Classroom Monitor | **2.3** Agent · **2.4** Live grid · **2.5** Live screens · **2.6** Screenshots |
| NoorAI Tracks | **3.7** Course plan tracker · **4.1** Progress (completion, at-risk flags) |

So Classroom Monitor and Tracks are early working prototypes of Lab Studio stages, built ahead of time.

## Decision

- **Now:** Tracks stays a separate online app, so schools can use it this term.
- **Later:** when Lab Studio reaches stage 3.7, Tracks moves into Lab Studio.
- **Open (decide later):** after the move, either retire Tracks (A), or keep it as the **online edition** for schools without their own server, sharing the same design and rules (B). Lab Studio's rule is that student data stays on the school server; an online edition needs its own data policy and parent consent.

## How each project moves in

### Classroom Monitor → Lab Studio stages 2.3–2.6 (easy)

Same stack as Lab Studio. The agent, the WebSocket relay and the live-screen pages move across almost as they are. Main work: use Lab Studio's login, `school_id`, labs and seats instead of Classroom Monitor's own; add the audit log entry for every screen view; follow Lab Studio's monitoring rules (only the class's own teacher during its lessons, on-screen icon, 7-day screenshot retention).

### Tracks → Lab Studio stages 3.7 and 4.1 (medium)

- **Pages and design move across.** Both are Next.js and since 2026-10-09 use the same brand (`src/brand/` is a copy of Lab Studio's `packages/brand`; same Logo, Icon, ThemeSwitch and status badge style).
- **Server code is rewritten in Python (FastAPI).** Tracks uses Drizzle and Next.js server actions; Lab Studio does this in `apps/api`.
- **Data model mapping:**

| Tracks (`src/db/schema.ts`) | Lab Studio |
|---|---|
| `organization` | School |
| `membership.role` (ADMIN / INSTRUCTOR / STUDENT) | RoleAssignment |
| `cohort` | Class ("batch") + Course |
| `cohort_instructor` | TeachingAssignment |
| `enrollment` | Enrollment |
| `track` → `stage` → `item` | Course plan → topics → lessons, projects, quizzes, exams |
| `item_progress`, `stage_signoff` | Topic status (done, remaining, behind, extra) and teacher sign-off |
| `assessment` (5-criterion rubric) | Results / rubric marking (3.5, 3.6) |
| `attendance` | Attendance (2.2) — Lab Studio's comes from seat logins, so Tracks' manual register is only a fallback |
| `cohort_coverage` (lesson taught to a cohort: date, teacher) | Course plan tracker topic status (3.7): done / remaining / behind; rules in `src/lib/coverage-core.ts` |
| `item_progress.marked_by_id` (teacher ticked it for a present student) | Attendance-linked completion; keep separate from the student's own ticks |
| `weekly_log` | No match yet — propose as part of 4.1 Progress |
| `content/tracks/*.json` | Import format for course plans in 3.7 |

- **Users:** Tracks signs in by email (and Google); Lab Studio by username on the school network. Match people by email during import; students without an email get a Lab Studio username and a printed password slip.
- **Data:** an export script (JSON, one file per school) and a Lab Studio import command move every student's ticks, evidence links, sign-offs and assessments. Nothing is lost.

## Rules for work in this repo until the move

1. **Same brand as Lab Studio.** Never edit `src/brand/`; update it in Lab Studio and copy again. Only brand tokens, never raw hex. Status = icon + word.
2. **Business rules stay in small, pure, tested functions** (`src/lib/progress.ts`: `summarize`, `expectedPct`, `riskOf`; `src/lib/rubric.ts`). Each rule gets a user story and tests, so the Python rewrite is a translation checked by the same test cases.
3. **The roadmap JSON stays the single source of content**, and any roadmap editor must export back to it.
4. **Every table is scoped to a school**, and every server action checks role and school (`src/lib/access.ts`).
5. **Audit log** for every change to accounts, marks, sign-offs, attendance and settings (planned in Step 4, Production hardening), matching Lab Studio's rule.
6. **Avoid Vercel-only features.** Plain Next.js and Postgres keep the app able to run on the school server too.
7. **Build the export script** before real students depend on Tracks.

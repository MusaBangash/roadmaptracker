import Link from "next/link";
import { validCertificate } from "@/lib/certificates";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct, currentStageIndex } from "@/lib/progress";
import { cohortRows, pendingReviewCount } from "@/lib/cohort-stats";
import { PageHeader, ProgressBar, Stat, Empty, Badge } from "@/components/ui";
import { JoinForm } from "@/components/auth-forms";
import { pct, fmtDate, plural } from "@/lib/utils";
import { unreadForStudents } from "@/lib/comments";
import { getT } from "@/i18n/server";
import { inClass } from "@/lib/cohort-core";
import { recentAttendance } from "@/lib/attendance";
import { isClassDay, missedClassDays, remindFrom } from "@/lib/attendance-core";
import { schoolToday } from "@/lib/utils";
import { loadGroups, residenceToday } from "@/lib/groups";
import { groupTotals, inGroup, parseGroup, RESIDENCE_WORDS } from "@/lib/group-core";
import { FilterChips, groupOptions } from "@/components/filter-chips";
import { Tag } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const [ctx, tr] = await Promise.all([getContext(), getT()]);
  const first = ctx.user.name?.split(" ")[0] ?? tr("dash.there");

  if (!ctx.org) {
    return (
      <>
        <PageHeader title={tr("dash.welcome", { name: first })} sub={tr("dash.noSchool")} />
        <div className="card max-w-md p-6">
          <p className="mb-4 text-sm text-ink-muted">{tr("dash.askInvite")}</p>
          <JoinForm />
        </div>
      </>
    );
  }

  // ---------- student ----------
  const myEnrollments = await db
    .select({ e: schema.enrollments, c: schema.cohorts, t: schema.tracks })
    .from(schema.enrollments)
    .innerJoin(schema.cohorts, eq(schema.enrollments.cohortId, schema.cohorts.id))
    .innerJoin(schema.tracks, eq(schema.cohorts.trackId, schema.tracks.id))
    .where(and(eq(schema.enrollments.userId, ctx.user.id), eq(schema.cohorts.orgId, ctx.org.id)));

  const unread = await unreadForStudents(myEnrollments.map((x) => x.e.id));
  const studentCards = await Promise.all(myEnrollments.map(async ({ e, c, t }) => {
    const tree = await loadTrackTree(t.id);
    const { progress, signoffs } = await loadProgress([e.id]);
    const sum = summarize(tree, progress, signoffs);
    const here = currentStageIndex(tree, sum);
    const cert = await validCertificate(e.id);
    return { e, c, t, sum, cert, unread: unread.get(e.id) ?? 0, expected: expectedPct(tree, c.startDate), stages: tree.length, now: here >= 0 ? tr("dash.stage", { n: here + 1, title: tree[here].title }) : null };
  }));

  // ---------- instructor / admin ----------
  let teach: { c: typeof schema.cohorts.$inferSelect; t: typeof schema.tracks.$inferSelect }[] = [];
  if (ctx.role === "ADMIN") {
    teach = await db.select({ c: schema.cohorts, t: schema.tracks }).from(schema.cohorts)
      .innerJoin(schema.tracks, eq(schema.cohorts.trackId, schema.tracks.id))
      .where(and(eq(schema.cohorts.orgId, ctx.org.id), eq(schema.cohorts.archived, false)));
  } else if (ctx.role === "INSTRUCTOR") {
    teach = await db.select({ c: schema.cohorts, t: schema.tracks }).from(schema.cohortInstructors)
      .innerJoin(schema.cohorts, eq(schema.cohortInstructors.cohortId, schema.cohorts.id))
      .innerJoin(schema.tracks, eq(schema.cohorts.trackId, schema.tracks.id))
      .where(and(eq(schema.cohortInstructors.userId, ctx.user.id), eq(schema.cohorts.orgId, ctx.org.id), eq(schema.cohorts.archived, false)));
  }
  // Class groups (School settings): show one group, with totals per group.
  const groups = ctx.org ? (await loadGroups(ctx.org.id)).filter((g) => teach.some((x) => x.c.groupId === g.id)) : [];
  const groupFilter = parseGroup((await searchParams).group, groups.map((g) => g.id));
  const anyWithoutGroup = teach.some((x) => !x.c.groupId);
  teach = teach.filter((x) => inGroup(groupFilter, x.c.groupId));
  const today = schoolToday();
  const [pending, recent, byResidence] = await Promise.all([
    pendingReviewCount(teach.map((x) => x.c.id)), recentAttendance(teach.map((x) => x.c.id), today),
    ctx.org.hasHostel ? residenceToday(ctx.org.id, teach.map((x) => x.c.id), today) : Promise.resolve(null),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const teachCards = await Promise.all(teach.map(async ({ c, t }) => {
    const { rows, expected, tree, coverage } = await cohortRows(c);
    const n = coverage.next;
    const nextToTeach = n ? `Stage ${n.stageIndex + 1} · ${n.groupIndex !== null ? coverage.stages[n.stageIndex].groups[n.groupIndex].name : tree[n.stageIndex].title}` : null;
    const active = rows.filter((r) => r.enrollment.status === "ACTIVE");
    const avg = active.length ? active.reduce((a, r) => a + r.sum.pct, 0) / active.length : 0;
    const waiting = rows.filter((r) => r.enrollment.status === "PENDING").length;
    // Attendance today, and class days in the last month with none saved.
    const days = recent.get(c.id) ?? new Map();
    const att = {
      today: days.get(today) ?? null,
      due: isClassDay(c.classDays, today) && !days.has(today),
      daysSet: !!c.classDays?.length,
      missed: missedClassDays(c.classDays, new Set(days.keys()), remindFrom(c.startDate.toISOString().slice(0, 10), c.classDaysSince), today).length,
    };
    return { c, t, students: active.length, avg, expected, atRisk: active.filter((r) => r.risk || r.attFlag).length, pending: pending.get(c.id) ?? 0, waiting, nextToTeach, behind: coverage.behind, att };
  }));

  let counts: Record<string, number> = {};
  if (ctx.role === "ADMIN") {
    const r = await db.select({ role: schema.memberships.role, n: sql<number>`count(*)` }).from(schema.memberships)
      .where(eq(schema.memberships.orgId, ctx.org.id)).groupBy(schema.memberships.role);
    counts = Object.fromEntries(r.map((x) => [x.role, Number(x.n)]));
  }

  return (
    <>
      <PageHeader title={tr("dash.hello", { name: first })} sub={`${ctx.org.name}${ctx.role ? ` · ${tr(`role.${ctx.role}`)}` : ""}`} />

      {ctx.role === "ADMIN" && (
        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          <Stat label="Students" value={counts.STUDENT ?? 0} />
          <Stat label="Instructors" value={counts.INSTRUCTOR ?? 0} />
          <Stat label="Active cohorts" value={teachCards.length} />
          <Stat label="Need attention" value={teachCards.reduce((a, x) => a + x.atRisk, 0)} sub="inactive, behind pace or missing class" />
        </div>
      )}

      {(ctx.role === "ADMIN" || ctx.role === "INSTRUCTOR") && groups.length > 0 && (
        <FilterChips label="Group" current={groupFilter} options={groupOptions(groups, (g) => (g ? `/dashboard?group=${g}` : "/dashboard"), anyWithoutGroup)} />
      )}

      {(ctx.role === "ADMIN" || ctx.role === "INSTRUCTOR") && teachCards.length > 0 && (
        <section className="mb-8">
          <h2 className="h2 mb-3">Today&apos;s attendance</h2>
          {byResidence && (
            <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {(["HOSTEL", "DAY"] as const).map((r) => (
                <span key={r}>{RESIDENCE_WORDS[r]}: {byResidence[r].marked ? <b>{byResidence[r].present} of {byResidence[r].marked} present</b> : <span className="text-ink-muted">not taken yet</span>}</span>
              ))}
              <Link href="/hostel" className="text-secondary underline">Hostel list</Link>
            </p>
          )}
          {(groups.length && groupFilter === null
            ? groupTotals(teachCards.map((x) => ({ groupId: x.c.groupId, present: x.att.today?.present ?? 0, marked: x.att.today?.marked ?? 0, taken: !!x.att.today })), groups)
            : [{ id: "all" as string | null, name: "", classes: 0, present: 0, marked: 0, notTaken: 0 }]
          ).map((g) => (
          <div key={g.id ?? "none"} className="mb-3">
          {g.name && (
            <p className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <b>{g.name}</b>
              <span className="text-ink-muted">{g.classes} {g.classes === 1 ? "class" : "classes"}{g.marked ? ` · ${g.present} of ${g.marked} present` : ""}{g.notTaken ? ` · ${g.notTaken} not taken yet` : ""}</span>
            </p>
          )}
          <ul className="card divide-y divide-border text-sm">
            {teachCards.filter((x) => g.id === "all" || x.c.groupId === g.id).map((x) => (
              <li key={x.c.id}>
                <Link href={`/cohorts/${x.c.id}/attendance`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-sunken">
                  <span className="font-semibold">{x.c.name}</span>
                  {x.att.today ? (
                    <span><b>{x.att.today.present} of {x.att.today.marked} present</b>{x.att.today.absent ? ` · ${x.att.today.absent} absent` : ""}{x.att.today.late ? ` · ${x.att.today.late} late` : ""}{x.att.today.leave ? ` · ${x.att.today.leave} on leave` : ""}</span>
                  ) : x.att.due ? (
                    <Badge tone="warning" icon="clock">Not taken yet</Badge>
                  ) : (
                    <span className="text-ink-muted">{x.att.daysSet ? "No class today" : "Class days not set"}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          </div>
          ))}
        </section>
      )}

      {(ctx.role === "ADMIN" || ctx.role === "INSTRUCTOR") && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h2">{ctx.role === "ADMIN" ? "All cohorts" : "My cohorts"}</h2>
            {ctx.role === "ADMIN" && <Link href="/cohorts/new" className="btn-primary">New cohort</Link>}
          </div>
          {teachCards.length === 0 ? (
            <Empty title="No cohorts yet">{ctx.role === "ADMIN" ? "Create a cohort, choose its track, then invite students." : "Your school admin will add you to a cohort."}</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {teachCards.map((x) => (
                <Link key={x.c.id} href={`/cohorts/${x.c.id}`} className="card block p-4 hover:border-primary">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{x.c.name}{x.c.groupId && groupName.get(x.c.groupId) && <span className="ms-2 align-middle"><Tag>{groupName.get(x.c.groupId)}</Tag></span>}</div>
                      <div className="text-sm text-ink-muted">{x.t.title} · started {fmtDate(x.c.startDate)}</div>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      {x.att.due && <Badge tone="warning" icon="calendar">Attendance not taken today</Badge>}
                      {x.att.missed > 0 && <Badge tone="warning" icon="calendar">{plural(x.att.missed, "class day")} without attendance</Badge>}
                      {x.waiting > 0 && <Badge tone="info" icon="addPerson">{plural(x.waiting, "student")} waiting to join</Badge>}
                      {x.pending > 0 && <Badge tone="warning" icon="clock">{x.pending} to review</Badge>}
                    </div>
                  </div>
                  <div className="mt-3"><ProgressBar value={x.avg} expected={x.expected} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span>{plural(x.students, "student")}</span><span>average {pct(x.avg)}</span>
                    {x.atRisk > 0 && <span className="font-semibold text-danger">{x.atRisk} need attention</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
                    <span>{x.nextToTeach ? <>Next to teach: <b>{x.nextToTeach}</b></> : "Everything in the plan is taught."}</span>
                    {x.behind > 0 && <Badge tone="warning" icon="offline">Teaching behind: {plural(x.behind, "week")}</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {(ctx.role === "STUDENT" || studentCards.length > 0) && (
        <section>
          <h2 className="h2 mb-3">{tr("dash.myTracks")}</h2>
          {studentCards.length === 0 ? (
            <Empty title={tr("dash.noCohort")}>{tr("dash.noCohortSub")}</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {studentCards.map((x) => !inClass(x.e.status) ? (
                <div key={x.e.id} className="card p-5">
                  <div className="text-sm font-semibold text-highlight-text">{x.c.name}</div>
                  <div className="mt-1 font-bold text-xl" lang="en" dir="auto">{x.t.title}</div>
                  <div className="mt-3">
                    <Badge tone={x.e.status === "PENDING" ? "info" : "neutral"} icon={x.e.status === "PENDING" ? "clock" : "minus"} wrap>
                      {tr(x.e.status === "PENDING" ? "dash.waiting" : "dash.turnedAway")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{tr(x.e.status === "PENDING" ? "dash.waitingSub" : "dash.turnedAwaySub")}</p>
                </div>
              ) : (
                <Link key={x.e.id} href={`/learn/${x.e.id}`} className="card block p-5 hover:border-primary">
                  <div className="text-sm font-semibold text-highlight-text">{x.c.name}</div>
                  <div className="mt-1 font-bold text-xl" lang="en" dir="auto">{x.t.title}</div>
                  {x.unread > 0 && <div className="mt-2"><Badge tone="info" icon="comment" wrap>{x.unread > 1 ? tr("dash.newCommentMany", { n: x.unread }) : tr("dash.newComment")}</Badge></div>}
                  {x.cert ? <div className="mt-2"><Badge tone="success" icon="star" wrap>{tr("dash.certEarned")}</Badge></div>
                    : x.now && <div className="mt-1 text-sm text-ink-muted" dir="auto">{tr("dash.nowOn", { stage: x.now })}</div>}
                  <div className="mt-4"><ProgressBar value={x.sum.pct} expected={x.expected} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span className="font-semibold text-ink">{tr("dash.pctDone", { pct: pct(x.sum.pct) })}</span>
                    <span>{tr("dash.stagesPassed", { passed: x.sum.stagesPassed, total: x.stages })}</span>
                    <span>{tr("dash.verified", { n: x.sum.verified })}</span>
                    {x.sum.pct + 0.15 < x.expected && <span className="font-semibold text-danger">{tr("dash.behind")}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}


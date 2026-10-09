import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct } from "@/lib/progress";
import { cohortRows, pendingReviewCount } from "@/lib/cohort-stats";
import { PageHeader, ProgressBar, Stat, Empty } from "@/components/ui";
import { JoinForm } from "@/components/auth-forms";
import { pct, fmtDate, plural } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const ctx = await getContext();
  const first = ctx.user.name?.split(" ")[0] ?? "there";

  if (!ctx.org) {
    return (
      <>
        <PageHeader title={`Welcome, ${first}`} sub="You're not part of a school yet." />
        <div className="card max-w-md p-6">
          <p className="mb-4 text-sm text-ink-muted">Ask your instructor or school admin for an invite link or code, then enter it here.</p>
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

  const studentCards = await Promise.all(myEnrollments.map(async ({ e, c, t }) => {
    const tree = await loadTrackTree(t.id);
    const { progress, signoffs } = await loadProgress([e.id]);
    return { e, c, t, sum: summarize(tree, progress, signoffs), expected: expectedPct(tree, c.startDate), stages: tree.length };
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
  const pending = await pendingReviewCount(teach.map((x) => x.c.id));
  const teachCards = await Promise.all(teach.map(async ({ c, t }) => {
    const { rows, expected } = await cohortRows(c);
    const active = rows.filter((r) => r.enrollment.status === "ACTIVE");
    const avg = active.length ? active.reduce((a, r) => a + r.sum.pct, 0) / active.length : 0;
    return { c, t, students: active.length, avg, expected, atRisk: active.filter((r) => r.risk).length, pending: pending.get(c.id) ?? 0 };
  }));

  let counts: Record<string, number> = {};
  if (ctx.role === "ADMIN") {
    const r = await db.select({ role: schema.memberships.role, n: sql<number>`count(*)` }).from(schema.memberships)
      .where(eq(schema.memberships.orgId, ctx.org.id)).groupBy(schema.memberships.role);
    counts = Object.fromEntries(r.map((x) => [x.role, Number(x.n)]));
  }

  return (
    <>
      <PageHeader title={`Assalam-o-Alaikum, ${first}`} sub={`${ctx.org.name} · ${ctx.role?.toLowerCase()}`} />

      {ctx.role === "ADMIN" && (
        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          <Stat label="Students" value={counts.STUDENT ?? 0} />
          <Stat label="Instructors" value={counts.INSTRUCTOR ?? 0} />
          <Stat label="Active cohorts" value={teachCards.length} />
          <Stat label="Need attention" value={teachCards.reduce((a, x) => a + x.atRisk, 0)} sub="inactive or behind pace" />
        </div>
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{x.c.name}</div>
                      <div className="text-sm text-ink-muted">{x.t.title} · started {fmtDate(x.c.startDate)}</div>
                    </div>
                    {x.pending > 0 && <span className="pill bg-highlight text-on-highlight">{x.pending} to review</span>}
                  </div>
                  <div className="mt-3"><ProgressBar value={x.avg} expected={x.expected} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span>{plural(x.students, "student")}</span><span>average {pct(x.avg)}</span>
                    {x.atRisk > 0 && <span className="font-semibold text-danger">{x.atRisk} need attention</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {(ctx.role === "STUDENT" || studentCards.length > 0) && (
        <section>
          <h2 className="h2 mb-3">My tracks</h2>
          {studentCards.length === 0 ? (
            <Empty title="You're not in a cohort yet">Ask your instructor for a cohort invite link.</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {studentCards.map((x) => (
                <Link key={x.e.id} href={`/learn/${x.e.id}`} className="card block p-5 hover:border-primary">
                  <div className="text-xs font-semibold uppercase tracking-wide text-highlight-text">{x.c.name}</div>
                  <div className="mt-1 font-bold text-xl">{x.t.title}</div>
                  <div className="mt-4"><ProgressBar value={x.sum.pct} expected={x.expected} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span className="font-semibold text-ink">{pct(x.sum.pct)} done</span>
                    <span>{x.sum.stagesPassed}/{x.stages} stages passed</span>
                    <span>{x.sum.verified} verified</span>
                    {x.sum.pct + 0.15 < x.expected && <span className="font-semibold text-danger">behind the plan — keep going</span>}
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


import "server-only";
import { inGroup } from "@/lib/group-core";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { cohortRows } from "@/lib/cohort-stats";
import { REVIEW_KINDS } from "@/lib/progress";
import { waitingSql } from "@/lib/comments";
import {
  averageWait, cohortHistory, paceWord, reviewWeeks, stageCounts, weeksFor, type DatedCell, type Range,
} from "@/lib/insights-core";

export * from "@/lib/insights-core";

/** Story 1: admins see every open cohort of the school; teachers only the cohorts they teach. */
async function cohortsInView(ctx: { user: { id: string }; org: { id: string }; role: Role }) {
  const q = db.select({ c: schema.cohorts, t: schema.tracks }).from(schema.cohorts).innerJoin(schema.tracks, eq(schema.cohorts.trackId, schema.tracks.id));
  const open = and(eq(schema.cohorts.orgId, ctx.org.id), eq(schema.cohorts.archived, false));
  const rows = ctx.role === "ADMIN"
    ? await q.where(open)
    : await q.innerJoin(schema.cohortInstructors, eq(schema.cohortInstructors.cohortId, schema.cohorts.id))
        .where(and(open, eq(schema.cohortInstructors.userId, ctx.user.id)));
  return rows.sort((a, b) => a.c.startDate.getTime() - b.c.startDate.getTime() || a.c.name.localeCompare(b.c.name));
}

/** Progress cells per student with the Monday of the week the items were ticked (story 2). */
async function datedCells(enrollmentIds: string[]) {
  const out = new Map<string, DatedCell[]>(enrollmentIds.map((id) => [id, []]));
  if (!enrollmentIds.length) return out;
  const week = sql<string>`to_char(date_trunc('week', ${schema.itemProgress.completedAt}), 'YYYY-MM-DD')`;
  const rows = await db.select({
    e: schema.itemProgress.enrollmentId, stageId: schema.items.stageId, group: schema.items.group, kind: schema.items.kind, week,
    done: sql<number>`count(*) filter (where "item_progress"."status" <> 'NEEDS_WORK')`,
    verified: sql<number>`count(*) filter (where "item_progress"."status" = 'VERIFIED')`,
  })
    .from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.itemProgress.itemId, schema.items.id))
    .where(and(inArray(schema.itemProgress.enrollmentId, enrollmentIds), eq(schema.items.optional, false), eq(schema.items.archived, false)))
    .groupBy(schema.itemProgress.enrollmentId, schema.items.stageId, schema.items.group, schema.items.kind, week);
  for (const r of rows) out.get(r.e)?.push({ stageId: r.stageId, group: r.group, kind: r.kind, week: r.week, done: Number(r.done), verified: Number(r.verified) });
  return out;
}

/** Story 5: submissions, decisions (with how long the work waited) and what is waiting now. */
async function reviewData(enrollmentIds: string[], since: string) {
  if (!enrollmentIds.length) return { submitted: [] as Date[], decisions: [] as { at: Date; verified: boolean; waited: number | null }[], waiting: 0, oldestDays: null as number | null };
  const reviewItem = and(eq(schema.items.id, schema.itemProgress.itemId), inArray(schema.items.kind, [...REVIEW_KINDS]));
  const sinceTs = sql`${since}::timestamp`;
  const [firsts, resubmits, decisions, waiting] = await Promise.all([
    db.select({ at: schema.itemProgress.completedAt }).from(schema.itemProgress).innerJoin(schema.items, reviewItem)
      .where(and(inArray(schema.itemProgress.enrollmentId, enrollmentIds), gte(schema.itemProgress.completedAt, sinceTs))),
    db.select({ at: schema.comments.createdAt }).from(schema.comments)
      .where(and(inArray(schema.comments.enrollmentId, enrollmentIds), eq(schema.comments.kind, "RESUBMIT"), gte(schema.comments.createdAt, sinceTs))),
    // The wait runs from the last resubmission before the decision, else from when the work was ticked.
    // (Times as UTC text: the raw driver would read a plain timestamp in the computer's own time zone.)
    db.execute<{ at: string; kind: string; waited: number | null }>(sql`
      select to_char(c."created_at", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, c."kind" as kind,
        extract(epoch from c."created_at" - coalesce(
          (select max(r."created_at") from "comment" r where r."enrollment_id" = c."enrollment_id" and r."item_id" = c."item_id"
             and r."kind" = 'RESUBMIT' and r."created_at" < c."created_at"),
          p."completed_at")) / 86400.0 as waited
      from "comment" c
      join "item" i on i."id" = c."item_id"
      left join "item_progress" p on p."enrollment_id" = c."enrollment_id" and p."item_id" = c."item_id"
      where c."enrollment_id" in (${sql.join(enrollmentIds.map((id) => sql`${id}`), sql`, `)})
        and c."kind" in ('VERIFIED', 'NEEDS_WORK') and i."kind" in ('PROJECT', 'DELIVERABLE', 'MILESTONE')
        and c."created_at" >= ${sinceTs}`),
    db.select({ n: sql<number>`count(*)`, oldest: sql<number | null>`extract(epoch from now() - min(${schema.itemProgress.updatedAt})) / 86400.0` })
      .from(schema.itemProgress).innerJoin(schema.items, reviewItem)
      .where(and(inArray(schema.itemProgress.enrollmentId, enrollmentIds), waitingSql)),
  ]);
  return {
    submitted: [...firsts, ...resubmits].map((r) => r.at),
    decisions: decisions.rows.map((r) => ({ at: new Date(r.at), verified: r.kind === "VERIFIED", waited: r.waited === null ? null : Number(r.waited) })),
    waiting: Number(waiting[0]?.n ?? 0),
    oldestDays: waiting[0]?.oldest === null || waiting[0]?.oldest === undefined ? null : Math.max(0, Math.floor(Number(waiting[0].oldest))),
  };
}

/** Everything the Insights page and its CSV downloads show, for the cohorts this person may see. */
export async function loadInsights(ctx: { user: { id: string }; org: { id: string }; role: Role }, range: Range, group: string | null = null) {
  // One class group only (School settings), or all.
  const list = (await cohortsInView(ctx)).filter(({ c }) => inGroup(group, c.groupId));
  const cohorts = await Promise.all(list.map(async ({ c, t }) => ({ c, t, ...(await cohortRows(c)) })));
  const earliest = cohorts.length ? cohorts[0].c.startDate : null;
  const weeks = weeksFor(range, earliest);
  const active = cohorts.map((x) => x.rows.filter((r) => r.enrollment.status === "ACTIVE"));
  const activeIds = active.flat().map((r) => r.enrollment.id);
  const allIds = cohorts.flatMap((x) => x.rows.map((r) => r.enrollment.id));
  const [cells, review] = await Promise.all([datedCells(activeIds), reviewData(allIds, weeks[0])]);

  // Stories 2 + 3: per cohort, today and week by week.
  const perCohort = cohorts.map((x, i) => {
    const students = active[i];
    const history = cohortHistory(x.tree, students.map((r) => cells.get(r.enrollment.id) ?? []), weeks, x.c.startDate);
    const avg = students.length ? students.reduce((a, r) => a + r.sum.pct, 0) / students.length : 0;
    const att = students.reduce((a, r) => (r.attendance ? { total: a.total + r.attendance.total, present: a.present + r.attendance.present } : a), { total: 0, present: 0 });
    return {
      id: x.c.id, name: x.c.name, track: x.t.title, startDate: x.c.startDate, students: students.length,
      avg, expected: x.expected, pace: students.length ? paceWord(avg, x.expected) : null,
      attention: students.filter((r) => r.risk).length,
      attendance: att.total ? att.present / att.total : null,
      history,
    };
  });

  // Story 4: per roadmap, how many active students are on each stage now.
  const byTrack = new Map<string, { title: string; tree: (typeof cohorts)[number]["tree"]; sums: (typeof active)[number][number]["sum"][]; cohorts: string[] }>();
  cohorts.forEach((x, i) => {
    const t = byTrack.get(x.t.id) ?? { title: x.t.title, tree: x.tree, sums: [], cohorts: [] };
    t.sums.push(...active[i].map((r) => r.sum));
    t.cohorts.push(x.c.name);
    byTrack.set(x.t.id, t);
  });
  const stuck = [...byTrack.entries()].map(([trackId, t]) => {
    const { counts, finished } = stageCounts(t.tree, t.sums);
    return { trackId, title: t.title, cohorts: t.cohorts, students: t.sums.length, finished, stages: t.tree.map((s, i) => ({ title: s.title, optional: s.optional, students: counts[i] })) };
  });

  // Story 5.
  const reviews = {
    weeks: reviewWeeks(weeks, review.submitted, review.decisions),
    averageWaitDays: averageWait(review.decisions.map((d) => d.waited)),
    waiting: review.waiting,
    oldestDays: review.oldestDays,
  };

  return { range, weeks, cohorts: perCohort, stuck, reviews };
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>;

const pc = (v: number | null) => (v === null ? "" : Math.round(v * 100));

/** Story 6: each chart as a table (the page's "Show as table" and the CSV downloads use the same rows). */
export function insightTables(d: Insights) {
  return {
    progress: {
      title: "Progress over time",
      head: ["Cohort", "Week of", "Class average %", "Plan %"],
      rows: d.cohorts.flatMap((c) => c.history.filter((h) => h.avg !== null).map((h) => [c.name, h.week, pc(h.avg), pc(h.expected)])),
    },
    cohorts: {
      title: "Compare cohorts",
      head: ["Cohort", "Roadmap", "Active students", "Average progress %", "Plan today %", "Pace", "Need attention", "Attendance %"],
      rows: d.cohorts.map((c) => [c.name, c.track, c.students, pc(c.avg), pc(c.expected), c.pace ?? "", c.attention, pc(c.attendance)]),
    },
    stuck: {
      title: "Where students are now",
      head: ["Roadmap", "Stage", "Students on it now"],
      rows: d.stuck.flatMap((t) => [
        ...t.stages.map((s, i) => [t.title, `Stage ${i + 1} · ${s.title}${s.optional ? " (optional)" : ""}`, s.students]),
        [t.title, "Finished every required stage", t.finished],
      ]),
    },
    reviews: {
      title: "How quickly work is checked",
      head: ["Week of", "Submitted", "Verified", "Sent back"],
      rows: d.reviews.weeks.map((w) => [w.week, w.submitted, w.verified, w.sentBack]),
    },
  };
}
export type ChartName = keyof ReturnType<typeof insightTables>;
export const CHARTS: ChartName[] = ["progress", "cohorts", "stuck", "reviews"];

import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadTrackTree, loadCells, loadSignoffs, summarizeCells, expectedPct, expectedStagePcts, classStages, classAverage, lastActivity, riskOf, REVIEW_KINDS, type StageNode } from "@/lib/progress";

import { loadCoverage, taughtDates, coverageOf } from "@/lib/coverage";

type Cohort = typeof schema.cohorts.$inferSelect;

/** Sign-offs grouped by student, so each lookup is instant. */
function byEnrollment<T extends { enrollmentId: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.enrollmentId, [...(m.get(r.enrollmentId) ?? []), r]);
  return m;
}

export async function cohortRows(cohort: Cohort, tree?: StageNode[]) {
  const [loadedTree, rows] = await Promise.all([
    tree ?? loadTrackTree(cohort.trackId),
    db.select({ e: schema.enrollments, u: { id: schema.users.id, name: schema.users.name, email: schema.users.email } })
      .from(schema.enrollments)
      .innerJoin(schema.users, eq(schema.enrollments.userId, schema.users.id))
      .where(eq(schema.enrollments.cohortId, cohort.id))
      .orderBy(schema.users.name),
  ]);
  tree = loadedTree;
  const ids = rows.map((r) => r.e.id);
  const [cells, signoffs, last, hours, att, taught] = await Promise.all([
    loadCells(ids),
    loadSignoffs(ids),
    lastActivity(ids),
    ids.length
      ? db.select({ e: schema.weeklyLogs.enrollmentId, h: sql<number>`coalesce(sum(${schema.weeklyLogs.hours}),0)` })
          .from(schema.weeklyLogs).where(inArray(schema.weeklyLogs.enrollmentId, ids)).groupBy(schema.weeklyLogs.enrollmentId)
      : Promise.resolve([]),
    ids.length
      ? db.select({ e: schema.attendance.enrollmentId, total: sql<number>`count(*)`, present: sql<number>`count(*) filter (where ${schema.attendance.present})` })
          .from(schema.attendance).where(inArray(schema.attendance.enrollmentId, ids)).groupBy(schema.attendance.enrollmentId)
      : Promise.resolve([]),
    loadCoverage(cohort.id),
  ]);
  const signBy = byEnrollment(signoffs);
  const expected = expectedPct(tree, cohort.startDate);
  const hoursBy = new Map(hours.map((h) => [h.e, Number(h.h)]));
  const attBy = new Map(att.map((a) => [a.e, { total: Number(a.total), present: Number(a.present) }]));
  const out = rows.map(({ e, u }) => {
    const sum = summarizeCells(tree!, cells.get(e.id) ?? [], signBy.get(e.id) ?? []);
    const lastAt = last.get(e.id);
    return {
      enrollment: e, user: u, sum, last: lastAt, hours: hoursBy.get(e.id) ?? 0, attendance: attBy.get(e.id) ?? null,
      risk: e.status === "ACTIVE" ? riskOf(sum, expected, lastAt, e.createdAt) : null,
    };
  });
  const active = out.filter((r) => r.enrollment.status === "ACTIVE");
  return {
    tree, rows: out, expected,
    /** Where the plan expects the class to be in each stage today. */
    expectedStages: expectedStagePcts(tree, cohort.startDate),
    /** Class averages per stage, group and kind, over active students. */
    stages: classStages(tree, active.map((r) => r.sum)),
    /** What the teacher has taught this cohort, against the plan. */
    taught,
    coverage: coverageOf(tree, taughtDates(taught), cohort.startDate),
  };
}

export async function pendingReviewCount(cohortIds: string[]) {
  if (!cohortIds.length) return new Map<string, number>();
  const rows = await db
    .select({ c: schema.enrollments.cohortId, n: sql<number>`count(*)` })
    .from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.itemProgress.itemId, schema.items.id))
    .innerJoin(schema.enrollments, eq(schema.itemProgress.enrollmentId, schema.enrollments.id))
    .where(and(inArray(schema.enrollments.cohortId, cohortIds), eq(schema.itemProgress.status, "DONE"), inArray(schema.items.kind, [...REVIEW_KINDS])))
    .groupBy(schema.enrollments.cohortId);
  return new Map(rows.map((r) => [r.c, Number(r.n)]));
}

/** Active students of a school, in its open cohorts, with their track. */
async function activeSchoolEnrollments(orgId: string, trackId?: string) {
  return db
    .select({ id: schema.enrollments.id, trackId: schema.cohorts.trackId })
    .from(schema.enrollments)
    .innerJoin(schema.cohorts, eq(schema.enrollments.cohortId, schema.cohorts.id))
    .where(and(
      eq(schema.cohorts.orgId, orgId), eq(schema.cohorts.archived, false), eq(schema.enrollments.status, "ACTIVE"),
      trackId ? eq(schema.cohorts.trackId, trackId) : undefined,
    ));
}

/** Per track, for one school: open cohorts, active students and their average progress. */
export async function schoolTrackStats(orgId: string) {
  const [enrolled, cohortCounts] = await Promise.all([
    activeSchoolEnrollments(orgId),
    db.select({ trackId: schema.cohorts.trackId, n: sql<number>`count(*)` }).from(schema.cohorts)
      .where(and(eq(schema.cohorts.orgId, orgId), eq(schema.cohorts.archived, false))).groupBy(schema.cohorts.trackId),
  ]);
  const ids = enrolled.map((e) => e.id);
  const [cells, signoffs] = await Promise.all([loadCells(ids), loadSignoffs(ids)]);
  const signBy = byEnrollment(signoffs);
  const trackIds = [...new Set(enrolled.map((e) => e.trackId))];
  const trees = new Map(await Promise.all(trackIds.map(async (t) => [t, await loadTrackTree(t)] as const)));
  const out = new Map<string, { cohorts: number; students: number; avg: number }>();
  for (const c of cohortCounts) out.set(c.trackId, { cohorts: Number(c.n), students: 0, avg: 0 });
  for (const t of trackIds) {
    const mine = enrolled.filter((e) => e.trackId === t);
    const sums = mine.map((e) => summarizeCells(trees.get(t)!, cells.get(e.id) ?? [], signBy.get(e.id) ?? []));
    out.set(t, { cohorts: out.get(t)?.cohorts ?? 0, students: mine.length, avg: classAverage(sums) });
  }
  return out;
}

/** One track across a whole school: average per stage and week over all active students. */
export async function schoolTrackStages(orgId: string, tree: StageNode[], trackId: string) {
  const ids = (await activeSchoolEnrollments(orgId, trackId)).map((e) => e.id);
  const [cells, signoffs] = await Promise.all([loadCells(ids), loadSignoffs(ids)]);
  const signBy = byEnrollment(signoffs);
  const sums = ids.map((id) => summarizeCells(tree, cells.get(id) ?? [], signBy.get(id) ?? []));
  return { students: ids.length, avg: classAverage(sums), stages: classStages(tree, sums) };
}

/** A student's own progress on each track they are enrolled in at this school. */
export async function myTrackProgress(orgId: string, userId: string) {
  const mine = await db
    .select({ id: schema.enrollments.id, trackId: schema.cohorts.trackId })
    .from(schema.enrollments)
    .innerJoin(schema.cohorts, eq(schema.enrollments.cohortId, schema.cohorts.id))
    .where(and(eq(schema.cohorts.orgId, orgId), eq(schema.enrollments.userId, userId)));
  const ids = mine.map((e) => e.id);
  const [cells, signoffs] = await Promise.all([loadCells(ids), loadSignoffs(ids)]);
  const signBy = byEnrollment(signoffs);
  const out = new Map<string, { enrollmentId: string; pct: number }>();
  for (const e of mine) {
    const sum = summarizeCells(await loadTrackTree(e.trackId), cells.get(e.id) ?? [], signBy.get(e.id) ?? []);
    out.set(e.trackId, { enrollmentId: e.id, pct: sum.pct });
  }
  return out;
}

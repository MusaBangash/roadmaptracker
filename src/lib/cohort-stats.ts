import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadTrackTree, loadProgress, summarize, expectedPct, lastActivity, riskOf, REVIEW_KINDS, type StageNode } from "@/lib/progress";

type Cohort = typeof schema.cohorts.$inferSelect;

export async function cohortRows(cohort: Cohort, tree?: StageNode[]) {
  tree ??= await loadTrackTree(cohort.trackId);
  const rows = await db
    .select({ e: schema.enrollments, u: { id: schema.users.id, name: schema.users.name, email: schema.users.email } })
    .from(schema.enrollments)
    .innerJoin(schema.users, eq(schema.enrollments.userId, schema.users.id))
    .where(eq(schema.enrollments.cohortId, cohort.id))
    .orderBy(schema.users.name);
  const ids = rows.map((r) => r.e.id);
  const [{ progress, signoffs }, last, hours, att] = await Promise.all([
    loadProgress(ids),
    lastActivity(ids),
    ids.length
      ? db.select({ e: schema.weeklyLogs.enrollmentId, h: sql<number>`coalesce(sum(${schema.weeklyLogs.hours}),0)` })
          .from(schema.weeklyLogs).where(inArray(schema.weeklyLogs.enrollmentId, ids)).groupBy(schema.weeklyLogs.enrollmentId)
      : Promise.resolve([]),
    ids.length
      ? db.select({ e: schema.attendance.enrollmentId, total: sql<number>`count(*)`, present: sql<number>`count(*) filter (where ${schema.attendance.present})` })
          .from(schema.attendance).where(inArray(schema.attendance.enrollmentId, ids)).groupBy(schema.attendance.enrollmentId)
      : Promise.resolve([]),
  ]);
  const expected = expectedPct(tree, cohort.startDate);
  const hoursBy = new Map(hours.map((h) => [h.e, Number(h.h)]));
  const attBy = new Map(att.map((a) => [a.e, { total: Number(a.total), present: Number(a.present) }]));
  const out = rows.map(({ e, u }) => {
    const sum = summarize(tree!, progress.filter((p) => p.enrollmentId === e.id), signoffs.filter((s) => s.enrollmentId === e.id));
    const lastAt = last.get(e.id);
    return {
      enrollment: e, user: u, sum, last: lastAt, hours: hoursBy.get(e.id) ?? 0, attendance: attBy.get(e.id) ?? null,
      risk: e.status === "ACTIVE" ? riskOf(sum, expected, lastAt, e.createdAt) : null,
    };
  });
  return { tree, rows: out, expected };
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

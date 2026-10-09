import "server-only";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Cell } from "@/lib/progress-core";

// The maths lives in progress-core.ts (pure and tested); this file loads the data.
export * from "@/lib/progress-core";

export type Stage = typeof schema.stages.$inferSelect;
export type Item = typeof schema.items.$inferSelect;
export type Progress = typeof schema.itemProgress.$inferSelect;
export type Signoff = typeof schema.stageSignoffs.$inferSelect;
export type StageNode = Stage & { items: Item[] };

export async function loadTrackTree(trackId: string): Promise<StageNode[]> {
  const stages = await db.query.stages.findMany({
    where: and(eq(schema.stages.trackId, trackId), eq(schema.stages.archived, false)),
    orderBy: asc(schema.stages.order),
  });
  if (!stages.length) return [];
  const items = await db.query.items.findMany({
    where: and(inArray(schema.items.stageId, stages.map((s) => s.id)), eq(schema.items.archived, false)),
    orderBy: [asc(schema.items.order)],
  });
  const byStage = new Map<string, Item[]>();
  for (const it of items) byStage.set(it.stageId, [...(byStage.get(it.stageId) ?? []), it]);
  return stages.map((s) => ({ ...s, items: byStage.get(s.id) ?? [] }));
}

/** Every progress row and sign-off: for pages that show each item (one student). */
export async function loadProgress(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return { progress: [] as Progress[], signoffs: [] as Signoff[] };
  const [progress, signoffs] = await Promise.all([
    db.select().from(schema.itemProgress).where(inArray(schema.itemProgress.enrollmentId, enrollmentIds)),
    loadSignoffs(enrollmentIds),
  ]);
  return { progress, signoffs };
}

export async function loadSignoffs(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return [] as Signoff[];
  return db.select().from(schema.stageSignoffs).where(inArray(schema.stageSignoffs.enrollmentId, enrollmentIds));
}

/**
 * Progress counted inside the database: one row per student, stage, group and kind instead of
 * one per ticked item, so class and school pages stay fast with many students.
 * Feed the result to summarizeCells(); it gives the same numbers as summarize().
 */
export async function loadCells(enrollmentIds: string[]): Promise<Map<string, Cell[]>> {
  const out = new Map<string, Cell[]>(enrollmentIds.map((id) => [id, []]));
  if (!enrollmentIds.length) return out;
  const rows = await db
    .select({
      enrollmentId: schema.itemProgress.enrollmentId,
      stageId: schema.items.stageId,
      group: schema.items.group,
      kind: schema.items.kind,
      done: sql<number>`count(*) filter (where "item_progress"."status" <> 'NEEDS_WORK')`,
      verified: sql<number>`count(*) filter (where "item_progress"."status" = 'VERIFIED')`,
    })
    .from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.itemProgress.itemId, schema.items.id))
    .where(and(inArray(schema.itemProgress.enrollmentId, enrollmentIds), eq(schema.items.optional, false), eq(schema.items.archived, false)))
    .groupBy(schema.itemProgress.enrollmentId, schema.items.stageId, schema.items.group, schema.items.kind);
  for (const r of rows) {
    out.get(r.enrollmentId)?.push({ stageId: r.stageId, group: r.group, kind: r.kind, done: Number(r.done), verified: Number(r.verified) });
  }
  return out;
}

export async function lastActivity(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return new Map<string, Date>();
  const [p, w] = await Promise.all([
    db.select({ e: schema.itemProgress.enrollmentId, t: max(schema.itemProgress.updatedAt) }).from(schema.itemProgress)
      .where(inArray(schema.itemProgress.enrollmentId, enrollmentIds)).groupBy(schema.itemProgress.enrollmentId),
    db.select({ e: schema.weeklyLogs.enrollmentId, t: max(schema.weeklyLogs.updatedAt) }).from(schema.weeklyLogs)
      .where(inArray(schema.weeklyLogs.enrollmentId, enrollmentIds)).groupBy(schema.weeklyLogs.enrollmentId),
  ]);
  const out = new Map<string, Date>();
  for (const r of [...p, ...w]) {
    if (!r.t) continue;
    const prev = out.get(r.e);
    if (!prev || r.t > prev) out.set(r.e, r.t);
  }
  return out;
}

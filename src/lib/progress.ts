import "server-only";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { db, schema } from "@/db";

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

export async function loadProgress(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return { progress: [] as Progress[], signoffs: [] as Signoff[] };
  const [progress, signoffs] = await Promise.all([
    db.select().from(schema.itemProgress).where(inArray(schema.itemProgress.enrollmentId, enrollmentIds)),
    db.select().from(schema.stageSignoffs).where(inArray(schema.stageSignoffs.enrollmentId, enrollmentIds)),
  ]);
  return { progress, signoffs };
}

export type StageSummary = { stageId: string; required: number; done: number; verified: number; pct: number; signedOff: boolean | null };
export type Summary = { pct: number; done: number; required: number; verified: number; stages: StageSummary[]; stagesPassed: number };

/** Optional stages (e.g. lanes) count only if the student has started them. */
export function summarize(tree: StageNode[], progress: Progress[], signoffs: Signoff[]): Summary {
  const done = new Map(progress.map((p) => [p.itemId, p]));
  const signed = new Map(signoffs.map((s) => [s.stageId, s.passed]));
  const stages: StageSummary[] = tree.map((s) => {
    const req = s.items.filter((i) => !i.optional);
    const d = req.filter((i) => { const p = done.get(i.id); return p && p.status !== "NEEDS_WORK"; }).length;
    const v = req.filter((i) => done.get(i.id)?.status === "VERIFIED").length;
    return { stageId: s.id, required: req.length, done: d, verified: v, pct: req.length ? d / req.length : 0, signedOff: signed.get(s.id) ?? null };
  });
  const counted = stages.filter((st, i) => !tree[i].optional || st.done > 0);
  const required = counted.reduce((a, s) => a + s.required, 0);
  const d = counted.reduce((a, s) => a + s.done, 0);
  return {
    pct: required ? d / required : 0, done: d, required,
    verified: counted.reduce((a, s) => a + s.verified, 0),
    stages, stagesPassed: stages.filter((s) => s.signedOff === true).length,
  };
}

/** Expected share of the track a student should have finished, given the cohort start date. */
export function expectedPct(tree: StageNode[], startDate: Date, now = new Date()) {
  const seenGroups = new Set<string>();
  let total = 0;
  for (const s of tree) {
    if (s.choiceGroup) { if (seenGroups.has(s.choiceGroup)) continue; seenGroups.add(s.choiceGroup); }
    total += s.weeks;
  }
  if (!total) return 0;
  const weeks = (now.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000);
  return Math.max(0, Math.min(1, weeks / total));
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

export type Risk = "inactive" | "behind" | null;
export function riskOf(sum: Summary, expected: number, last: Date | undefined, joined: Date, now = new Date()): Risk {
  const ref = last ?? joined;
  if (now.getTime() - ref.getTime() > 14 * 24 * 3600 * 1000) return "inactive";
  if (sum.pct + 0.15 < expected) return "behind";
  return null;
}

/** Items that need instructor review: projects, deliverables and milestones marked done. */
export const REVIEW_KINDS = ["PROJECT", "DELIVERABLE", "MILESTONE"] as const;

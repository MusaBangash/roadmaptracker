// Writes a roadmap file into track / stage / item, matched by key. Used by scripts/sync.ts (official
// roadmaps, on every deploy) and by Publish in the Roadmap Builder. It never deletes: stages and items
// no longer in the file are archived, so student ticks and evidence on them are kept, and come back
// if the key comes back. Relative imports so the sync script can use it outside Next.js.
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { diffDocs, docFromRows, type TrackDoc } from "./roadmap-core";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** The track row's fields from a roadmap file (the slug is set separately). */
export function trackValues(t: TrackDoc) {
  return {
    title: t.title, kind: t.kind ?? "ROLE", edition: t.edition ?? "", subtitle: t.subtitle ?? "", summary: t.summary ?? "",
    expert: t.expert ?? "", benchmarks: t.benchmarks ?? [], rubric: t.rubric ?? [], updatedAt: new Date(),
  };
}

const excluded = (col: string) => sql.raw(`excluded."${col}"`);
const CHUNK = 500;

/** Upserts the stages and items of a roadmap (a few queries, not one per item) and archives the rest. */
export async function applyStages(q: Db, trackId: string, stages: TrackDoc["stages"]) {
  if (!stages.length) throw new Error("A roadmap needs at least one stage.");
  const stageRows = await q.insert(schema.stages).values(stages.map((s, si) => ({
    trackId, key: s.key, order: si, title: s.title, level: s.level ?? "", weeks: s.weeks ?? 0, benchmark: s.benchmark ?? "",
    goal: s.goal ?? "", doneWhen: s.doneWhen ?? "", resources: s.resources ?? "", optional: !!s.optional, choiceGroup: s.choiceGroup ?? null, archived: false,
  }))).onConflictDoUpdate({
    target: [schema.stages.trackId, schema.stages.key],
    set: {
      order: excluded("order"), title: excluded("title"), level: excluded("level"), weeks: excluded("weeks"), benchmark: excluded("benchmark"),
      goal: excluded("goal"), doneWhen: excluded("done_when"), resources: excluded("resources"), optional: excluded("optional"),
      choiceGroup: excluded("choice_group"), archived: excluded("archived"),
    },
  }).returning({ id: schema.stages.id, key: schema.stages.key });
  const stageId = new Map(stageRows.map((r) => [r.key, r.id]));

  const itemRows = stages.flatMap((s) => s.items.map((it, ii) => ({
    stageId: stageId.get(s.key)!, key: it.key, order: ii, title: it.title, detail: it.detail ?? "", kind: it.kind ?? "LESSON",
    group: it.group ?? null, optional: !!it.optional, archived: false,
  })));
  for (let i = 0; i < itemRows.length; i += CHUNK) {
    await q.insert(schema.items).values(itemRows.slice(i, i + CHUNK)).onConflictDoUpdate({
      target: [schema.items.stageId, schema.items.key],
      set: {
        order: excluded("order"), title: excluded("title"), detail: excluded("detail"), kind: excluded("kind"), group: excluded("group"),
        optional: excluded("optional"), archived: excluded("archived"),
      },
    });
  }

  const allStages = db.select({ id: schema.stages.id }).from(schema.stages).where(eq(schema.stages.trackId, trackId));
  await q.update(schema.items).set({ archived: true }).where(and(
    inArray(schema.items.stageId, allStages), eq(schema.items.archived, false),
    notInArray(sql`${schema.items.stageId} || '/' || ${schema.items.key}`, itemRows.map((r) => `${r.stageId}/${r.key}`)),
  ));
  await q.update(schema.stages).set({ archived: true }).where(and(
    eq(schema.stages.trackId, trackId), eq(schema.stages.archived, false), notInArray(schema.stages.key, stages.map((s) => s.key)),
  ));
}

/** The roadmap file for what students see now (archived stages and items left out). */
export async function liveDoc(q: Db, track: typeof schema.tracks.$inferSelect): Promise<TrackDoc> {
  const stages = await q.select().from(schema.stages)
    .where(and(eq(schema.stages.trackId, track.id), eq(schema.stages.archived, false))).orderBy(asc(schema.stages.order));
  const items = stages.length
    ? await q.select().from(schema.items)
      .where(and(inArray(schema.items.stageId, stages.map((s) => s.id)), eq(schema.items.archived, false))).orderBy(asc(schema.items.order))
    : [];
  return docFromRows(track, stages.map((s) => ({ ...s, items: items.filter((it) => it.stageId === s.id) })));
}

/** How much student work sits on the items a publish would remove (they are hidden, not deleted). */
export async function workOnRemoved(trackId: string, live: TrackDoc, draft: TrackDoc) {
  const removed = diffDocs(live, draft).removedKeys;
  if (!removed.length) return 0;
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.items.id, schema.itemProgress.itemId))
    .innerJoin(schema.stages, eq(schema.stages.id, schema.items.stageId))
    .where(and(eq(schema.stages.trackId, trackId), inArray(sql`${schema.stages.key} || '/' || ${schema.items.key}`, removed.map(([s, i]) => `${s}/${i}`))));
  return Number(n);
}

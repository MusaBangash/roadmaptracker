// Roadmap Builder rules, pure and tested (roadmap-core.test.ts): the roadmap file format (the same as
// content/tracks/*.json), its checks with plain-English errors, the editing steps, and what a publish
// changes. Keys are the stable IDs that student progress hangs off: made once from the title, never
// changed when the title changes.
import { z } from "zod";

export const ITEM_KINDS = ["LESSON", "PROJECT", "DELIVERABLE", "MILESTONE"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const LIMITS = { title: 200, text: 4000, stages: 100, items: 400, weeks: 104, fileBytes: 1_000_000 } as const;

const KEY = /^[a-z0-9][a-z0-9-]{0,79}$/;
const title = z.string("needs a title").trim().min(1, "needs a title").max(LIMITS.title, `title is longer than ${LIMITS.title} characters`);
const text = z.string().trim().max(LIMITS.text, `is longer than ${LIMITS.text} characters`).optional();
const key = z.string("is missing its key").regex(KEY, "has a key that is not lowercase letters, numbers and dashes");

const itemSchema = z.object({
  key, title,
  detail: text,
  kind: z.enum(ITEM_KINDS, "kind must be LESSON, PROJECT, DELIVERABLE or MILESTONE").optional(),
  group: z.string().trim().max(80, "week label is longer than 80 characters").optional(),
  optional: z.boolean().optional(),
});

const stageSchema = z.object({
  key, title,
  level: z.string().trim().max(80).optional(),
  weeks: z.number("weeks must be a number").int("weeks must be a whole number").min(0).max(LIMITS.weeks, `weeks must be ${LIMITS.weeks} or less`).optional(),
  benchmark: text, goal: text, doneWhen: text, resources: text,
  optional: z.boolean().optional(),
  choiceGroup: z.string().trim().max(80).optional(),
  items: z.array(itemSchema, "has no items list").max(LIMITS.items, `has more than ${LIMITS.items} items`),
});

export const trackDocSchema = z.object({
  slug: z.string().optional(),
  title,
  kind: z.enum(["ROLE", "COURSE"], "kind must be ROLE or COURSE").optional(),
  edition: z.string().trim().max(LIMITS.title).optional(),
  subtitle: z.string().trim().max(LIMITS.title).optional(),
  summary: text,
  expert: text,
  benchmarks: z.array(z.object({ title: z.string().max(LIMITS.title), detail: z.string().max(LIMITS.text) })).max(50).optional(),
  rubric: z.array(z.object({ criterion: z.string().min(1).max(LIMITS.title), levels: z.array(z.string().max(LIMITS.title)).min(2).max(10) })).max(10).optional(),
  stages: z.array(stageSchema, "has no stages list").max(LIMITS.stages, `has more than ${LIMITS.stages} stages`),
});

export type TrackDoc = z.infer<typeof trackDocSchema>;
export type StageDoc = TrackDoc["stages"][number];
export type ItemDoc = StageDoc["items"][number];

/** "Stage 3, item 5" from a path like ["stages", 2, "items", 4, "title"]. */
function where(path: PropertyKey[]) {
  const parts: string[] = [];
  if (path[0] === "stages" && typeof path[1] === "number") parts.push(`Stage ${path[1] + 1}`);
  if (path[2] === "items" && typeof path[3] === "number") parts.push(`item ${path[3] + 1}`);
  if (!parts.length) parts.push(path[0] === "rubric" || path[0] === "benchmarks" ? `The ${String(path[0])}` : "The roadmap");
  return parts.join(", ");
}

/** Checks a roadmap file. Gives every problem in plain English, e.g. "Stage 3: needs a title". */
export function parseTrackDoc(input: unknown): { ok: true; doc: TrackDoc } | { ok: false; errors: string[] } {
  const p = trackDocSchema.safeParse(input);
  if (!p.success) {
    const errors = p.error.issues.map((i) => {
      const field = i.path.at(-1);
      const msg = i.message.startsWith("Invalid input: ") && typeof field === "string"
        ? `"${field}" ${i.message.slice("Invalid input: ".length)}` : i.message;
      return `${where(i.path)}: ${msg}`;
    });
    return { ok: false, errors: [...new Set(errors)].slice(0, 20) };
  }
  const errors: string[] = [];
  const stageKeys = new Set<string>();
  p.data.stages.forEach((s, si) => {
    if (stageKeys.has(s.key)) errors.push(`Stage ${si + 1}: another stage already uses the key "${s.key}"`);
    stageKeys.add(s.key);
    const itemKeys = new Set<string>();
    s.items.forEach((it, ii) => {
      if (itemKeys.has(it.key)) errors.push(`Stage ${si + 1}, item ${ii + 1}: another item in this stage already uses the key "${it.key}"`);
      itemKeys.add(it.key);
    });
  });
  return errors.length ? { ok: false, errors: errors.slice(0, 20) } : { ok: true, doc: p.data };
}

/** Why a roadmap can't be published yet (empty = ready). */
export function publishProblems(doc: TrackDoc): string[] {
  if (!doc.stages.length) return ["Add at least one stage."];
  return doc.stages.flatMap((s, i) => (s.items.length ? [] : [`Stage ${i + 1} “${s.title}” has no lessons or projects yet.`]));
}

export function slugify(s: string, max = 40) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, max).replace(/-$/, "");
}

/** A new key from a title, not clashing with any taken key. */
export function makeKey(title: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const base = slugify(title) || "item";
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** A school's roadmap slug: "<school>--<title>". Official slugs never contain "--", so they can't clash. */
export function schoolSlug(orgSlug: string, title: string, taken: (slug: string) => boolean) {
  const base = `${orgSlug.slice(0, 40)}--${slugify(title) || "roadmap"}`;
  if (!taken(base)) return base;
  for (let i = 2; ; i++) if (!taken(`${base}-${i}`)) return `${base}-${i}`;
}

export const isOfficialSlug = (slug: string) => !slug.includes("--");

// ---------- Editing steps: each returns a new roadmap and never changes an existing key ----------

export class RoadmapEditError extends Error {}

export type DetailsInput = Pick<TrackDoc, "title" | "kind" | "edition" | "subtitle" | "summary">;
export type StageInput = Pick<StageDoc, "title" | "level" | "weeks" | "goal" | "doneWhen" | "optional">;
export type ItemInput = Pick<ItemDoc, "title" | "detail" | "kind" | "group" | "optional">;

/** Leaves out empty text, empty lists and false flags, so files stay as tidy as the official ones. */
function tidy<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== false && v !== null && !(Array.isArray(v) && !v.length))) as T;
}

function omit<T extends object, K extends keyof T>(o: T, keys: K[]): Omit<T, K> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k as K))) as Omit<T, K>;
}

function stageAt(doc: TrackDoc, stageKey: string) {
  const i = doc.stages.findIndex((s) => s.key === stageKey);
  if (i < 0) throw new RoadmapEditError("That stage is no longer in the roadmap. Reload the page.");
  return i;
}

function itemAt(stage: StageDoc, itemKey: string) {
  const i = stage.items.findIndex((it) => it.key === itemKey);
  if (i < 0) throw new RoadmapEditError("That item is no longer in this stage. Reload the page.");
  return i;
}

function move<T>(list: T[], from: number, dir: -1 | 1) {
  const to = from + dir;
  if (to < 0 || to >= list.length) return list;
  const out = [...list];
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}

function withStage(doc: TrackDoc, stageKey: string, fn: (s: StageDoc) => StageDoc): TrackDoc {
  const i = stageAt(doc, stageKey);
  return { ...doc, stages: doc.stages.map((s, j) => (j === i ? fn(s) : s)) };
}

export const edit = {
  details: (doc: TrackDoc, d: DetailsInput): TrackDoc => ({ ...doc, ...tidy(d), title: d.title }),

  addStage(doc: TrackDoc, s: StageInput): TrackDoc {
    if (doc.stages.length >= LIMITS.stages) throw new RoadmapEditError(`A roadmap can have at most ${LIMITS.stages} stages.`);
    const key = makeKey(s.title, doc.stages.map((x) => x.key));
    return { ...doc, stages: [...doc.stages, { key, ...tidy(s), title: s.title, items: [] }] };
  },
  updateStage: (doc: TrackDoc, stageKey: string, s: StageInput) =>
    withStage(doc, stageKey, (old) => {
      // Fields the builder doesn't show (benchmark, resources, choice group) are kept as they are.
      return { ...omit(old, ["level", "weeks", "goal", "doneWhen", "optional"]), ...tidy(s), title: s.title };
    }),
  moveStage: (doc: TrackDoc, stageKey: string, dir: -1 | 1): TrackDoc => ({ ...doc, stages: move(doc.stages, stageAt(doc, stageKey), dir) }),
  removeStage(doc: TrackDoc, stageKey: string): TrackDoc {
    const i = stageAt(doc, stageKey);
    return { ...doc, stages: doc.stages.filter((_, j) => j !== i) };
  },

  addItem: (doc: TrackDoc, stageKey: string, it: ItemInput) =>
    withStage(doc, stageKey, (s) => {
      if (s.items.length >= LIMITS.items) throw new RoadmapEditError(`A stage can have at most ${LIMITS.items} items.`);
      const key = makeKey(it.title, s.items.map((x) => x.key));
      return { ...s, items: [...s.items, { key, ...tidy(it), title: it.title, kind: it.kind ?? "LESSON" }] };
    }),
  updateItem: (doc: TrackDoc, stageKey: string, itemKey: string, it: ItemInput) =>
    withStage(doc, stageKey, (s) => {
      const i = itemAt(s, itemKey);
      return { ...s, items: s.items.map((x, j) => (j === i ? { key: x.key, ...tidy(it), title: it.title, kind: it.kind ?? "LESSON" } : x)) };
    }),
  moveItem: (doc: TrackDoc, stageKey: string, itemKey: string, dir: -1 | 1) =>
    withStage(doc, stageKey, (s) => ({ ...s, items: move(s.items, itemAt(s, itemKey), dir) })),
  removeItem: (doc: TrackDoc, stageKey: string, itemKey: string) =>
    withStage(doc, stageKey, (s) => {
      const i = itemAt(s, itemKey);
      return { ...s, items: s.items.filter((_, j) => j !== i) };
    }),
};

// ---------- Rows → file ----------

type TrackRow = Pick<TrackDoc, "title"> & { slug: string; kind: string; edition: string; subtitle: string; summary: string; expert: string;
  benchmarks: { title: string; detail: string }[]; rubric: { criterion: string; levels: string[] }[] };
type StageRow = { key: string; title: string; level: string; weeks: number; benchmark: string; goal: string; doneWhen: string; resources: string;
  optional: boolean; choiceGroup: string | null; items: { key: string; title: string; detail: string; kind: ItemKind; group: string | null; optional: boolean }[] };

/** The roadmap file for what is live now (archived stages and items left out). */
export function docFromRows(t: TrackRow, stages: StageRow[]): TrackDoc {
  return {
    slug: t.slug, title: t.title, kind: t.kind === "COURSE" ? "COURSE" : "ROLE",
    ...tidy({ edition: t.edition, subtitle: t.subtitle, summary: t.summary, expert: t.expert }),
    ...(t.benchmarks.length ? { benchmarks: t.benchmarks } : {}),
    ...(t.rubric.length ? { rubric: t.rubric } : {}),
    stages: stages.map((s) => ({
      key: s.key, title: s.title,
      ...tidy({ level: s.level, benchmark: s.benchmark, goal: s.goal, doneWhen: s.doneWhen, resources: s.resources, optional: s.optional, choiceGroup: s.choiceGroup ?? undefined }),
      weeks: s.weeks,
      items: s.items.map((it) => ({ key: it.key, title: it.title, ...tidy({ detail: it.detail, group: it.group ?? undefined, optional: it.optional }), kind: it.kind })),
    })),
  };
}

// ---------- What a publish changes ----------

export type RoadmapDiff = {
  details: boolean;
  stages: { added: string[]; removed: string[]; changed: string[] };
  items: { added: string[]; removed: string[]; changed: string[] };
  /** Removed items that may hold student work: [stageKey, itemKey]. */
  removedKeys: [string, string][];
  reordered: boolean;
};

/** Same value, whatever order the fields are written in. */
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const stageFields = (s: StageDoc) => tidy({ ...omit(s, ["items"]), weeks: s.weeks ?? 0 });
const itemFields = (it: ItemDoc) => tidy({ ...it, kind: it.kind ?? "LESSON" });
const detailFields = (d: TrackDoc) => tidy({ ...omit(d, ["stages", "slug"]), kind: d.kind ?? "ROLE" });

/** What publishing `draft` over `live` adds, removes and changes, matched by key. */
export function diffDocs(live: TrackDoc | null, draft: TrackDoc): RoadmapDiff {
  const d: RoadmapDiff = { details: false, stages: { added: [], removed: [], changed: [] }, items: { added: [], removed: [], changed: [] }, removedKeys: [], reordered: false };
  const old = live ?? { title: "", stages: [] };
  d.details = live !== null && !same(detailFields(old as TrackDoc), detailFields(draft));
  const oldStages = new Map(old.stages.map((s) => [s.key, s]));
  const newStages = new Map(draft.stages.map((s) => [s.key, s]));
  for (const s of draft.stages) {
    const o = oldStages.get(s.key);
    if (!o) { d.stages.added.push(s.title); d.items.added.push(...s.items.map((i) => i.title)); continue; }
    if (!same(stageFields(o), stageFields(s))) d.stages.changed.push(s.title);
    const oldItems = new Map(o.items.map((i) => [i.key, i]));
    const newKeys = new Set(s.items.map((i) => i.key));
    for (const it of s.items) {
      const oi = oldItems.get(it.key);
      if (!oi) d.items.added.push(it.title);
      else if (!same(itemFields(oi), itemFields(it))) d.items.changed.push(it.title);
    }
    for (const oi of o.items) if (!newKeys.has(oi.key)) { d.items.removed.push(oi.title); d.removedKeys.push([s.key, oi.key]); }
    const kept = o.items.filter((i) => newKeys.has(i.key)).map((i) => i.key);
    if (!same(kept, s.items.filter((i) => oldItems.has(i.key)).map((i) => i.key))) d.reordered = true;
  }
  for (const o of old.stages) if (!newStages.has(o.key)) {
    d.stages.removed.push(o.title);
    for (const oi of o.items) { d.items.removed.push(oi.title); d.removedKeys.push([o.key, oi.key]); }
  }
  const keptStages = old.stages.filter((s) => newStages.has(s.key)).map((s) => s.key);
  if (!same(keptStages, draft.stages.filter((s) => oldStages.has(s.key)).map((s) => s.key))) d.reordered = true;
  return d;
}

export function hasChanges(d: RoadmapDiff) {
  return d.details || d.reordered || [d.stages, d.items].some((x) => x.added.length + x.removed.length + x.changed.length > 0);
}

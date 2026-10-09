// Progress maths for a roadmap: pure functions, no database and no React.
// Tested in progress-core.test.ts. This file is also the spec for the Python rewrite
// in NoorAI Lab Studio (docs/INTEGRATION.md): keep the rules here and nowhere else.
//
// Rules:
//  - Only required items count (item.optional = false).
//  - An item counts as done when it has progress that is not NEEDS_WORK.
//  - An optional stage counts only once the student has started it.
//  - Stages that share a choiceGroup are alternatives: one window in the plan.

/** Items an instructor reviews: projects, deliverables and milestones. */
export const REVIEW_KINDS = ["PROJECT", "DELIVERABLE", "MILESTONE"] as const;
const isReview = (kind: string) => (REVIEW_KINDS as readonly string[]).includes(kind);

export type CoreItem = { id: string; stageId: string; kind: string; group: string | null; optional: boolean };
export type CoreStage = { id: string; optional: boolean; choiceGroup: string | null; weeks: number; items: CoreItem[] };

/** Done and verified counts of required items for one student, per stage, group and kind. */
export type Cell = { stageId: string; group: string | null; kind: string; done: number; verified: number };

export type Part = { done: number; required: number; verified: number; pct: number };
export type GroupSummary = Part & { name: string };
export type StageSummary = Part & {
  stageId: string;
  signedOff: boolean | null;
  /** Weeks or topics inside the stage, in roadmap order. Empty when the stage has none. */
  groups: GroupSummary[];
  lessons: Part;
  projects: Part;
};
export type Summary = Part & { stages: StageSummary[]; stagesPassed: number };

const part = (done: number, required: number, verified: number): Part => ({ done, required, verified, pct: required ? done / required : 0 });

/** Turns item-level progress into cells (used when a page already has every row). */
export function cellsFromProgress(tree: CoreStage[], progress: { itemId: string; status: string }[]): Cell[] {
  const byItem = new Map(progress.map((p) => [p.itemId, p.status]));
  const cells = new Map<string, Cell>();
  for (const s of tree) {
    for (const it of s.items) {
      const status = byItem.get(it.id);
      if (it.optional || !status) continue;
      const key = `${s.id}\u0000${it.group ?? ""}\u0000${it.kind}`;
      const c = cells.get(key) ?? { stageId: s.id, group: it.group, kind: it.kind, done: 0, verified: 0 };
      if (status !== "NEEDS_WORK") c.done++;
      if (status === "VERIFIED") c.verified++;
      cells.set(key, c);
    }
  }
  return [...cells.values()];
}

/** The ungrouped items of a stage that also has groups are shown as one group with this name. */
export const OTHER_GROUP = "Other";

export function summarizeCells(tree: CoreStage[], cells: Cell[], signoffs: { stageId: string; passed: boolean }[]): Summary {
  const signed = new Map(signoffs.map((s) => [s.stageId, s.passed]));
  const byStage = new Map<string, Cell[]>();
  for (const c of cells) byStage.set(c.stageId, [...(byStage.get(c.stageId) ?? []), c]);

  const stages: StageSummary[] = tree.map((s) => {
    const req = s.items.filter((i) => !i.optional);
    const cs = byStage.get(s.id) ?? [];
    const sumOf = (pick: (c: Cell) => boolean) => cs.filter(pick).reduce((a, c) => [a[0] + c.done, a[1] + c.verified], [0, 0]);

    const hasGroups = req.some((i) => i.group);
    const groups: GroupSummary[] = [];
    if (hasGroups) {
      const names = [...new Set(req.map((i) => i.group ?? OTHER_GROUP))];
      for (const name of names) {
        const inGroup = (g: string | null) => (g ?? OTHER_GROUP) === name;
        const [d, v] = sumOf((c) => inGroup(c.group));
        groups.push({ name, ...part(d, req.filter((i) => inGroup(i.group)).length, v) });
      }
    }
    const [ld, lv] = sumOf((c) => !isReview(c.kind));
    const [pd, pv] = sumOf((c) => isReview(c.kind));
    const [d, v] = sumOf(() => true);
    return {
      stageId: s.id,
      ...part(d, req.length, v),
      signedOff: signed.get(s.id) ?? null,
      groups,
      lessons: part(ld, req.filter((i) => !isReview(i.kind)).length, lv),
      projects: part(pd, req.filter((i) => isReview(i.kind)).length, pv),
    };
  });

  const counted = stages.filter((st, i) => !tree[i].optional || st.done > 0);
  const total = part(
    counted.reduce((a, s) => a + s.done, 0),
    counted.reduce((a, s) => a + s.required, 0),
    counted.reduce((a, s) => a + s.verified, 0),
  );
  return { ...total, stages, stagesPassed: stages.filter((s) => s.signedOff === true).length };
}

export function summarize(tree: CoreStage[], progress: { itemId: string; status: string }[], signoffs: { stageId: string; passed: boolean }[]) {
  return summarizeCells(tree, cellsFromProgress(tree, progress), signoffs);
}

// ---------- The cohort plan: where a student should be today ----------

const WEEK = 7 * 24 * 3600 * 1000;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Each stage's place in the plan, in weeks from the cohort start. Alternatives share one window. */
export function stageWindows(tree: CoreStage[]) {
  const groupStart = new Map<string, number>();
  let cursor = 0;
  const windows = tree.map((s) => {
    if (s.choiceGroup && groupStart.has(s.choiceGroup)) return { start: groupStart.get(s.choiceGroup)!, weeks: s.weeks };
    const w = { start: cursor, weeks: s.weeks };
    if (s.choiceGroup) groupStart.set(s.choiceGroup, cursor);
    cursor += s.weeks;
    return w;
  });
  return { windows, total: cursor };
}

const weeksSince = (start: Date, now: Date) => (now.getTime() - start.getTime()) / WEEK;

/** Share of the whole track a student should have finished by now. */
export function expectedPct(tree: CoreStage[], startDate: Date, now = new Date()) {
  const { total } = stageWindows(tree);
  return total ? clamp01(weeksSince(startDate, now) / total) : 0;
}

/** For each stage, the share of that stage a student should have finished by now. */
export function expectedStagePcts(tree: CoreStage[], startDate: Date, now = new Date()) {
  const elapsed = weeksSince(startDate, now);
  return stageWindows(tree).windows.map((w) => (w.weeks ? clamp01((elapsed - w.start) / w.weeks) : elapsed >= w.start ? 1 : 0));
}

/** A stage's weeks are split evenly across its groups (Week 1, Week 2, ...). */
export function expectedGroupPct(stageExpected: number, groupIndex: number, groupCount: number) {
  return groupCount ? clamp01(stageExpected * groupCount - groupIndex) : 0;
}

/** "You are here": the first required stage not yet finished and signed off; -1 when all are. */
export function currentStageIndex(tree: CoreStage[], sum: Summary) {
  return sum.stages.findIndex((s, i) => !tree[i].optional && s.signedOff !== true && s.pct < 1);
}

// ---------- Risk ----------

export type Risk = "inactive" | "behind" | null;
export const INACTIVE_DAYS = 14;
export const BEHIND_BY = 0.15;

export function riskOf(sum: { pct: number }, expected: number, last: Date | undefined, joined: Date, now = new Date()): Risk {
  const ref = last ?? joined;
  if (now.getTime() - ref.getTime() > INACTIVE_DAYS * 24 * 3600 * 1000) return "inactive";
  if (sum.pct + BEHIND_BY < expected) return "behind";
  return null;
}

// ---------- A whole class ----------

export type ClassPart = { avg: number; students: number };
export type ClassStage = ClassPart & {
  stageId: string;
  /** Students who ticked every required item of the stage. */
  finished: number;
  signedOff: number;
  groups: (ClassPart & { name: string })[];
  lessons: ClassPart;
  projects: ClassPart;
};

/** Average progress per stage, group and kind across students. An optional stage averages
 *  only the students who started it, so its bar shows how far those students got. */
export function classStages(tree: CoreStage[], summaries: Summary[]): ClassStage[] {
  const avg = (xs: number[]): ClassPart => ({ avg: xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0, students: xs.length });
  return tree.map((s, i) => {
    const rows = summaries.map((sum) => sum.stages[i]).filter((st) => !s.optional || st.done > 0);
    return {
      stageId: s.id,
      ...avg(rows.map((r) => r.pct)),
      finished: rows.filter((r) => r.required > 0 && r.done >= r.required).length,
      signedOff: rows.filter((r) => r.signedOff === true).length,
      groups: (rows[0]?.groups ?? summarizeCells([s], [], []).stages[0].groups).map((g, gi) => ({ name: g.name, ...avg(rows.map((r) => r.groups[gi].pct)) })),
      lessons: avg(rows.map((r) => r.lessons.pct)),
      projects: avg(rows.map((r) => r.projects.pct)),
    };
  });
}

/** Average overall progress across students (0 when there are none). */
export function classAverage(summaries: { pct: number }[]) {
  return summaries.length ? summaries.reduce((a, s) => a + s.pct, 0) / summaries.length : 0;
}

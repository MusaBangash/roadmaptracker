// Teaching plan maths: what a teacher has taught a cohort, against the cohort plan.
// Pure functions, tested in coverage-core.test.ts. Spec for Lab Studio stage 3.7 (course plan
// tracker: done, remaining, behind) — see docs/INTEGRATION.md.
//
// Rules:
//  - Only required LESSON items are taught. Projects, deliverables and milestones are student
//    work, checked through Review, so they are never "taught".
//  - A week (group) gets an even share of its stage's weeks in the plan, as in progress-core.
//  - An optional stage is never "behind"; it counts once teaching in it has started.

import { OTHER_GROUP, stageWindows, type CoreStage } from "./progress-core";

export type TeachStatus = "taught" | "due" | "behind" | "upcoming";
/** Weeks from the cohort start. */
export type Window = { start: number; end: number };
export type Segment = {
  name: string;
  required: number;
  taught: number;
  pct: number;
  /** null when there is nothing to teach (no lessons) or an optional stage not fully taught. */
  status: TeachStatus | null;
  window: Window;
  /** Latest taught date in this segment (YYYY-MM-DD), or null. */
  lastTaughtOn: string | null;
};
export type StageCoverage = Segment & { groups: Segment[] };
export type Coverage = {
  stages: StageCoverage[];
  required: number;
  taught: number;
  pct: number;
  /** Weeks (or stages without weeks) whose plan dates have passed without being taught. */
  behind: number;
  /** The first week or stage still to teach, in roadmap order; null when all is taught. */
  next: { stageIndex: number; groupIndex: number | null } | null;
};

const WEEK = 7 * 24 * 3600 * 1000;
export const isLesson = (kind: string) => kind === "LESSON";

export function teachStatus(required: number, taught: number, window: Window, elapsedWeeks: number, optional = false): TeachStatus | null {
  if (!required) return null;
  if (taught >= required) return "taught";
  if (optional) return null;
  if (elapsedWeeks >= window.end) return "behind";
  if (elapsedWeeks >= window.start) return "due";
  return "upcoming";
}

/** @param taught itemId → date taught (YYYY-MM-DD) for this cohort. */
export function coverageOf(tree: CoreStage[], taught: Map<string, string>, startDate: Date, now = new Date()): Coverage {
  const elapsed = (now.getTime() - startDate.getTime()) / WEEK;
  const { windows } = stageWindows(tree);

  const segment = (name: string, lessons: { id: string }[], window: Window, optional: boolean): Segment => {
    const dates = lessons.map((l) => taught.get(l.id)).filter((d): d is string => !!d);
    const t = dates.length;
    return {
      name, required: lessons.length, taught: t, pct: lessons.length ? t / lessons.length : 0,
      status: teachStatus(lessons.length, t, window, elapsed, optional), window,
      lastTaughtOn: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    };
  };

  const stages: StageCoverage[] = tree.map((s, i) => {
    const req = s.items.filter((it) => !it.optional);
    const w = { start: windows[i].start, end: windows[i].start + windows[i].weeks };
    const names = req.some((it) => it.group) ? [...new Set(req.map((it) => it.group ?? OTHER_GROUP))] : [];
    const share = names.length ? (w.end - w.start) / names.length : 0;
    const groups = names.map((name, gi) =>
      segment(name, req.filter((it) => (it.group ?? OTHER_GROUP) === name && isLesson(it.kind)), { start: w.start + gi * share, end: w.start + (gi + 1) * share }, s.optional));
    return { ...segment(`stage-${i}`, req.filter((it) => isLesson(it.kind)), w, s.optional), groups };
  });

  const counted = stages.filter((st, i) => !tree[i].optional || st.taught > 0);
  const required = counted.reduce((a, s) => a + s.required, 0);
  const t = counted.reduce((a, s) => a + s.taught, 0);

  let behind = 0;
  let next: Coverage["next"] = null;
  stages.forEach((st, i) => {
    const leaves = st.groups.length ? st.groups.map((g, gi) => ({ g, gi })) : [{ g: st as Segment, gi: null }];
    for (const { g, gi } of leaves) {
      if (g.status === "behind") behind++;
      if (!next && !tree[i].optional && (g.status === "due" || g.status === "behind" || g.status === "upcoming")) next = { stageIndex: i, groupIndex: gi };
    }
  });

  return { stages, required, taught: t, pct: required ? t / required : 0, behind, next };
}

/** "Taught, but students are behind": most of it was taught, and the class is well behind that. */
export const LEARN_GAP = 0.25;
export function taughtNotLearned(taughtPct: number, learnedAvg: number) {
  return taughtPct >= 0.5 && learnedAvg + LEARN_GAP < taughtPct;
}

/** Present students who get a lesson ticked by the teacher: active, present on that date, and
 *  not already ticked (a student's own tick, evidence or a verification is never overwritten). */
export function presentToMark(
  enrollments: { id: string; status: string }[],
  presentIds: Set<string>,
  alreadyTicked: Set<string>,
) {
  return enrollments.filter((e) => e.status === "ACTIVE" && presentIds.has(e.id) && !alreadyTicked.has(e.id)).map((e) => e.id);
}

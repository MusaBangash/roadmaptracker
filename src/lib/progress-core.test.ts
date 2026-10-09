import { describe, expect, it } from "vitest";
import {
  cellsFromProgress, classAverage, classStages, currentStageIndex, expectedGroupPct, expectedPct, expectedStagePcts,
  riskOf, stageWindows, summarize, summarizeCells, OTHER_GROUP, type CoreItem, type CoreStage, type Cell,
} from "./progress-core";

// ---------- a tiny roadmap to test with ----------

let n = 0;
const item = (stageId: string, over: Partial<CoreItem> = {}): CoreItem => ({ id: `i${++n}`, stageId, kind: "LESSON", group: null, optional: false, ...over });
const stage = (id: string, items: (s: string) => CoreItem[], over: Partial<CoreStage> = {}): CoreStage =>
  ({ id, optional: false, choiceGroup: null, weeks: 2, items: items(id), ...over });

/** s1: 3 lessons + 1 project + 1 optional lesson.  s2: two weeks of 2 lessons.  s3: optional lane. */
function roadmap() {
  n = 0;
  return [
    stage("s1", (s) => [item(s), item(s), item(s), item(s, { kind: "PROJECT" }), item(s, { optional: true })]),
    stage("s2", (s) => [item(s, { group: "Week 1" }), item(s, { group: "Week 1" }), item(s, { group: "Week 2" }), item(s, { group: "Week 2" })]),
    stage("s3", (s) => [item(s), item(s)], { optional: true }),
  ];
}
const ids = (tree: CoreStage[], stageIndex: number) => tree[stageIndex].items.map((i) => i.id);
const done = (...itemIds: string[]) => itemIds.map((itemId) => ({ itemId, status: "DONE" }));

// ---------- one student ----------

describe("summarize: one student's progress", () => {
  it("counts only required items, and an untouched optional stage does not count", () => {
    const tree = roadmap();
    const [a, b] = ids(tree, 0);
    const sum = summarize(tree, done(a, b), []);
    expect(sum.required).toBe(4 + 4); // s1 has 4 required, s2 has 4, s3 is optional and not started
    expect(sum.done).toBe(2);
    expect(sum.pct).toBeCloseTo(2 / 8);
  });

  it("ticking an optional item does not change the percentage", () => {
    const tree = roadmap();
    const optional = ids(tree, 0)[4];
    expect(summarize(tree, done(optional), []).done).toBe(0);
  });

  it("an optional stage counts once the student starts it", () => {
    const tree = roadmap();
    const sum = summarize(tree, done(ids(tree, 2)[0]), []);
    expect(sum.required).toBe(4 + 4 + 2);
    expect(sum.done).toBe(1);
  });

  it("'needs work' is not done, 'verified' is done and verified", () => {
    const tree = roadmap();
    const [a, b] = ids(tree, 0);
    const sum = summarize(tree, [{ itemId: a, status: "NEEDS_WORK" }, { itemId: b, status: "VERIFIED" }], []);
    expect(sum.stages[0].done).toBe(1);
    expect(sum.stages[0].verified).toBe(1);
  });

  it("splits a stage into lessons and projects", () => {
    const tree = roadmap();
    const [a, , , project] = ids(tree, 0);
    const s1 = summarize(tree, done(a, project), []).stages[0];
    expect(s1.lessons).toMatchObject({ done: 1, required: 3 });
    expect(s1.projects).toMatchObject({ done: 1, required: 1, pct: 1 });
  });

  it("gives each week inside a stage its own numbers, in roadmap order", () => {
    const tree = roadmap();
    const [w1a, w1b, w2a] = ids(tree, 1);
    const s2 = summarize(tree, done(w1a, w1b, w2a), []).stages[1];
    expect(s2.groups.map((g) => [g.name, g.done, g.required])).toEqual([["Week 1", 2, 2], ["Week 2", 1, 2]]);
    expect(s2.groups[0].pct).toBe(1);
    expect(tree[0] && summarize(tree, [], []).stages[0].groups).toEqual([]); // a stage without weeks has no groups
  });

  it("puts ungrouped items of a grouped stage into an 'Other' group", () => {
    n = 0;
    const tree = [stage("s", (s) => [item(s, { group: "Week 1" }), item(s)])];
    expect(summarize(tree, [], []).stages[0].groups.map((g) => g.name)).toEqual(["Week 1", OTHER_GROUP]);
  });

  it("records sign-offs and counts the stages passed", () => {
    const tree = roadmap();
    const sum = summarize(tree, [], [{ stageId: "s1", passed: true }, { stageId: "s2", passed: false }]);
    expect(sum.stages.map((s) => s.signedOff)).toEqual([true, false, null]);
    expect(sum.stagesPassed).toBe(1);
  });

  it("gives the same answer from database counts as from item rows", () => {
    const tree = roadmap();
    const rows = [...done(...ids(tree, 0).slice(0, 2)), { itemId: ids(tree, 1)[2], status: "VERIFIED" }, { itemId: ids(tree, 1)[0], status: "NEEDS_WORK" }];
    // What loadCells() returns for the same rows (one row per stage, group and kind).
    const dbCells: Cell[] = [
      { stageId: "s1", group: null, kind: "LESSON", done: 2, verified: 0 },
      { stageId: "s2", group: "Week 1", kind: "LESSON", done: 0, verified: 0 },
      { stageId: "s2", group: "Week 2", kind: "LESSON", done: 1, verified: 1 },
      { stageId: "archived-stage", group: null, kind: "LESSON", done: 5, verified: 0 }, // ignored: not in the tree
    ];
    expect(summarizeCells(tree, dbCells, [])).toEqual(summarize(tree, rows, []));
    expect(summarizeCells(tree, cellsFromProgress(tree, rows), [])).toEqual(summarize(tree, rows, []));
  });

  it("is 0% (not an error) for an empty roadmap or a stage with no required items", () => {
    expect(summarize([], [], []).pct).toBe(0);
    n = 0;
    const tree = [stage("s", (s) => [item(s, { optional: true })])];
    expect(summarize(tree, [], []).stages[0].pct).toBe(0);
  });
});

// ---------- the plan ----------

describe("the cohort plan: where a student should be today", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const weeksLater = (w: number) => new Date(start.getTime() + w * 7 * 24 * 3600 * 1000);

  it("lays stages end to end; alternatives in a choice group share one window", () => {
    const tree = [
      stage("a", () => [], { weeks: 4 }),
      stage("lane1", () => [], { weeks: 3, choiceGroup: "lane", optional: true }),
      stage("lane2", () => [], { weeks: 3, choiceGroup: "lane", optional: true }),
      stage("b", () => [], { weeks: 2 }),
    ];
    const { windows, total } = stageWindows(tree);
    expect(windows).toEqual([{ start: 0, weeks: 4 }, { start: 4, weeks: 3 }, { start: 4, weeks: 3 }, { start: 7, weeks: 2 }]);
    expect(total).toBe(9);
    expect(expectedPct(tree, start, weeksLater(4.5))).toBeCloseTo(4.5 / 9);
  });

  it("gives each stage its own expected share", () => {
    const tree = [stage("a", () => [], { weeks: 4 }), stage("b", () => [], { weeks: 2 }), stage("c", () => [], { weeks: 0 })];
    expect(expectedStagePcts(tree, start, weeksLater(5))).toEqual([1, 0.5, 0]);
    expect(expectedStagePcts(tree, start, weeksLater(6))).toEqual([1, 1, 1]); // a 0-week stage is due once reached
    expect(expectedStagePcts(tree, start, weeksLater(-1))).toEqual([0, 0, 0]); // before the start date
  });

  it("splits a stage's time evenly across its weeks", () => {
    // A stage half-way through, with 4 weeks inside it: weeks 1–2 due, 3–4 not yet.
    expect([0, 1, 2, 3].map((g) => expectedGroupPct(0.5, g, 4))).toEqual([1, 1, 0, 0]);
    expect(expectedGroupPct(0.6, 2, 4)).toBeCloseTo(0.4);
  });

  it("'You are here' is the first required stage not finished and signed off", () => {
    const tree = roadmap();
    expect(currentStageIndex(tree, summarize(tree, [], []))).toBe(0);
    expect(currentStageIndex(tree, summarize(tree, [], [{ stageId: "s1", passed: true }]))).toBe(1);
    const all = [...ids(tree, 0), ...ids(tree, 1)];
    expect(currentStageIndex(tree, summarize(tree, done(...all), [{ stageId: "s1", passed: true }]))).toBe(-1); // optional s3 is skipped
  });
});

// ---------- risk ----------

describe("riskOf: who needs attention", () => {
  const now = new Date("2026-03-01T00:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000);

  it("inactive after more than 14 days, using the join date if nothing was done", () => {
    expect(riskOf({ pct: 0.9 }, 0.5, daysAgo(15), daysAgo(100), now)).toBe("inactive");
    expect(riskOf({ pct: 0.9 }, 0.5, undefined, daysAgo(15), now)).toBe("inactive");
    expect(riskOf({ pct: 0.9 }, 0.5, daysAgo(14), daysAgo(100), now)).toBe(null);
  });

  it("behind when more than 15 points behind the plan", () => {
    expect(riskOf({ pct: 0.34 }, 0.5, daysAgo(1), daysAgo(30), now)).toBe("behind");
    expect(riskOf({ pct: 0.36 }, 0.5, daysAgo(1), daysAgo(30), now)).toBe(null);
  });
});

// ---------- a class ----------

describe("classStages: the whole class at every level", () => {
  it("averages stages, weeks, lessons and projects, and counts finished and signed-off students", () => {
    const tree = roadmap();
    const s1 = ids(tree, 0), s2 = ids(tree, 1);
    const students = [
      summarize(tree, done(...s1.slice(0, 4), s2[0], s2[1]), [{ stageId: "s1", passed: true }]),
      summarize(tree, done(s1[0]), []),
    ];
    const [c1, c2, c3] = classStages(tree, students);
    expect(c1.avg).toBeCloseTo((1 + 0.25) / 2);
    expect(c1.finished).toBe(1);
    expect(c1.signedOff).toBe(1);
    expect(c1.projects.avg).toBeCloseTo(0.5);
    expect(c2.groups.map((g) => [g.name, g.avg])).toEqual([["Week 1", 0.5], ["Week 2", 0]]);
    expect(c3).toMatchObject({ students: 0, avg: 0 }); // optional: nobody started it
    expect(classAverage(students)).toBeCloseTo((students[0].pct + students[1].pct) / 2);
  });

  it("an optional stage averages only the students who started it", () => {
    const tree = roadmap();
    const students = [summarize(tree, done(ids(tree, 2)[0]), []), summarize(tree, [], [])];
    expect(classStages(tree, students)[2]).toMatchObject({ students: 1, avg: 0.5 });
  });

  it("works with no students", () => {
    const tree = roadmap();
    expect(classStages(tree, [])[1].groups.map((g) => g.avg)).toEqual([0, 0]);
    expect(classAverage([])).toBe(0);
  });
});

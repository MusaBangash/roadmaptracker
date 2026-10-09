import { describe, expect, it } from "vitest";
import { averageWait, cohortHistory, mondayOf, paceWord, parseRange, progressByWeek, reviewWeeks, stageCounts, weeksFor, type DatedCell } from "./insights-core";
import { summarizeCells, type CoreItem, type CoreStage } from "./progress-core";

let n = 0;
const item = (stageId: string, over: Partial<CoreItem> = {}): CoreItem => ({ id: `i${++n}`, stageId, kind: "LESSON", group: null, optional: false, ...over });
/** Two stages of 2 weeks, 4 required lessons each. */
const tree: CoreStage[] = ["s1", "s2"].map((id) => ({ id, optional: false, choiceGroup: null, weeks: 2, items: [item(id), item(id), item(id), item(id)] }));
const cell = (stageId: string, done: number, week: string): DatedCell => ({ stageId, group: null, kind: "LESSON", done, verified: 0, week });

describe("weeks", () => {
  it("Monday of a date, like Postgres date_trunc('week')", () => {
    expect(mondayOf(new Date("2026-10-11T23:00:00Z"))).toBe("2026-10-05"); // a Sunday
    expect(mondayOf(new Date("2026-10-12T00:00:00Z"))).toBe("2026-10-12");
  });
  it("last N weeks end with this week", () => {
    const w = weeksFor("4", null, new Date("2026-10-14T10:00:00Z"));
    expect(w).toEqual(["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
  });
  it("since the start begins at the earliest cohort, capped at two years", () => {
    expect(weeksFor("all", new Date("2026-09-30"), new Date("2026-10-14"))).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(weeksFor("all", new Date("2020-01-01"), new Date("2026-10-14"))).toHaveLength(104);
  });
  it("unknown range falls back to 12 weeks", () => expect(parseRange("x")).toBe("12"));
});

describe("progress over time", () => {
  const weeks = ["2026-09-07", "2026-09-14", "2026-09-21"];
  it("adds up what was ticked by the end of each week", () => {
    const cells = [cell("s1", 2, "2026-09-07"), cell("s1", 2, "2026-09-14"), cell("s2", 4, "2026-09-21")];
    expect(progressByWeek(tree, cells, weeks)).toEqual([0.25, 0.5, 1]);
  });
  it("matches today's progress in the last week", () => {
    const cells = [cell("s1", 3, "2026-09-07"), cell("s2", 1, "2026-09-14")];
    const today = summarizeCells(tree, cells.map((c) => ({ stageId: c.stageId, group: c.group, kind: c.kind, done: c.done, verified: c.verified })), []).pct;
    expect(progressByWeek(tree, cells, weeks).at(-1)).toBe(today);
  });
  it("a cohort: average of its students, with the plan, nothing before the start", () => {
    const h = cohortHistory(tree, [[cell("s1", 4, "2026-09-14")], []], weeks, new Date("2026-09-14T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
    expect(h[0]).toEqual({ week: "2026-09-07", avg: null, expected: null });
    expect(h[1].avg).toBe(0.25); // (0.5 + 0) / 2
    expect(h[1].expected).toBeCloseTo(0.25); // 1 of 4 planned weeks
    expect(h[2].expected).toBeCloseTo(0.5);
  });
  it("pace in words", () => {
    expect(paceWord(0.2, 0.3)).toBe("Behind the plan");
    expect(paceWord(0.3, 0.32)).toBe("On the plan");
    expect(paceWord(0.5, 0.3)).toBe("Ahead of the plan");
  });
});

it("counts students on each stage and those who finished", () => {
  const sum = (s1: number, s2: number) => summarizeCells(tree, [
    { stageId: "s1", group: null, kind: "LESSON", done: s1, verified: 0 }, { stageId: "s2", group: null, kind: "LESSON", done: s2, verified: 0 }], []);
  expect(stageCounts(tree, [sum(1, 0), sum(4, 2), sum(4, 4), sum(0, 0)])).toEqual({ counts: [2, 1], finished: 1 });
});

describe("review speed", () => {
  it("counts submissions and decisions per week, outside the range left out", () => {
    const r = reviewWeeks(["2026-09-07", "2026-09-14"],
      [new Date("2026-09-08"), new Date("2026-09-15"), new Date("2026-08-01")],
      [{ at: new Date("2026-09-16"), verified: true }, { at: new Date("2026-09-17"), verified: false }]);
    expect(r).toEqual([
      { week: "2026-09-07", submitted: 1, verified: 0, sentBack: 0 },
      { week: "2026-09-14", submitted: 1, verified: 1, sentBack: 1 },
    ]);
  });
  it("average wait ignores missing and impossible waits", () => {
    expect(averageWait([1, 2, null, -3])).toBe(1.5);
    expect(averageWait([])).toBeNull();
  });
});

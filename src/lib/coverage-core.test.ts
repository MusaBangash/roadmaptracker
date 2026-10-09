import { describe, expect, it } from "vitest";
import { coverageOf, presentToMark, taughtNotLearned, teachStatus } from "./coverage-core";
import { canTeachCohort } from "./access-core";
import type { CoreItem, CoreStage } from "./progress-core";

let n = 0;
const item = (stageId: string, over: Partial<CoreItem> = {}): CoreItem => ({ id: `i${++n}`, stageId, kind: "LESSON", group: null, optional: false, ...over });
const stage = (id: string, items: (s: string) => CoreItem[], over: Partial<CoreStage> = {}): CoreStage =>
  ({ id, optional: false, choiceGroup: null, weeks: 2, items: items(id), ...over });

/** s1 (2 weeks): 2 lessons + 1 project.  s2 (4 weeks): Week 1 and Week 2 of 2 lessons each, plus a milestone.  s3: optional. */
function roadmap() {
  n = 0;
  return [
    stage("s1", (s) => [item(s), item(s), item(s, { kind: "PROJECT" })]),
    stage("s2", (s) => [
      item(s, { group: "Week 1" }), item(s, { group: "Week 1" }),
      item(s, { group: "Week 2" }), item(s, { group: "Week 2" }), item(s, { group: "Week 2", kind: "MILESTONE" }),
    ], { weeks: 4 }),
    stage("s3", (s) => [item(s), item(s)], { optional: true, choiceGroup: "lane" }),
  ];
}
const start = new Date("2026-01-05T00:00:00Z");
const weeksLater = (w: number) => new Date(start.getTime() + w * 7 * 24 * 3600 * 1000);
const taughtMap = (ids: string[], on = "2026-01-06") => new Map(ids.map((id) => [id, on]));
const lessonIds = (tree: CoreStage[], i: number) => tree[i].items.filter((x) => x.kind === "LESSON").map((x) => x.id);

describe("teachStatus", () => {
  const w = { start: 2, end: 4 };
  it("is taught once every lesson is taught, whatever the date", () => expect(teachStatus(3, 3, w, 10)).toBe("taught"));
  it("is upcoming before the plan reaches it, due during it, behind after it", () => {
    expect(teachStatus(3, 0, w, 1)).toBe("upcoming");
    expect(teachStatus(3, 1, w, 3)).toBe("due");
    expect(teachStatus(3, 2, w, 4)).toBe("behind");
  });
  it("has no status with nothing to teach, and an optional stage is never behind", () => {
    expect(teachStatus(0, 0, w, 9)).toBeNull();
    expect(teachStatus(3, 0, w, 9, true)).toBeNull();
  });
});

describe("coverageOf: what a cohort has been taught", () => {
  it("counts lessons only — projects and milestones are never taught", () => {
    const tree = roadmap();
    const c = coverageOf(tree, new Map(), start, weeksLater(0));
    expect(c.stages[0].required).toBe(2);
    expect(c.stages[1].required).toBe(4);
    expect(c.required).toBe(6); // the optional stage is not counted until teaching in it starts
  });

  it("splits a stage's plan window evenly across its weeks", () => {
    const tree = roadmap();
    const s2 = coverageOf(tree, new Map(), start, weeksLater(0)).stages[1];
    expect(s2.window).toEqual({ start: 2, end: 6 });
    expect(s2.groups.map((g) => [g.name, g.window])).toEqual([["Week 1", { start: 2, end: 4 }], ["Week 2", { start: 4, end: 6 }]]);
  });

  it("marks weeks behind once their plan dates pass, and finds the next thing to teach", () => {
    const tree = roadmap();
    const c = coverageOf(tree, taughtMap(lessonIds(tree, 0)), start, weeksLater(4.5)); // s1 taught; Week 1 over; Week 2 running
    expect(c.stages[0].status).toBe("taught");
    expect(c.stages[1].groups.map((g) => g.status)).toEqual(["behind", "due"]);
    expect(c.behind).toBe(1);
    expect(c.next).toEqual({ stageIndex: 1, groupIndex: 0 });
    expect(c.pct).toBeCloseTo(2 / 6);
  });

  it("remembers the latest date taught", () => {
    const tree = roadmap();
    const [a, b] = lessonIds(tree, 0);
    const c = coverageOf(tree, new Map([[a, "2026-01-07"], [b, "2026-01-12"]]), start, weeksLater(1));
    expect(c.stages[0].lastTaughtOn).toBe("2026-01-12");
  });

  it("has nothing next when everything required is taught; an optional lane counts once started", () => {
    const tree = roadmap();
    const all = [...lessonIds(tree, 0), ...lessonIds(tree, 1)];
    const done = coverageOf(tree, taughtMap(all), start, weeksLater(20));
    expect(done.next).toBeNull();
    expect(done.behind).toBe(0);
    const withLane = coverageOf(tree, taughtMap([...all, lessonIds(tree, 2)[0]]), start, weeksLater(20));
    expect(withLane.required).toBe(8);
    expect(withLane.stages[2].status).toBeNull(); // optional, half taught: no "behind"
  });
});

describe("taughtNotLearned", () => {
  it("warns when most was taught and the class is well behind it", () => {
    expect(taughtNotLearned(1, 0.6)).toBe(true);
    expect(taughtNotLearned(1, 0.8)).toBe(false);
    expect(taughtNotLearned(0.4, 0)).toBe(false); // not enough taught yet to judge
  });
});

describe("presentToMark: mark done for present students", () => {
  const enrollments = [
    { id: "a", status: "ACTIVE" }, { id: "b", status: "ACTIVE" }, { id: "c", status: "PAUSED" }, { id: "d", status: "ACTIVE" },
  ];
  it("ticks only active students who were present and have not ticked it themselves", () => {
    expect(presentToMark(enrollments, new Set(["a", "b", "c"]), new Set(["b"]))).toEqual(["a"]);
  });
  it("ticks nobody when nobody was present", () => {
    expect(presentToMark(enrollments, new Set(), new Set())).toEqual([]);
  });
});

describe("canTeachCohort: who may mark a cohort's teaching", () => {
  const cohort = { orgId: "school-1" };
  it("lets the school's admin teach any of its cohorts", () => {
    expect(canTeachCohort({ userId: "u", orgId: "school-1", role: "ADMIN" }, cohort, [])).toBe(true);
  });
  it("lets an instructor teach only cohorts they are assigned to", () => {
    expect(canTeachCohort({ userId: "t1", orgId: "school-1", role: "INSTRUCTOR" }, cohort, ["t1"])).toBe(true);
    expect(canTeachCohort({ userId: "t2", orgId: "school-1", role: "INSTRUCTOR" }, cohort, ["t1"])).toBe(false);
  });
  it("never lets a student teach, even one listed by mistake", () => {
    expect(canTeachCohort({ userId: "s", orgId: "school-1", role: "STUDENT" }, cohort, ["s"])).toBe(false);
  });
  it("never crosses schools, even for an admin", () => {
    expect(canTeachCohort({ userId: "u", orgId: "school-2", role: "ADMIN" }, cohort, [])).toBe(false);
    expect(canTeachCohort({ userId: "t1", orgId: "school-2", role: "INSTRUCTOR" }, cohort, ["t1"])).toBe(false);
    expect(canTeachCohort({ userId: "u", orgId: null, role: null }, cohort, [])).toBe(false);
  });
});

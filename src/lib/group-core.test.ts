import { describe, expect, it } from "vitest";
import { groupNameProblem, groupTotals, inGroup, matchesShow, parseGroup, parseShow } from "./group-core";

describe("group names", () => {
  it("need 2 to 40 characters and must be new in the school, any case", () => {
    expect(groupNameProblem("Morning Boys", [])).toBeNull();
    expect(groupNameProblem(" a ", [])).toMatch(/2 to 40/);
    expect(groupNameProblem("x".repeat(41), [])).toMatch(/2 to 40/);
    expect(groupNameProblem("morning boys ", ["Morning Boys"])).toBe('There is already a group called "morning boys".');
  });
});

describe("hostel filter", () => {
  it("reads the address and matches students", () => {
    expect(parseShow("hostel")).toBe("hostel");
    expect(parseShow("x")).toBe("all");
    expect(matchesShow("all", null)).toBe(true);
    expect(matchesShow("hostel", "HOSTEL")).toBe(true);
    expect(matchesShow("hostel", null)).toBe(false);
    expect(matchesShow("day", "DAY")).toBe(true);
    expect(matchesShow("day", "HOSTEL")).toBe(false);
  });
});

describe("group filter", () => {
  it("accepts only this school's groups, or none", () => {
    expect(parseGroup("g1", ["g1"])).toBe("g1");
    expect(parseGroup("other-school", ["g1"])).toBeNull();
    expect(parseGroup("none", ["g1"])).toBe("none");
    expect(inGroup(null, "g1")).toBe(true);
    expect(inGroup("g1", "g2")).toBe(false);
    expect(inGroup("none", null)).toBe(true);
  });
});

describe("groupTotals", () => {
  it("adds up today's attendance per group, in order, No group last", () => {
    const groups = [{ id: "mb", name: "Morning Boys" }, { id: "eg", name: "Evening Girls" }, { id: "x", name: "Unused" }];
    const t = groupTotals([
      { groupId: "eg", present: 20, marked: 24, taken: true },
      { groupId: "mb", present: 30, marked: 31, taken: true },
      { groupId: "eg", present: 0, marked: 0, taken: false },
      { groupId: null, present: 5, marked: 6, taken: true },
    ], groups);
    expect(t).toEqual([
      { id: "mb", name: "Morning Boys", classes: 1, present: 30, marked: 31, notTaken: 0 },
      { id: "eg", name: "Evening Girls", classes: 2, present: 20, marked: 24, notTaken: 1 },
      { id: null, name: "No group", classes: 1, present: 5, marked: 6, notTaken: 0 },
    ]);
  });
});

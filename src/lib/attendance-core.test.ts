import { describe, expect, it } from "vitest";
import { attendanceSummary, buildRegister, daysOfMonth, monthLabel, monthsWithRecords, parseMonth, shiftMonth, weekdayOf } from "./attendance-core";

describe("months and days", () => {
  it("reads a month from the address, else uses the fallback", () => {
    expect(parseMonth("2026-10", "2026-01")).toBe("2026-10");
    expect(parseMonth("2026-13", "2026-01")).toBe("2026-01");
    expect(parseMonth("x", "2026-01")).toBe("2026-01");
    expect(parseMonth(undefined, "2026-01")).toBe("2026-01");
  });
  it("moves across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("knows month lengths, leap years and weekdays (Monday first)", () => {
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2028-02")).toHaveLength(29);
    expect(daysOfMonth("2026-10")[0]).toBe("2026-10-01");
    expect(weekdayOf("2026-10-05")).toBe(0); // a Monday
    expect(weekdayOf("2026-10-11")).toBe(6); // a Sunday
    expect(monthLabel("2026-10")).toBe("October 2026");
  });
});

describe("attendanceSummary", () => {
  it("counts present and class days", () => {
    expect(attendanceSummary([{ present: true }, { present: true }, { present: false }, { present: true }])).toEqual({ present: 3, absent: 1, total: 4, pct: 0.75 });
  });
  it("has no percentage before any class day", () => {
    expect(attendanceSummary([]).pct).toBeNull();
  });
});

describe("buildRegister", () => {
  const students = [{ enrollmentId: "a", name: "Ayesha" }, { enrollmentId: "b", name: "Bilal" }];
  const records = [
    { enrollmentId: "a", date: "2026-10-06", present: true }, { enrollmentId: "b", date: "2026-10-06", present: false },
    { enrollmentId: "a", date: "2026-10-01", present: true },
    { enrollmentId: "a", date: "2026-10-08", present: false }, { enrollmentId: "b", date: "2026-10-08", present: true },
    { enrollmentId: "a", date: "2026-09-30", present: true }, // another month
  ];
  const r = buildRegister(students, records, "2026-10");
  it("has the month's class days as columns, in order", () => {
    expect(r.days).toEqual(["2026-10-01", "2026-10-06", "2026-10-08"]);
  });
  it("marks P/A per student and day; blank when there is no mark (e.g. joined later)", () => {
    expect(r.rows[0].cells).toEqual(["P", "P", "A"]);
    expect(r.rows[1].cells).toEqual([null, "A", "P"]);
  });
  it("totals per student count only their marked days", () => {
    expect(r.rows[0]).toMatchObject({ present: 2, total: 3 });
    expect(r.rows[1]).toMatchObject({ present: 1, total: 2, pct: 0.5 });
    expect(r.presentPerDay).toEqual([1, 1, 1]);
  });
  it("an empty month has no columns", () => {
    expect(buildRegister(students, records, "2026-11").days).toEqual([]);
  });
  it("lists months with class days, newest first", () => {
    expect(monthsWithRecords(records)).toEqual(["2026-10", "2026-09"]);
  });
});

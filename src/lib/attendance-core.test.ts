import { describe, expect, it } from "vitest";
import { remindFrom, absentStreak, addDays, attendanceFlag, attendanceSummary, buildRegister, classDaysLabel, dayLabel, daysOfMonth, flagWords, isClassDay, missedClassDays, monthLabel, monthsWithRecords, parseClassDays, parseMonth, shiftMonth, weekdayOf, type AttendanceRecord, type AttendanceStatus } from "./attendance-core";

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

const P = "PRESENT", A = "ABSENT", L = "LATE", LV = "LEAVE";
const st = (...x: AttendanceStatus[]) => x.map((status) => ({ status }));

describe("attendanceSummary", () => {
  it("Late counts as present; Leave doesn't lower the percentage", () => {
    expect(attendanceSummary(st(P, P, A, L, LV))).toEqual({ present: 3, late: 1, absent: 1, leave: 1, total: 5, counted: 4, pct: 0.75 });
  });
  it("has no percentage before any class day, or when every day was leave", () => {
    expect(attendanceSummary([]).pct).toBeNull();
    expect(attendanceSummary(st(LV, LV)).pct).toBeNull();
  });
});

describe("buildRegister", () => {
  const students = [{ enrollmentId: "a", name: "Ayesha" }, { enrollmentId: "b", name: "Bilal" }];
  const records: AttendanceRecord[] = [
    { enrollmentId: "a", date: "2026-10-06", status: P }, { enrollmentId: "b", date: "2026-10-06", status: A },
    { enrollmentId: "a", date: "2026-10-01", status: L },
    { enrollmentId: "a", date: "2026-10-08", status: A }, { enrollmentId: "b", date: "2026-10-08", status: LV },
    { enrollmentId: "a", date: "2026-09-30", status: P }, // another month
  ];
  const r = buildRegister(students, records, "2026-10");
  it("has the month's class days as columns, in order", () => {
    expect(r.days).toEqual(["2026-10-01", "2026-10-06", "2026-10-08"]);
  });
  it("marks P/A/L/Lv per student and day; blank when there is no mark (e.g. joined later)", () => {
    expect(r.rows[0].cells).toEqual(["L", "P", "A"]);
    expect(r.rows[1].cells).toEqual([null, "A", "Lv"]);
  });
  it("totals per student and per day", () => {
    expect(r.rows[0]).toMatchObject({ present: 2, late: 1, absent: 1, total: 3, counted: 3 });
    expect(r.rows[1]).toMatchObject({ present: 0, leave: 1, counted: 1, pct: 0 });
    expect(r.perDay).toEqual([{ present: 1, absent: 0, late: 1, leave: 0 }, { present: 1, absent: 1, late: 0, leave: 0 }, { present: 0, absent: 1, late: 0, leave: 1 }]);
    expect(r.presentPerDay).toEqual([1, 1, 0]);
  });
  it("an empty month has no columns", () => {
    expect(buildRegister(students, records, "2026-11").days).toEqual([]);
  });
  it("lists months with class days, newest first", () => {
    expect(monthsWithRecords(records)).toEqual(["2026-10", "2026-09"]);
  });
});

describe("attendance warnings", () => {
  it("counts absences in a row at the end; leave is skipped, late breaks it", () => {
    expect(absentStreak([P, A, A, A])).toBe(3);
    expect(absentStreak([A, A, LV, A])).toBe(3);
    expect(absentStreak([A, A, L])).toBe(0);
    expect(absentStreak([])).toBe(0);
  });
  it("flags 3 absences in a row first, then below 75% once 4 class days count", () => {
    expect(attendanceFlag([P, A, A, A])).toEqual({ kind: "streak", days: 3 });
    expect(attendanceFlag([A, P, A, P])).toEqual({ kind: "low", pct: 0.5 });
    expect(attendanceFlag([A, P, P])).toBeNull(); // only 3 days so far
    expect(attendanceFlag([P, P, P, A])).toBeNull(); // exactly 75% is fine
    expect(attendanceFlag([A, LV, LV, LV, P, P, P])).toBeNull(); // leave doesn't count against them
    expect(flagWords({ kind: "streak", days: 4 })).toBe("Absent 4 class days in a row");
    expect(flagWords({ kind: "low", pct: 0.6 })).toBe("Attendance 60%");
  });
});

describe("class days", () => {
  it("reads weekdays from a form", () => {
    expect(parseClassDays(["3", "0", "1", "1", "9", "x", "2"])).toEqual([0, 1, 2, 3]);
  });
  it("says them in short words", () => {
    expect(classDaysLabel([0, 1, 2, 3])).toBe("Mon–Thu");
    expect(classDaysLabel([0, 2, 4])).toBe("Mon, Wed, Fri");
    expect(classDaysLabel([5, 6])).toBe("Sat, Sun");
    expect(classDaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(classDaysLabel(null)).toBeNull();
  });
  it("finds class days before today with no attendance, newest first, not before the start", () => {
    // Mon–Thu class; today Tue 13 Oct 2026; taken on Mon 12 and Wed 7.
    const missed = missedClassDays([0, 1, 2, 3], new Set(["2026-10-12", "2026-10-07"]), "2026-10-05", "2026-10-13");
    expect(missed).toEqual(["2026-10-08", "2026-10-06", "2026-10-05"]);
    expect(isClassDay([0, 1, 2, 3], "2026-10-13")).toBe(true);
    expect(isClassDay([0, 1, 2, 3], "2026-10-09")).toBe(false); // a Friday
    expect(missedClassDays(null, new Set(), "2026-01-01", "2026-10-13")).toEqual([]);
    expect(dayLabel("2026-10-13")).toBe("Tue 13 Oct 2026");
    // Class days set on 12 Oct: earlier days are never "missed".
    expect(missedClassDays([0, 1, 2, 3], new Set(), remindFrom("2026-09-01", "2026-10-12"), "2026-10-13")).toEqual(["2026-10-12"]);
    expect(remindFrom("2026-10-05", null)).toBe("2026-10-05");
    expect(remindFrom("2026-10-05", "2026-09-01")).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

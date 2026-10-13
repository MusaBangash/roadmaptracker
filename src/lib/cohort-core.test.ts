import { describe, expect, it } from "vitest";
import { canApply, canChangeTrack, cohortChanges, inClass, leaveDetails, leaveLabel, leaveWords, statusAfterJoin, type EnrollmentStatus } from "./cohort-core";

const titles: Record<string, string> = { t1: "AI Engineer", t2: "Web Designing" };
const title = (id: string) => titles[id] ?? id;
const before = { name: "Batch 1", startDate: "2026-10-01", trackId: "t1" };

describe("cohortChanges", () => {
  it("is null when nothing changed", () => {
    expect(cohortChanges(before, { ...before }, title)).toBeNull();
  });
  it("lists each change in words, tracks by title", () => {
    expect(cohortChanges(before, { name: "Batch 2", startDate: "2026-10-05", trackId: "t2" }, title))
      .toBe("name: Batch 1 → Batch 2; start: 2026-10-01 → 2026-10-05; track: AI Engineer → Web Designing");
  });
});

describe("cohortChanges: class days", () => {
  it("logs class days in words, only when they change", () => {
    expect(cohortChanges({ ...before, classDays: null }, { ...before, classDays: [0, 1, 2, 3] }, title)).toBe("class days: not set → Mon–Thu");
    expect(cohortChanges({ ...before, classDays: [0, 2] }, { ...before, classDays: [0, 2] }, title)).toBeNull();
  });
});

describe("canChangeTrack", () => {
  it("only while nobody is enrolled", () => {
    expect(canChangeTrack(0)).toBe(true);
    expect(canChangeTrack(1)).toBe(false);
  });
});

describe("waiting list", () => {
  it("only waiting and turned-away people are outside the class", () => {
    expect(["ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"].every((s) => inClass(s as EnrollmentStatus))).toBe(true);
    expect(inClass("PENDING")).toBe(false);
    expect(inClass("DECLINED")).toBe(false);
  });
  it("joining with a link waits for a teacher; turned away stays turned away", () => {
    expect(statusAfterJoin(null)).toBe("PENDING");
    expect(statusAfterJoin("WITHDRAWN")).toBe("PENDING");
    expect(statusAfterJoin("DECLINED")).toBe("DECLINED");
    expect(statusAfterJoin("ACTIVE")).toBe("ACTIVE");
    expect(statusAfterJoin("PAUSED")).toBe("PAUSED");
  });
  it("each action only changes the places it is meant for", () => {
    expect(canApply("accept", "PENDING")).toBe(true);
    expect(canApply("accept", "DECLINED")).toBe(true);
    expect(canApply("accept", "WITHDRAWN")).toBe(false);
    expect(canApply("decline", "PENDING")).toBe(true);
    expect(canApply("decline", "ACTIVE")).toBe(false);
    expect(canApply("withdraw", "ACTIVE")).toBe(true);
    expect(canApply("withdraw", "PENDING")).toBe(false);
    expect(canApply("withdraw", "WITHDRAWN")).toBe(false);
  });
});

describe("leaveDetails", () => {
  const today = "2026-10-13";
  it("clears the details for any status but Withdrawn", () => {
    expect(leaveDetails("ACTIVE", { leftOn: "2026-10-01", reason: "FEES" }, today)).toEqual({ leftOn: null, leftReason: null, leftNote: null });
  });
  it("Withdrawn needs a reason from the list and a real date, not in the future", () => {
    expect(leaveDetails("WITHDRAWN", { leftOn: today }, today)).toEqual({ error: "Choose why the student left." });
    expect(leaveDetails("WITHDRAWN", { leftOn: today, reason: "REMOVED" }, today)).toEqual({ error: "Choose why the student left." });
    expect(leaveDetails("WITHDRAWN", { leftOn: "2026-02-30", reason: "FEES" }, today)).toEqual({ error: "Choose the date the student left." });
    expect(leaveDetails("WITHDRAWN", { leftOn: "2026-10-14", reason: "FEES" }, today)).toEqual({ error: "The date they left can't be in the future." });
  });
  it("Other needs a note; notes are trimmed and empty ones dropped", () => {
    expect(leaveDetails("WITHDRAWN", { leftOn: today, reason: "OTHER", note: "  " }, today)).toEqual({ error: "For Other, write a few words about why." });
    expect(leaveDetails("WITHDRAWN", { leftOn: "2026-10-01", reason: "MOVED", note: "  to Lahore " }, today))
      .toEqual({ leftOn: "2026-10-01", leftReason: "MOVED", leftNote: "to Lahore" });
    expect(leaveDetails("WITHDRAWN", { leftOn: today, reason: "JOB", note: "" }, today)).toEqual({ leftOn: today, leftReason: "JOB", leftNote: null });
  });
  it("reads as words for the activity log", () => {
    expect(leaveWords({ leftOn: "2026-10-01", leftReason: "MOVED", leftNote: "to Lahore" })).toBe("Moved away, left 2026-10-01: to Lahore");
    expect(leaveLabel("NOPE")).toBeNull();
  });
});

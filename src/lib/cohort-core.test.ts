import { describe, expect, it } from "vitest";
import { canApply, canChangeTrack, cohortChanges, inClass, statusAfterJoin, type EnrollmentStatus } from "./cohort-core";

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

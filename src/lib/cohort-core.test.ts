import { describe, expect, it } from "vitest";
import { canChangeTrack, cohortChanges } from "./cohort-core";

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

import { describe, expect, it } from "vitest";
import { cellsOf, checkLab, inspectionDue, inspectionSummary, itemList, readFindings, reconcile, ROOM, stations, type Finding } from "./lab-core";

const lab = { pcCount: 3, pcItems: ["Screen", "Mouse"], roomItems: ["Projector"] };

describe("lab setup", () => {
  it("cleans item lists (commas or lines, no blanks or repeats)", () => {
    expect(itemList("Screen, mouse\n Mouse \n\nKeyboard,")).toEqual(["Screen", "mouse", "Keyboard"]);
  });
  it("checks the lab form in plain words", () => {
    const ok = { name: " AI  Lab 03 ", pcCount: "12", pcItems: "Screen, Mouse", roomItems: "Projector" };
    expect(checkLab(ok)).toEqual({ name: "AI Lab 03", pcCount: 12, pcItems: ["Screen", "Mouse"], roomItems: ["Projector"] });
    expect(checkLab({ ...ok, name: "A" })).toHaveProperty("error");
    expect(checkLab({ ...ok, pcCount: "2.5" })).toHaveProperty("error");
    expect(checkLab({ ...ok, pcCount: "101" })).toHaveProperty("error");
    expect(checkLab({ ...ok, pcItems: " , " })).toEqual({ error: "Say what is checked on each PC, e.g. Screen, Keyboard, Mouse." });
    expect(checkLab({ ...ok, pcCount: "0", roomItems: "" })).toHaveProperty("error");
    expect(checkLab({ ...ok, pcItems: "x".repeat(41) })).toHaveProperty("error");
  });
  it("lists every PC's items, then the room's", () => {
    expect(stations(3)).toEqual(["PC 1", "PC 2", "PC 3"]);
    expect(cellsOf(lab)).toHaveLength(7);
    expect(cellsOf(lab).at(-1)).toEqual({ station: ROOM, item: "Projector" });
  });
});

describe("readFindings", () => {
  const form: Record<string, string> = {
    "c|PC 1|Mouse": "MISSING", "n|PC 1|Mouse": "  taken   home ",
    "c|PC 2|Screen": "OK",
    "c|Room|Projector": "NOT_WORKING",
    "c|PC 9|Mouse": "MISSING", // no PC 9 in this lab
    "c|PC 3|Screen": "EXPLODED", // not a status
  };
  it("keeps only real problems on things the lab has", () => {
    expect(readFindings(lab, (k) => form[k] ?? "")).toEqual([
      { station: "PC 1", item: "Mouse", status: "MISSING", note: "taken home" },
      { station: ROOM, item: "Projector", status: "NOT_WORKING", note: "" },
    ]);
  });
});

describe("inspectionSummary", () => {
  it("counts PCs with nothing wrong and problems by kind", () => {
    const f: Finding[] = [
      { station: "PC 1", item: "Mouse", status: "MISSING", note: "" }, { station: "PC 1", item: "Screen", status: "DAMAGED", note: "" },
      { station: ROOM, item: "Projector", status: "NOT_WORKING", note: "" },
    ];
    expect(inspectionSummary(lab, f)).toEqual({ pcsWorking: 2, pcCount: 3, problems: 3, byStatus: { MISSING: 1, NOT_WORKING: 1, DAMAGED: 1 }, roomProblems: 1 });
  });
});

describe("reconcile", () => {
  const open = [
    { id: "a", station: "PC 1", item: "Mouse", status: "MISSING" as const, note: null },
    { id: "b", station: "PC 2", item: "Screen", status: "DAMAGED" as const, note: "crack" },
    { id: "c", station: "PC 7", item: "Mouse", status: "MISSING" as const, note: null }, // PC 7 no longer on the lab
  ];
  it("opens new problems, updates ones found again, and fixes ones now OK", () => {
    const r = reconcile(lab, open, [
      { station: "PC 1", item: "Mouse", status: "NOT_WORKING", note: "found, broken" },
      { station: ROOM, item: "Projector", status: "NOT_WORKING", note: "" },
    ]);
    expect(r.create.map((f) => f.item)).toEqual(["Projector"]);
    expect(r.update).toEqual([{ id: "a", status: "NOT_WORKING", note: "found, broken" }]);
    expect(r.fixed.map((f) => f.id)).toEqual(["b"]);
  });
  it("found again unchanged: nothing to write", () => {
    const r = reconcile(lab, [open[0]], [{ station: "PC 1", item: "Mouse", status: "MISSING", note: "" }]);
    expect(r).toEqual({ create: [], update: [], fixed: [] });
  });
});

describe("inspectionDue", () => {
  it("is due with no inspection, or more than a month after the last", () => {
    expect(inspectionDue(null, "2026-10-10")).toBe(true);
    expect(inspectionDue("2026-09-15", "2026-10-10")).toBe(false);
    expect(inspectionDue("2026-09-01", "2026-10-10")).toBe(true);
  });
});

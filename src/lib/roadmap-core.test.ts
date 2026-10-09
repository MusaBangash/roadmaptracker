import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { diffDocs, edit, hasChanges, makeKey, parseTrackDoc, publishProblems, RoadmapEditError, schoolSlug, isOfficialSlug, type TrackDoc } from "./roadmap-core";
import { canCopyTrack, canEditTrack, canSeeTrack, canUseTrack } from "./access-core";

const doc = (): TrackDoc => ({
  title: "Web basics", kind: "COURSE",
  stages: [
    { key: "html", title: "HTML", weeks: 2, items: [
      { key: "tags", title: "Tags", kind: "LESSON", group: "Week 1" },
      { key: "forms", title: "Forms", kind: "LESSON", group: "Week 2" },
      { key: "page", title: "Build a page", kind: "PROJECT" },
    ] },
    { key: "css", title: "CSS", weeks: 3, items: [{ key: "boxes", title: "Box model", kind: "LESSON" }] },
  ],
});

describe("parseTrackDoc", () => {
  it("accepts every official roadmap file", () => {
    const dir = path.join(process.cwd(), "content", "tracks");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const r = parseTrackDoc(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
      expect(r.ok ? [] : r.errors, f).toEqual([]);
    }
  });
  it("names the stage and item that is wrong, in plain English", () => {
    const bad = { title: "X", stages: [{ key: "a", title: "A", items: [] }, { key: "b", title: "", items: [{ key: "c", title: "C", kind: "QUIZ" }] }] };
    const r = parseTrackDoc(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("Stage 2: needs a title");
      expect(r.errors).toContain("Stage 2, item 1: kind must be LESSON, PROJECT, DELIVERABLE or MILESTONE");
    }
  });
  it("says what is missing", () => {
    const r = parseTrackDoc({ stages: [{ key: "a", title: "A" }] });
    expect(r.ok ? [] : r.errors).toEqual(["The roadmap: needs a title", "Stage 1: has no items list"]);
  });
  it("refuses two stages, or two items in one stage, with the same key", () => {
    const d = doc();
    d.stages[1].key = "html";
    d.stages[0].items[1].key = "tags";
    const r = parseTrackDoc(d);
    expect(r.ok ? [] : r.errors).toEqual([
      'Stage 1, item 2: another item in this stage already uses the key "tags"',
      'Stage 2: another stage already uses the key "html"',
    ]);
  });
  it("refuses keys that are not lowercase letters, numbers and dashes", () => {
    const d = doc();
    d.stages[0].key = "HTML basics";
    expect(parseTrackDoc(d).ok).toBe(false);
  });
});

describe("publishProblems", () => {
  it("needs at least one stage and an item in every stage", () => {
    expect(publishProblems({ title: "X", stages: [] })).toEqual(["Add at least one stage."]);
    const d = edit.addStage(doc(), { title: "JS" });
    expect(publishProblems(d)).toEqual(["Stage 3 “JS” has no lessons or projects yet."]);
    expect(publishProblems(doc())).toEqual([]);
  });
});

describe("keys and slugs", () => {
  it("makes a key from the title that doesn't clash", () => {
    expect(makeKey("Box Model & Flexbox!", [])).toBe("box-model-flexbox");
    expect(makeKey("Tags", ["tags", "tags-2"])).toBe("tags-3");
    expect(makeKey("اردو", [])).toBe("item");
  });
  it("gives a school roadmap a slug that can never be an official one", () => {
    const s = schoolSlug("demo-school", "AI Engineer", () => false);
    expect(s).toBe("demo-school--ai-engineer");
    expect(isOfficialSlug(s)).toBe(false);
    expect(isOfficialSlug("ai-engineer")).toBe(true);
    expect(schoolSlug("demo-school", "AI Engineer", (x) => x === s)).toBe(`${s}-2`);
  });
});

describe("edit", () => {
  it("keeps an item's key when its title changes, so student progress is kept", () => {
    const d = edit.updateItem(doc(), "html", "tags", { title: "HTML tags and attributes", kind: "LESSON", group: "Week 1" });
    expect(d.stages[0].items[0]).toEqual({ key: "tags", title: "HTML tags and attributes", kind: "LESSON", group: "Week 1" });
  });
  it("adds stages and items at the end with new keys", () => {
    let d = edit.addStage(doc(), { title: "HTML", weeks: 1, optional: false, goal: "" });
    expect(d.stages[2]).toEqual({ key: "html-2", title: "HTML", weeks: 1, items: [] });
    d = edit.addItem(d, "html", { title: "Tags", kind: "PROJECT" });
    expect(d.stages[0].items.map((i) => i.key)).toEqual(["tags", "forms", "page", "tags-2"]);
  });
  it("moves up and down, and stays put at the ends", () => {
    let d = edit.moveStage(doc(), "css", -1);
    expect(d.stages.map((s) => s.key)).toEqual(["css", "html"]);
    d = edit.moveStage(d, "css", -1);
    expect(d.stages.map((s) => s.key)).toEqual(["css", "html"]);
    d = edit.moveItem(d, "html", "tags", 1);
    expect(d.stages[1].items.map((i) => i.key)).toEqual(["forms", "tags", "page"]);
  });
  it("keeps the stage fields the builder doesn't show", () => {
    const d0 = doc();
    d0.stages[0] = { ...d0.stages[0], benchmark: "Ships a page", choiceGroup: "lane", optional: true };
    const d = edit.updateStage(d0, "html", { title: "HTML 5", weeks: 4 });
    expect(d.stages[0]).toMatchObject({ key: "html", title: "HTML 5", weeks: 4, benchmark: "Ships a page", choiceGroup: "lane" });
    expect(d.stages[0].optional).toBeUndefined();
  });
  it("refuses to edit something that is no longer there", () => {
    expect(() => edit.removeItem(doc(), "html", "gone")).toThrow(RoadmapEditError);
    expect(() => edit.updateStage(doc(), "gone", { title: "X" })).toThrow(RoadmapEditError);
  });
  it("never changes the roadmap it was given", () => {
    const d = doc();
    const before = JSON.stringify(d);
    edit.removeStage(d, "html"); edit.moveItem(d, "html", "tags", 1); edit.updateItem(d, "css", "boxes", { title: "Y" });
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe("diffDocs", () => {
  it("finds nothing when nothing changed", () => expect(hasChanges(diffDocs(doc(), doc()))).toBe(false));
  it("ignores the order fields are written in, empty text and missing weeks", () => {
    const d = doc();
    d.stages[0] = { items: d.stages[0].items.map(({ group, kind, ...rest }) => ({ group, ...rest, kind })), weeks: 2, title: "HTML", key: "html", goal: "" };
    d.stages[1].items[0] = { ...d.stages[1].items[0], detail: "", optional: false };
    const w = doc();
    delete w.stages[1].weeks;
    expect(hasChanges(diffDocs(doc(), d))).toBe(false);
    expect(diffDocs({ ...w, stages: [w.stages[1]] }, { ...doc(), stages: [{ ...doc().stages[1], weeks: 0 }] }).stages.changed).toEqual([]);
  });
  it("lists what was added, removed, changed and moved, matched by key", () => {
    let d = edit.updateItem(doc(), "html", "tags", { title: "Tags 2", kind: "LESSON", group: "Week 1" });
    d = edit.removeStage(d, "css");
    d = edit.addItem(d, "html", { title: "Tables" });
    d = edit.moveItem(d, "html", "forms", 1);
    const r = diffDocs(doc(), d);
    expect(r.items).toEqual({ added: ["Tables"], removed: ["Box model"], changed: ["Tags 2"] });
    expect(r.stages).toEqual({ added: [], removed: ["CSS"], changed: [] });
    expect(r.removedKeys).toEqual([["css", "boxes"]]);
    expect(r.reordered).toBe(true);
  });
  it("counts everything as added for a roadmap never published", () => {
    const r = diffDocs(null, doc());
    expect(r.stages.added).toEqual(["HTML", "CSS"]);
    expect(r.items.added).toHaveLength(4);
    expect(r.details).toBe(false);
  });
});

describe("roadmap access", () => {
  const admin = { userId: "u", orgId: "school-a", role: "ADMIN" as const };
  const teacher = { ...admin, role: "INSTRUCTOR" as const };
  const otherAdmin = { ...admin, orgId: "school-b" };
  const official = { ownerOrgId: null, status: "PUBLISHED" as const };
  const ownDraft = { ownerOrgId: "school-a", status: "DRAFT" as const };
  const ownLive = { ownerOrgId: "school-a", status: "PUBLISHED" as const };

  it("lets everyone see official roadmaps, but no school edit them", () => {
    expect(canSeeTrack(otherAdmin, official)).toBe(true);
    expect(canEditTrack(admin, official)).toBe(false);
  });
  it("keeps a school's roadmap inside that school", () => {
    for (const t of [ownDraft, ownLive]) {
      expect(canSeeTrack(otherAdmin, t)).toBe(false);
      expect(canEditTrack(otherAdmin, t)).toBe(false);
      expect(canCopyTrack(otherAdmin, t)).toBe(false);
      expect(canUseTrack("school-b", t)).toBe(false);
    }
  });
  it("lets only the owning school's admins edit, and hides drafts from teachers and students", () => {
    expect(canEditTrack(admin, ownDraft)).toBe(true);
    expect(canEditTrack(teacher, ownLive)).toBe(false);
    expect(canSeeTrack(teacher, ownDraft)).toBe(false);
    expect(canSeeTrack(teacher, ownLive)).toBe(true);
    expect(canSeeTrack({ ...admin, role: "STUDENT" }, ownDraft)).toBe(false);
  });
  it("lets cohorts use a school roadmap only once it is published", () => {
    expect(canUseTrack("school-a", ownDraft)).toBe(false);
    expect(canUseTrack("school-a", ownLive)).toBe(true);
    expect(canUseTrack("school-b", official)).toBe(true);
  });
});

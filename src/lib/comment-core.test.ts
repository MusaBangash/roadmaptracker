import { describe, expect, it } from "vitest";
import { canChangeComment, checkCommentBody, hasUrdu, linkify, tooManyComments, unreadFor, waitingForTeacher, COMMENT_MAX } from "./comment-core";

const at = (min: number) => new Date(Date.UTC(2026, 9, 10, 10, min));

describe("checkCommentBody", () => {
  it("trims and accepts normal text", () => expect(checkCommentBody("  Added the README  ")).toEqual({ body: "Added the README" }));
  it("refuses empty text", () => expect(checkCommentBody("   \n ")).toHaveProperty("error"));
  it("refuses more than the limit", () => {
    expect(checkCommentBody("a".repeat(COMMENT_MAX))).toHaveProperty("body");
    expect(checkCommentBody("a".repeat(COMMENT_MAX + 1))).toHaveProperty("error");
  });
});

describe("canChangeComment", () => {
  const c = { authorId: "u1", kind: "COMMENT" as const, ageSeconds: 60, hiddenAt: null };
  it("lets the author change it for 15 minutes", () => {
    expect(canChangeComment({ ...c, ageSeconds: 14 * 60 + 59 }, "u1")).toBe(true);
    expect(canChangeComment({ ...c, ageSeconds: 15 * 60 }, "u1")).toBe(false);
  });
  it("never for someone else, a review decision, or a hidden comment", () => {
    expect(canChangeComment(c, "u2")).toBe(false);
    expect(canChangeComment({ ...c, kind: "NEEDS_WORK" }, "u1")).toBe(false);
    expect(canChangeComment({ ...c, hiddenAt: at(1) }, "u1")).toBe(false);
  });
});

it("limits comments to 20 a minute", () => {
  expect(tooManyComments(19)).toBe(false);
  expect(tooManyComments(20)).toBe(true);
});

describe("waitingForTeacher", () => {
  it("submitted work waits", () => expect(waitingForTeacher("DONE", null)).toBe(true));
  it("a student reply puts sent-back or verified work back in the queue", () => {
    expect(waitingForTeacher("NEEDS_WORK", "STUDENT")).toBe(true);
    expect(waitingForTeacher("VERIFIED", "STUDENT")).toBe(true);
  });
  it("leaves it once the teacher answered", () => expect(waitingForTeacher("NEEDS_WORK", "TEACHER")).toBe(false));
});

describe("unreadFor", () => {
  const list = [
    { authorRole: "TEACHER" as const, body: "Add tests", createdAt: at(1), hiddenAt: null },
    { authorRole: "STUDENT" as const, body: "Done", createdAt: at(2), hiddenAt: null },
    { authorRole: "TEACHER" as const, body: null, createdAt: at(3), hiddenAt: null }, // a verify with no note
    { authorRole: "TEACHER" as const, body: "rude", createdAt: at(4), hiddenAt: at(5) },
  ];
  it("counts the other side's words since last read", () => {
    expect(unreadFor(list, "STUDENT", null)).toBe(1);
    expect(unreadFor(list, "STUDENT", at(1))).toBe(0);
    expect(unreadFor(list, "TEACHER", at(0))).toBe(1);
    expect(unreadFor(list, "TEACHER", at(2))).toBe(0);
  });
});

describe("linkify", () => {
  it("makes links clickable and keeps the full stop out", () => {
    expect(linkify("See https://github.com/a/b. Thanks")).toEqual([
      { text: "See " }, { text: "https://github.com/a/b", href: "https://github.com/a/b" }, { text: ". Thanks" },
    ]);
  });
  it("leaves other schemes as text", () => {
    expect(linkify("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
  });
  it("keeps a bracket that belongs to the link", () => {
    expect(linkify("(https://en.wikipedia.org/wiki/A_(b))")[1].href).toBe("https://en.wikipedia.org/wiki/A_(b)");
  });
});

it("spots Urdu text", () => {
  expect(hasUrdu("شکریہ استاد")).toBe(true);
  expect(hasUrdu("Thank you")).toBe(false);
});

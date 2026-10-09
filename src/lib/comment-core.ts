// Comments on submitted work (feature 3): the rules, pure and tested (comment-core.test.ts).
// Data loading is in src/lib/comments.ts, the actions in src/app/actions/comment.ts.

export const COMMENT_MAX = 2000;
/** Story 5: your own comment can be edited or deleted for this long, then it is fixed. */
export const EDIT_MINUTES = 15;
/** Story 6: at most this many comments per person per minute. */
export const COMMENTS_PER_MINUTE = 20;

export type Side = "STUDENT" | "TEACHER";
export type CommentKind = "COMMENT" | "VERIFIED" | "NEEDS_WORK" | "RESUBMIT";

/** Trimmed text, or a plain-English problem. */
export function checkCommentBody(raw: unknown): { body: string } | { error: string } {
  const body = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!body) return { error: "Write something first." };
  if (body.length > COMMENT_MAX) return { error: `Keep it under ${COMMENT_MAX} characters (now ${body.length}).` };
  return { body };
}

/**
 * Story 5: only the author, only a plain comment, only in the first 15 minutes, and never once hidden.
 * `ageSeconds` comes from the database clock (like created_at), so a wrong computer clock can't stretch the window.
 */
export function canChangeComment(c: { authorId: string | null; kind: CommentKind; ageSeconds: number; hiddenAt: Date | null }, userId: string) {
  return c.authorId === userId && c.kind === "COMMENT" && !c.hiddenAt && c.ageSeconds >= 0 && c.ageSeconds < EDIT_MINUTES * 60;
}

export function tooManyComments(inLastMinute: number) {
  return inLastMinute >= COMMENTS_PER_MINUTE;
}

/**
 * Story 3: work waits for a teacher when it is submitted and not yet checked, or when the student
 * wrote last in its thread (a question or an answer), whatever its status.
 */
export function waitingForTeacher(status: string, lastSide: Side | null) {
  return status === "DONE" || lastSide === "STUDENT";
}

/** Story 4: comments from the other side, with words in them, written after `seenAt`. Hidden ones never count. */
export function unreadFor<C extends { authorRole: Side; body: string | null; createdAt: Date; hiddenAt: Date | null }>(
  comments: C[], side: Side, seenAt: Date | null,
) {
  return comments.filter((c) => c.authorRole !== side && !c.hiddenAt && !!c.body && (!seenAt || c.createdAt > seenAt)).length;
}

export type TextPart = { text: string; href?: string };

/** Story 6: plain text with web links made clickable (http and https only; trailing punctuation stays text). */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /https?:\/\/[^\s<>"]+/gi;
  let last = 0;
  for (let m; (m = re.exec(text)); ) {
    let url = m[0];
    // Drop punctuation that ends the sentence, not the link; a ")" stays only when it closes a "(" in the link.
    const count = (s: string, ch: string) => s.split(ch).length - 1;
    while (/[.,;:!?)\]'’”]$/.test(url) && !(url.endsWith(")") && count(url, "(") >= count(url, ")"))) url = url.slice(0, -1);
    let href: string | undefined;
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") href = u.toString();
    } catch { /* not a link after all */ }
    if (!href) continue;
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: url, href });
    last = m.index + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** True when the text has Urdu/Arabic letters (shown in Nastaliq, right to left). */
export function hasUrdu(s: string) {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);
}

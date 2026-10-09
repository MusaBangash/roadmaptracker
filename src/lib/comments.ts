import "server-only";
import { and, asc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { canChangeComment, type CommentKind, type Side } from "@/lib/comment-core";
import { translator, type T } from "@/i18n/core";

export * from "@/lib/comment-core";

/** One comment as the thread shows it to one viewer (ready to pass to the browser). */
export type CommentView = {
  id: string;
  author: string;
  side: Side;
  kind: CommentKind;
  /** Null for a hidden comment (admins get the text in `hiddenText`) or a review with no note. */
  body: string | null;
  hiddenText: string | null;
  hidden: boolean;
  when: string;
  edited: boolean;
  canChange: boolean;
};

export type CommentRow = Awaited<ReturnType<typeof loadComments>>[number];

/** Seconds since a comment was written, by the database clock (comment times all come from it). */
export const commentAge = sql<number>`extract(epoch from now() - ${schema.comments.createdAt})::float8`.mapWith(Number);

/** Every comment on these students' work, oldest first, with the author's name. */
export async function loadComments(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return [];
  return db.select({
    id: schema.comments.id, enrollmentId: schema.comments.enrollmentId, itemId: schema.comments.itemId,
    authorId: schema.comments.authorId, authorRole: schema.comments.authorRole, kind: schema.comments.kind,
    body: schema.comments.body, createdAt: schema.comments.createdAt, editedAt: schema.comments.editedAt,
    hiddenAt: schema.comments.hiddenAt, authorName: schema.users.name, authorEmail: schema.users.email, ageSeconds: commentAge,
  })
    .from(schema.comments)
    .leftJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(inArray(schema.comments.enrollmentId, enrollmentIds))
    .orderBy(asc(schema.comments.createdAt));
}

/** Threads keyed by `${enrollmentId}:${itemId}`. */
export function byThread(rows: CommentRow[]) {
  const m = new Map<string, CommentRow[]>();
  for (const r of rows) {
    const k = `${r.enrollmentId}:${r.itemId}`;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

/** `t` gives the viewer's language for dates and "Deleted person" (English when left out). */
export function toViews(rows: CommentRow[], viewer: { id: string; admin: boolean }, t: T = translator("en")): CommentView[] {
  return rows.map((r) => ({
    id: r.id,
    author: r.authorId ? (r.authorName ?? r.authorEmail ?? t("cmt.someone")) : t("cmt.deletedPerson"),
    side: r.authorRole,
    kind: r.kind,
    body: r.hiddenAt ? null : r.body,
    hiddenText: r.hiddenAt && viewer.admin ? r.body : null,
    hidden: !!r.hiddenAt,
    when: t.dateTime(r.createdAt),
    edited: !!r.editedAt,
    canChange: canChangeComment(r, viewer.id),
  }));
}

/** The side that wrote last in an item_progress row's thread (hidden comments don't count). Use inside a query on item_progress. */
export const lastSideSql = sql<Side | null>`(select c."author_role" from "comment" c
  where c."enrollment_id" = "item_progress"."enrollment_id" and c."item_id" = "item_progress"."item_id" and c."hidden_at" is null
  order by c."created_at" desc limit 1)`;

/** Story 3, the same rule as waitingForTeacher(): submitted and unchecked, or the student wrote last. */
export const waitingSql = sql`("item_progress"."status" = 'DONE' or ${lastSideSql} = 'STUDENT')`;

/** Story 4: per enrollment, how many pieces of work have teacher comments the student hasn't read. */
export async function unreadForStudents(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return new Map<string, number>();
  const rows = await db
    .select({ e: schema.itemProgress.enrollmentId, n: sql<number>`count(distinct ${schema.itemProgress.itemId})` })
    .from(schema.itemProgress)
    .innerJoin(schema.comments, and(eq(schema.comments.enrollmentId, schema.itemProgress.enrollmentId), eq(schema.comments.itemId, schema.itemProgress.itemId)))
    .where(and(
      inArray(schema.itemProgress.enrollmentId, enrollmentIds),
      eq(schema.comments.authorRole, "TEACHER"), isNull(schema.comments.hiddenAt), isNotNull(schema.comments.body),
      or(isNull(schema.itemProgress.studentSeenAt), gt(schema.comments.createdAt, schema.itemProgress.studentSeenAt)),
    ))
    .groupBy(schema.itemProgress.enrollmentId);
  return new Map(rows.map((r) => [r.e, Number(r.n)]));
}

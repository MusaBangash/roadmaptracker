"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCommentAccess, requireRole, requireTeachableEnrollment, requireUser } from "@/lib/access";
import { canChangeComment, checkCommentBody, tooManyComments } from "@/lib/comment-core";
import { REVIEW_KINDS } from "@/lib/progress-core";
import { audit } from "@/lib/audit";
import { commentAge } from "@/lib/comments";

// Comment times use the database clock (created_at's default, now()), never the app server's,
// so the thread order, "new" and the 15-minute window agree even if a computer's clock is wrong.
const dbNow = sql`now()`;

async function findComment(id: string) {
  const [c] = await db.select({ ...getTableColumns(schema.comments), ageSeconds: commentAge }).from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  return c ?? null;
}
import type { FormState } from "./auth";

/** The progress row of submitted work that can have a thread (a project, deliverable or milestone). */
async function submittedWork(enrollmentId: string, itemId: string) {
  const [row] = await db.select({ id: schema.itemProgress.id, title: schema.items.title }).from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.items.id, schema.itemProgress.itemId))
    .where(and(eq(schema.itemProgress.enrollmentId, enrollmentId), eq(schema.itemProgress.itemId, itemId), inArray(schema.items.kind, [...REVIEW_KINDS])))
    .limit(1);
  return row ?? null;
}

function refresh(enrollmentId: string, cohortId: string) {
  revalidatePath(`/learn/${enrollmentId}`);
  revalidatePath(`/cohorts/${cohortId}`, "layout");
}

/** Story 1 + 3: the student or a teacher of the cohort writes in the thread. */
export async function addCommentAction(enrollmentId: string, itemId: string, text: string): Promise<FormState> {
  const ctx = await requireCommentAccess(enrollmentId);
  const checked = checkCommentBody(text);
  if ("error" in checked) return { error: checked.error };
  const work = await submittedWork(enrollmentId, itemId);
  if (!work) return { error: "Comments open once the work is submitted." };
  const [recent] = await db.select({ n: count() }).from(schema.comments)
    .where(and(eq(schema.comments.authorId, ctx.user.id), gt(schema.comments.createdAt, sql`now() - interval '1 minute'`)));
  if (tooManyComments(recent.n)) return { error: "You're writing very fast. Wait a minute, then try again." };
  await db.insert(schema.comments).values({ enrollmentId, itemId, authorId: ctx.user.id, authorRole: ctx.side, body: checked.body });
  // Writing in a thread means you have read it.
  await db.update(schema.itemProgress)
    .set(ctx.side === "STUDENT" ? { studentSeenAt: dbNow } : { staffSeenAt: dbNow })
    .where(eq(schema.itemProgress.id, work.id));
  refresh(enrollmentId, ctx.enrollment.cohortId);
  return { ok: "Sent." };
}

/** Story 5: the author fixes their own comment in its first 15 minutes. */
export async function editCommentAction(commentId: string, text: string): Promise<FormState> {
  const user = await requireUser();
  const c = await findComment(commentId);
  if (!c) return { error: "This comment is gone." };
  const ctx = await requireCommentAccess(c.enrollmentId);
  if (!canChangeComment(c, user.id)) return { error: "Comments can be changed only in their first 15 minutes." };
  const checked = checkCommentBody(text);
  if ("error" in checked) return { error: checked.error };
  await db.update(schema.comments).set({ body: checked.body, editedAt: dbNow }).where(eq(schema.comments.id, c.id));
  refresh(c.enrollmentId, ctx.enrollment.cohortId);
  return { ok: "Saved." };
}

export async function deleteCommentAction(commentId: string): Promise<FormState> {
  const user = await requireUser();
  const c = await findComment(commentId);
  if (!c) return { ok: "Deleted." };
  const ctx = await requireCommentAccess(c.enrollmentId);
  if (!canChangeComment(c, user.id)) return { error: "Comments can be deleted only in their first 15 minutes." };
  await db.delete(schema.comments).where(eq(schema.comments.id, c.id));
  refresh(c.enrollmentId, ctx.enrollment.cohortId);
  return { ok: "Deleted." };
}

/** Story 5: a school admin hides a rude comment (or shows it again). Logged; the text is kept. */
export async function hideCommentAction(commentId: string, hide: boolean): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);
  const c = await findComment(commentId);
  if (!c) return { error: "This comment is gone." };
  const ctx = await requireTeachableEnrollment(c.enrollmentId); // the same school, or not found
  await db.update(schema.comments)
    .set(hide ? { hiddenAt: dbNow, hiddenById: admin.user.id } : { hiddenAt: null, hiddenById: null })
    .where(eq(schema.comments.id, c.id));
  const item = await db.query.items.findFirst({ where: eq(schema.items.id, c.itemId), columns: { title: true } });
  await audit({ orgId: ctx.org.id, actorId: admin.user.id, action: hide ? "comment.hide" : "comment.unhide",
    subjectId: c.authorId, detail: `On “${item?.title ?? ""}”` });
  refresh(c.enrollmentId, ctx.cohort.id);
  return { ok: hide ? "Hidden." : "Shown again." };
}

/** Story 4: opening a thread marks it read for your side (the student, or the cohort's teachers). */
export async function markThreadSeenAction(enrollmentId: string, itemId: string) {
  const ctx = await requireCommentAccess(enrollmentId);
  await db.update(schema.itemProgress)
    .set(ctx.side === "STUDENT" ? { studentSeenAt: dbNow } : { staffSeenAt: dbNow })
    .where(and(eq(schema.itemProgress.enrollmentId, enrollmentId), eq(schema.itemProgress.itemId, itemId)));
}

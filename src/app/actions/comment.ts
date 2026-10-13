"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, getTableColumns, gt, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { inClass } from "@/lib/cohort-core";
import { requireCommentAccess, requireRole, requireTeachableEnrollment, requireUser } from "@/lib/access";
import { COMMENT_MAX, canChangeComment, checkCommentBody, tooManyComments } from "@/lib/comment-core";
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
import { getT } from "@/i18n/server";
import type { T } from "@/i18n/core";

/** checkCommentBody's problem, in the person's language. */
function bodyError(t: T, text: string) {
  const n = text.trim().length;
  return n ? t("cmt.err.long", { max: COMMENT_MAX, n }) : t("cmt.err.empty");
}

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
  const t = await getT();
  if (ctx.side === "STUDENT" && !inClass(ctx.enrollment.status)) return { error: t("dash.waitingSub") };
  const checked = checkCommentBody(text);
  if ("error" in checked) return { error: bodyError(t, text) };
  const work = await submittedWork(enrollmentId, itemId);
  if (!work) return { error: t("cmt.err.notSubmitted") };
  const [recent] = await db.select({ n: count() }).from(schema.comments)
    .where(and(eq(schema.comments.authorId, ctx.user.id), gt(schema.comments.createdAt, sql`now() - interval '1 minute'`)));
  if (tooManyComments(recent.n)) return { error: t("cmt.err.fast") };
  await db.insert(schema.comments).values({ enrollmentId, itemId, authorId: ctx.user.id, authorRole: ctx.side, body: checked.body });
  // Writing in a thread means you have read it.
  await db.update(schema.itemProgress)
    .set(ctx.side === "STUDENT" ? { studentSeenAt: dbNow } : { staffSeenAt: dbNow })
    .where(eq(schema.itemProgress.id, work.id));
  refresh(enrollmentId, ctx.enrollment.cohortId);
  return { ok: t("cmt.ok.sent") };
}

/** Story 5: the author fixes their own comment in its first 15 minutes. */
export async function editCommentAction(commentId: string, text: string): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const c = await findComment(commentId);
  if (!c) return { error: t("cmt.err.gone") };
  const ctx = await requireCommentAccess(c.enrollmentId);
  if (!canChangeComment(c, user.id)) return { error: t("cmt.err.lateEdit") };
  const checked = checkCommentBody(text);
  if ("error" in checked) return { error: bodyError(t, text) };
  await db.update(schema.comments).set({ body: checked.body, editedAt: dbNow }).where(eq(schema.comments.id, c.id));
  refresh(c.enrollmentId, ctx.enrollment.cohortId);
  return { ok: t("cmt.ok.saved") };
}

export async function deleteCommentAction(commentId: string): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const c = await findComment(commentId);
  if (!c) return { ok: t("cmt.ok.deleted") };
  const ctx = await requireCommentAccess(c.enrollmentId);
  if (!canChangeComment(c, user.id)) return { error: t("cmt.err.lateDelete") };
  await db.delete(schema.comments).where(eq(schema.comments.id, c.id));
  refresh(c.enrollmentId, ctx.enrollment.cohortId);
  return { ok: t("cmt.ok.deleted") };
}

/** Story 5: a school admin hides a rude comment (or shows it again). Logged; the text is kept. */
export async function hideCommentAction(commentId: string, hide: boolean): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);
  const t = await getT();
  const c = await findComment(commentId);
  if (!c) return { error: t("cmt.err.gone") };
  const ctx = await requireTeachableEnrollment(c.enrollmentId); // the same school, or not found
  await db.update(schema.comments)
    .set(hide ? { hiddenAt: dbNow, hiddenById: admin.user.id } : { hiddenAt: null, hiddenById: null })
    .where(eq(schema.comments.id, c.id));
  const item = await db.query.items.findFirst({ where: eq(schema.items.id, c.itemId), columns: { title: true } });
  await audit({ orgId: ctx.org.id, actorId: admin.user.id, action: hide ? "comment.hide" : "comment.unhide",
    subjectId: c.authorId, detail: `On “${item?.title ?? ""}”` });
  refresh(c.enrollmentId, ctx.cohort.id);
  return { ok: hide ? t("cmt.ok.hidden") : t("cmt.ok.shown") };
}

/** Story 4: opening a thread marks it read for your side (the student, or the cohort's teachers). */
export async function markThreadSeenAction(enrollmentId: string, itemId: string) {
  const ctx = await requireCommentAccess(enrollmentId);
  await db.update(schema.itemProgress)
    .set(ctx.side === "STUDENT" ? { studentSeenAt: dbNow } : { staffSeenAt: dbNow })
    .where(and(eq(schema.itemProgress.enrollmentId, enrollmentId), eq(schema.itemProgress.itemId, itemId)));
}

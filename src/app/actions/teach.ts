"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireTeachableEnrollment, requireTeachableCohort } from "@/lib/access";
import { DEFAULT_RUBRIC } from "@/lib/rubric";
import { presentToMark } from "@/lib/coverage-core";
import type { FormState } from "./auth";

async function stageInEnrollment(enrollmentId: string, stageId: string) {
  const [row] = await db.select({ id: schema.stages.id }).from(schema.stages)
    .innerJoin(schema.cohorts, eq(schema.cohorts.trackId, schema.stages.trackId))
    .innerJoin(schema.enrollments, eq(schema.enrollments.cohortId, schema.cohorts.id))
    .where(and(eq(schema.stages.id, stageId), eq(schema.enrollments.id, enrollmentId))).limit(1);
  return !!row;
}

async function itemInEnrollment(enrollmentId: string, itemId: string) {
  const [row] = await db.select({ id: schema.items.id }).from(schema.items)
    .innerJoin(schema.stages, eq(schema.items.stageId, schema.stages.id))
    .innerJoin(schema.cohorts, eq(schema.cohorts.trackId, schema.stages.trackId))
    .innerJoin(schema.enrollments, eq(schema.enrollments.cohortId, schema.cohorts.id))
    .where(and(eq(schema.items.id, itemId), eq(schema.enrollments.id, enrollmentId))).limit(1);
  return !!row;
}

/** Verify an item (or send it back) — works whether or not the student has ticked it yet. */
export async function reviewItemAction(form: FormData) {
  const enrollmentId = String(form.get("enrollmentId"));
  const itemId = String(form.get("itemId"));
  const decision = form.get("decision") === "NEEDS_WORK" ? "NEEDS_WORK" : "VERIFIED";
  const reviewNote = String(form.get("reviewNote") ?? "").trim().slice(0, 1000) || null;
  const ctx = await requireTeachableEnrollment(enrollmentId);
  if (!(await itemInEnrollment(enrollmentId, itemId))) throw new Error("Item not in this track");
  const now = new Date();
  await db.insert(schema.itemProgress)
    .values({ enrollmentId, itemId, status: decision, reviewedById: ctx.user.id, reviewedAt: now, reviewNote })
    .onConflictDoUpdate({
      target: [schema.itemProgress.enrollmentId, schema.itemProgress.itemId],
      set: { status: decision, reviewedById: ctx.user.id, reviewedAt: now, reviewNote, updatedAt: now },
    });
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
}

export async function signoffStageAction(form: FormData) {
  const enrollmentId = String(form.get("enrollmentId"));
  const stageId = String(form.get("stageId"));
  const decision = String(form.get("decision"));
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000) || null;
  const ctx = await requireTeachableEnrollment(enrollmentId);
  if (!(await stageInEnrollment(enrollmentId, stageId))) throw new Error("Stage not in this track");
  const where = and(eq(schema.stageSignoffs.enrollmentId, enrollmentId), eq(schema.stageSignoffs.stageId, stageId));
  if (decision === "CLEAR") {
    await db.delete(schema.stageSignoffs).where(where);
  } else {
    const passed = decision === "PASS";
    await db.insert(schema.stageSignoffs).values({ enrollmentId, stageId, passed, notes, signedById: ctx.user.id })
      .onConflictDoUpdate({
        target: [schema.stageSignoffs.enrollmentId, schema.stageSignoffs.stageId],
        set: { passed, notes, signedById: ctx.user.id, signedAt: new Date() },
      });
  }
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
}

export async function saveAssessmentAction(_: FormState, form: FormData): Promise<FormState> {
  const enrollmentId = String(form.get("enrollmentId"));
  const ctx = await requireTeachableEnrollment(enrollmentId);
  const title = String(form.get("title") ?? "").trim();
  const date = String(form.get("date") ?? "");
  if (!title) return { error: "Give the assessment a title, e.g. “Oral Defense 1”." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose the assessment date." };
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.id, ctx.cohort.trackId) });
  const criteria = (track?.rubric?.length ? track.rubric : DEFAULT_RUBRIC).map((r) => r.criterion);
  const scores: Record<string, number[]> = {};
  for (const [i, c] of criteria.entries()) {
    const vals = [form.get(`c${i}_a`), form.get(`c${i}_b`)]
      .map((v) => Number(v)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 4);
    if (!vals.length) return { error: `Score “${c}” from 1 to 4.` };
    scores[c] = vals;
  }
  const means = Object.values(scores).map((v) => v.reduce((a, b) => a + b, 0) / v.length);
  const average = Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 100) / 100;
  const passed = average >= 3 && means.every((m) => m >= 2);
  const disagreement = Object.values(scores).some((v) => v.length === 2 && Math.abs(v[0] - v[1]) >= 2);
  await db.insert(schema.assessments).values({
    enrollmentId, title, date: new Date(date), scores, average, passed,
    notes: String(form.get("notes") ?? "").trim().slice(0, 4000) || null, assessorId: ctx.user.id,
  });
  revalidatePath(`/cohorts/${ctx.cohort.id}/students/${enrollmentId}`);
  return { ok: `Saved: average ${average.toFixed(2)} — ${passed ? "PASSED" : "not passed yet"}.${disagreement ? " Examiners differ by 2+ on a criterion — consider a third scorer." : ""}` };
}

export async function saveAttendanceAction(_: FormState, form: FormData): Promise<FormState> {
  const cohortId = String(form.get("cohortId"));
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date." };
  await requireTeachableCohort(cohortId);
  const enrolls = await db.query.enrollments.findMany({ where: eq(schema.enrollments.cohortId, cohortId) });
  for (const e of enrolls) {
    const present = form.get(`p_${e.id}`) === "on";
    await db.insert(schema.attendance).values({ enrollmentId: e.id, date, present })
      .onConflictDoUpdate({ target: [schema.attendance.enrollmentId, schema.attendance.date], set: { present } });
  }
  revalidatePath(`/cohorts/${cohortId}`, "layout");
  return { ok: `Attendance saved for ${enrolls.length} students.` };
}

const statusSchema = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"]);
export async function setEnrollmentStatusAction(form: FormData) {
  const enrollmentId = String(form.get("enrollmentId"));
  const status = statusSchema.parse(form.get("status"));
  const ctx = await requireTeachableEnrollment(enrollmentId);
  await db.update(schema.enrollments).set({ status }).where(eq(schema.enrollments.id, enrollmentId));
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
}

// ---------- Teaching plan ----------

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you taught it.");
const taughtSchema = z.object({
  cohortId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1, "Choose at least one lesson.").max(300),
  date: dateSchema,
  markPresent: z.boolean(),
});

/** Today in Pakistan, as YYYY-MM-DD (the schools are there; a day of slack covers other zones). */
function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

/** The requested items that are lessons of this cohort's track (anything else is ignored). */
async function lessonsOfCohort(trackId: string, itemIds: string[]) {
  const rows = await db.select({ id: schema.items.id }).from(schema.items)
    .innerJoin(schema.stages, eq(schema.items.stageId, schema.stages.id))
    .where(and(
      inArray(schema.items.id, itemIds), eq(schema.stages.trackId, trackId),
      eq(schema.items.kind, "LESSON"), eq(schema.items.archived, false), eq(schema.stages.archived, false),
    ));
  return rows.map((r) => r.id);
}

export type TeachResult = { ok?: string; error?: string };

/** Mark lessons as taught to a cohort; optionally tick them for the students present that day. */
export async function markTaughtAction(input: z.input<typeof taughtSchema>): Promise<TeachResult> {
  const p = taughtSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { cohortId, date, markPresent } = p.data;
  const ctx = await requireTeachableCohort(cohortId);
  const tomorrow = new Date(Date.parse(todayIso()) + 86400000).toISOString().slice(0, 10);
  if (date > tomorrow) return { error: "That date is in the future. Mark lessons once you have taught them." };
  const itemIds = await lessonsOfCohort(ctx.cohort.trackId, p.data.itemIds);
  if (!itemIds.length) return { error: "Only lessons of this cohort's roadmap can be marked taught." };

  let ticked = 0;
  if (markPresent) {
    const enrolls = await db.select({ id: schema.enrollments.id, status: schema.enrollments.status })
      .from(schema.enrollments).where(eq(schema.enrollments.cohortId, cohortId));
    const present = enrolls.length
      ? await db.select({ e: schema.attendance.enrollmentId }).from(schema.attendance)
          .where(and(inArray(schema.attendance.enrollmentId, enrolls.map((e) => e.id)), eq(schema.attendance.date, date), eq(schema.attendance.present, true)))
      : [];
    if (!present.length) return { error: `No one is marked present on ${date}. Take attendance for that day first, or untick "mark done for present students".` };
    const presentIds = new Set(present.map((r) => r.e));
    const existing = await db.select({ e: schema.itemProgress.enrollmentId, i: schema.itemProgress.itemId }).from(schema.itemProgress)
      .where(and(inArray(schema.itemProgress.enrollmentId, [...presentIds]), inArray(schema.itemProgress.itemId, itemIds)));
    const rows = itemIds.flatMap((itemId) => {
      const already = new Set(existing.filter((x) => x.i === itemId).map((x) => x.e));
      return presentToMark(enrolls, presentIds, already).map((enrollmentId) => ({
        enrollmentId, itemId, status: "DONE" as const, markedById: ctx.user.id, completedAt: new Date(`${date}T12:00:00Z`),
      }));
    });
    await db.transaction(async (tx) => {
      await upsertCoverage(tx, cohortId, itemIds, date, ctx.user.id);
      if (rows.length) await tx.insert(schema.itemProgress).values(rows).onConflictDoNothing();
    });
    ticked = rows.length;
  } else {
    await upsertCoverage(db, cohortId, itemIds, date, ctx.user.id);
  }
  revalidatePath(`/cohorts/${cohortId}`, "layout");
  const what = itemIds.length === 1 ? "1 lesson" : `${itemIds.length} lessons`;
  return { ok: `Marked ${what} taught on ${date}.${markPresent ? ` Ticked ${ticked} for students who were present.` : ""}` };
}

async function upsertCoverage(tx: Pick<typeof db, "insert">, cohortId: string, itemIds: string[], date: string, userId: string) {
  await tx.insert(schema.cohortCoverage)
    .values(itemIds.map((itemId) => ({ cohortId, itemId, taughtOn: date, taughtById: userId })))
    .onConflictDoUpdate({ target: [schema.cohortCoverage.cohortId, schema.cohortCoverage.itemId], set: { taughtOn: date, taughtById: userId } });
}

const untaughtSchema = z.object({ cohortId: z.string().min(1), itemIds: z.array(z.string().min(1)).min(1).max(300) });

/** Undo "taught". Also removes ticks the teacher made for present students, unless the student
 *  has since added evidence or the item was reviewed; students' own ticks are never touched. */
export async function unmarkTaughtAction(input: z.input<typeof untaughtSchema>): Promise<TeachResult> {
  const p = untaughtSchema.safeParse(input);
  if (!p.success) return { error: "Choose at least one lesson." };
  const ctx = await requireTeachableCohort(p.data.cohortId);
  const itemIds = await lessonsOfCohort(ctx.cohort.trackId, p.data.itemIds);
  if (!itemIds.length) return { error: "Only lessons of this cohort's roadmap can be changed." };
  const enrollIds = (await db.select({ id: schema.enrollments.id }).from(schema.enrollments)
    .where(eq(schema.enrollments.cohortId, p.data.cohortId))).map((e) => e.id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.cohortCoverage).where(and(eq(schema.cohortCoverage.cohortId, p.data.cohortId), inArray(schema.cohortCoverage.itemId, itemIds)));
    if (enrollIds.length) {
      await tx.delete(schema.itemProgress).where(and(
        inArray(schema.itemProgress.enrollmentId, enrollIds), inArray(schema.itemProgress.itemId, itemIds),
        isNotNull(schema.itemProgress.markedById), eq(schema.itemProgress.status, "DONE"), isNull(schema.itemProgress.evidenceUrl),
      ));
    }
  });
  revalidatePath(`/cohorts/${p.data.cohortId}`, "layout");
  return { ok: itemIds.length === 1 ? "Marked as not taught." : `Marked ${itemIds.length} lessons as not taught.` };
}

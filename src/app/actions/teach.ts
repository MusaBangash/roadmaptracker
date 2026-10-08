"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireTeachableEnrollment, requireTeachableCohort } from "@/lib/access";
import { DEFAULT_RUBRIC } from "@/lib/rubric";
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

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireOwnEnrollment } from "@/lib/access";
import { safeUrl } from "@/lib/utils";
import type { FormState } from "./auth";

/** Confirms the item belongs to the track of the enrollment's cohort. */
async function itemInEnrollment(enrollmentId: string, itemId: string) {
  const [row] = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .innerJoin(schema.stages, eq(schema.items.stageId, schema.stages.id))
    .innerJoin(schema.cohorts, eq(schema.cohorts.trackId, schema.stages.trackId))
    .innerJoin(schema.enrollments, eq(schema.enrollments.cohortId, schema.cohorts.id))
    .where(and(eq(schema.items.id, itemId), eq(schema.enrollments.id, enrollmentId)))
    .limit(1);
  return !!row;
}

export async function toggleItemAction(enrollmentId: string, itemId: string, done: boolean) {
  const { enrollment } = await requireOwnEnrollment(enrollmentId);
  if (!(await itemInEnrollment(enrollment.id, itemId))) throw new Error("Item not in this track");
  const where = and(eq(schema.itemProgress.enrollmentId, enrollment.id), eq(schema.itemProgress.itemId, itemId));
  const existing = await db.query.itemProgress.findFirst({ where });
  if (existing?.status === "VERIFIED") return; // verified work is locked
  if (done) {
    await db.insert(schema.itemProgress)
      .values({ enrollmentId: enrollment.id, itemId, status: "DONE" })
      .onConflictDoUpdate({
        target: [schema.itemProgress.enrollmentId, schema.itemProgress.itemId],
        set: { status: "DONE", completedAt: new Date(), updatedAt: new Date(), markedById: null },
      });
  } else if (existing) {
    await db.delete(schema.itemProgress).where(where);
  }
  revalidatePath(`/learn/${enrollment.id}`);
}

const evidenceSchema = z.object({
  enrollmentId: z.string(),
  itemId: z.string(),
  evidenceUrl: z.string().trim().max(500).optional(),
  note: z.string().trim().max(2000).optional(),
});

export async function saveEvidenceAction(_: FormState, form: FormData): Promise<FormState> {
  const p = evidenceSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Please check the link and note." };
  const { enrollment } = await requireOwnEnrollment(p.data.enrollmentId);
  if (!(await itemInEnrollment(enrollment.id, p.data.itemId))) return { error: "This item isn't part of your track." };
  const url = p.data.evidenceUrl ? safeUrl(p.data.evidenceUrl) : null;
  if (p.data.evidenceUrl && !url) return { error: "The link must start with http:// or https://" };
  const existing = await db.query.itemProgress.findFirst({
    where: and(eq(schema.itemProgress.enrollmentId, enrollment.id), eq(schema.itemProgress.itemId, p.data.itemId)),
  });
  const status = existing?.status === "VERIFIED" ? "VERIFIED" : "DONE"; // resubmitting "needs work" puts it back in review
  await db.insert(schema.itemProgress)
    .values({ enrollmentId: enrollment.id, itemId: p.data.itemId, status, evidenceUrl: url, note: p.data.note || null })
    .onConflictDoUpdate({
      target: [schema.itemProgress.enrollmentId, schema.itemProgress.itemId],
      set: { status, evidenceUrl: url, note: p.data.note || null, updatedAt: new Date(), markedById: null }, // now the student's own work
    });
  revalidatePath(`/learn/${enrollment.id}`);
  return { ok: status === "VERIFIED" ? "Saved." : "Saved — your instructor will review it." };
}

const logSchema = z.object({
  enrollmentId: z.string(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the week's start date."),
  hours: z.coerce.number().min(0, "Hours can't be negative.").max(100, "That's more hours than a week allows."),
  finished: z.string().trim().max(2000),
  stuck: z.string().trim().max(2000),
});

export async function saveWeeklyLogAction(_: FormState, form: FormData): Promise<FormState> {
  const p = logSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { enrollment } = await requireOwnEnrollment(p.data.enrollmentId);
  const { weekStart, hours, finished, stuck } = p.data;
  await db.insert(schema.weeklyLogs)
    .values({ enrollmentId: enrollment.id, weekStart, hours, finished, stuck })
    .onConflictDoUpdate({
      target: [schema.weeklyLogs.enrollmentId, schema.weeklyLogs.weekStart],
      set: { hours, finished, stuck, updatedAt: new Date() },
    });
  revalidatePath(`/learn/${enrollment.id}/log`);
  return { ok: "Week saved." };
}

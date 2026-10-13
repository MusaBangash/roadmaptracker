// Editing a cohort after it was created, pure and tested in cohort-core.test.ts.

import { classDaysLabel } from "./attendance-core";

export type CohortFields = { name: string; startDate: string; trackId: string; classDays?: number[] | null };

/**
 * What an edit changes, as words for the activity log ("name: A → B; start: … → …"), or null when
 * nothing changed. Track titles are passed in so the log reads in names, not ids.
 */
export function cohortChanges(before: CohortFields, after: CohortFields, trackTitle: (id: string) => string) {
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`name: ${before.name} → ${after.name}`);
  if (before.startDate !== after.startDate) parts.push(`start: ${before.startDate} → ${after.startDate}`);
  if (before.trackId !== after.trackId) parts.push(`track: ${trackTitle(before.trackId)} → ${trackTitle(after.trackId)}`);
  if (after.classDays !== undefined && JSON.stringify(before.classDays ?? null) !== JSON.stringify(after.classDays ?? null)) {
    parts.push(`class days: ${classDaysLabel(before.classDays) ?? "not set"} → ${classDaysLabel(after.classDays) ?? "not set"}`);
  }
  return parts.length ? parts.join("; ") : null;
}

/** The roadmap can change only while nobody is enrolled: students' ticks belong to its lessons. */
export function canChangeTrack(enrolled: number) {
  return enrolled === 0;
}

// ---------- Who is in the class (waiting list) ----------

export type EnrollmentStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "WITHDRAWN" | "PENDING" | "DECLINED";

/** Waiting to be accepted, or turned away: not part of the class (no attendance, progress or averages). */
export function inClass(status: EnrollmentStatus) {
  return status !== "PENDING" && status !== "DECLINED";
}

/**
 * Joining with a class link: a new place waits for a teacher (PENDING). Someone who left (WITHDRAWN)
 * waits again, old work still there. A turned-away person stays turned away (a teacher can still accept
 * them), so a shared group link can't push them back onto the list. Anyone else keeps their place.
 */
export function statusAfterJoin(current: EnrollmentStatus | null): EnrollmentStatus {
  if (current === null || current === "WITHDRAWN") return "PENDING";
  return current;
}

export type ClassListOp = "accept" | "decline" | "withdraw";

/** Which places an action changes: accept waiting or turned-away people, turn away waiting ones,
 *  withdraw people in the class. Anything else (and the teacher's own place) is skipped. */
export function canApply(op: ClassListOp, status: EnrollmentStatus) {
  if (op === "accept") return status === "PENDING" || status === "DECLINED";
  if (op === "decline") return status === "PENDING";
  return status === "ACTIVE" || status === "PAUSED" || status === "COMPLETED";
}

export const OP_STATUS: Record<ClassListOp, EnrollmentStatus> = { accept: "ACTIVE", decline: "DECLINED", withdraw: "WITHDRAWN" };

// ---------- When a student leaves (kept with their place) ----------

export const LEAVE_REASONS = {
  STOPPED: "Stopped coming",
  MOVED: "Moved away",
  JOB: "Got a job",
  FEES: "Fees",
  OTHER: "Other",
  REMOVED: "Removed from the school", // set by Remove from school, not offered in the forms
} as const;
export type LeaveReason = keyof typeof LEAVE_REASONS;
export const CHOOSABLE_REASONS = ["STOPPED", "MOVED", "JOB", "FEES", "OTHER"] as const satisfies readonly LeaveReason[];
export const LEAVE_NOTE_MAX = 500;

export function leaveLabel(reason: string | null) {
  return reason && reason in LEAVE_REASONS ? LEAVE_REASONS[reason as LeaveReason] : null;
}

export type LeaveDetails = { leftOn: string | null; leftReason: string | null; leftNote: string | null };

/**
 * The leaving details saved with a status change. Withdrawn needs a reason and a date (not in the future);
 * "Other" needs a few words. Any other status clears them (the student is back; the activity log keeps the history).
 */
export function leaveDetails(status: EnrollmentStatus, input: { leftOn?: string | null; reason?: string | null; note?: string | null }, today: string): LeaveDetails | { error: string } {
  if (status !== "WITHDRAWN") return { leftOn: null, leftReason: null, leftNote: null };
  const reason = input.reason ?? "";
  if (!(CHOOSABLE_REASONS as readonly string[]).includes(reason)) return { error: "Choose why the student left." };
  const leftOn = (input.leftOn ?? "").trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(leftOn) ? new Date(`${leftOn}T00:00:00Z`) : null;
  if (!day || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== leftOn) return { error: "Choose the date the student left." };
  if (leftOn > today) return { error: "The date they left can't be in the future." };
  const note = (input.note ?? "").trim();
  if (note.length > LEAVE_NOTE_MAX) return { error: `Keep the note under ${LEAVE_NOTE_MAX} characters.` };
  if (reason === "OTHER" && !note) return { error: "For Other, write a few words about why." };
  return { leftOn, leftReason: reason, leftNote: note || null };
}

/** "Moved away (13 Oct 2026)" style words for the activity log. */
export function leaveWords(d: LeaveDetails) {
  return d.leftReason ? `${leaveLabel(d.leftReason)}, left ${d.leftOn}${d.leftNote ? `: ${d.leftNote}` : ""}` : "";
}

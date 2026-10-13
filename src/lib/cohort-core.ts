// Editing a cohort after it was created, pure and tested in cohort-core.test.ts.

export type CohortFields = { name: string; startDate: string; trackId: string };

/**
 * What an edit changes, as words for the activity log ("name: A → B; start: … → …"), or null when
 * nothing changed. Track titles are passed in so the log reads in names, not ids.
 */
export function cohortChanges(before: CohortFields, after: CohortFields, trackTitle: (id: string) => string) {
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`name: ${before.name} → ${after.name}`);
  if (before.startDate !== after.startDate) parts.push(`start: ${before.startDate} → ${after.startDate}`);
  if (before.trackId !== after.trackId) parts.push(`track: ${trackTitle(before.trackId)} → ${trackTitle(after.trackId)}`);
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

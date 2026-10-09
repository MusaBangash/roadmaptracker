// Who may do what: pure rules, tested in access-core.test.ts and used by src/lib/access.ts.
import type { Role } from "@/db/schema";

export type Viewer = { userId: string; orgId: string | null; role: Role | null };

/** Teach a cohort (review, sign off, attendance, teaching plan): a school admin of the cohort's
 *  school, or an instructor of that school who is assigned to the cohort. Never across schools,
 *  never a student. */
export function canTeachCohort(viewer: Viewer, cohort: { orgId: string }, cohortInstructorIds: string[]) {
  if (!viewer.orgId || viewer.orgId !== cohort.orgId) return false;
  if (viewer.role === "ADMIN") return true;
  return viewer.role === "INSTRUCTOR" && cohortInstructorIds.includes(viewer.userId);
}

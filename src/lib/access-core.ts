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

export type TrackAccess = { ownerOrgId: string | null; status: "DRAFT" | "PUBLISHED" };

/** See a roadmap: official ones are open to every signed-in user; a school's own roadmap only to
 *  that school, and while it is a draft only to that school's admins. */
export function canSeeTrack(viewer: Viewer, track: TrackAccess) {
  if (track.ownerOrgId === null) return true;
  if (!viewer.orgId || viewer.orgId !== track.ownerOrgId) return false;
  return track.status === "PUBLISHED" || viewer.role === "ADMIN";
}

/** Edit a roadmap: only admins of the school that owns it. Official roadmaps are edited in the
 *  content files, never in the app. */
export function canEditTrack(viewer: Viewer, track: TrackAccess) {
  return track.ownerOrgId !== null && viewer.orgId === track.ownerOrgId && viewer.role === "ADMIN";
}

/** Turn a roadmap on for a school (so cohorts can use it): official ones, or the school's own once published. */
export function canUseTrack(orgId: string, track: TrackAccess) {
  return track.status === "PUBLISHED" && (track.ownerOrgId === null || track.ownerOrgId === orgId);
}

/** Copy a roadmap into a school: anything the viewer's school admin can see. */
export function canCopyTrack(viewer: Viewer, track: TrackAccess) {
  return viewer.role === "ADMIN" && canSeeTrack(viewer, track);
}

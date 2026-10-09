// Activity log (Step 4, Story 3): the actions we record and how they read. Pure; used by
// src/lib/audit.ts (writing) and the Activity page (reading).

export const AUDIT_GROUPS = {
  people: "People and invites",
  work: "Reviews, sign-offs and assessments",
  class: "Attendance and teaching",
  roadmaps: "Roadmaps and tracks",
  school: "Cohorts and school data",
  account: "Passwords and sign-in",
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;

export const AUDIT_ACTIONS = {
  "member.role": { group: "people", label: "Changed a role" },
  "member.remove": { group: "people", label: "Removed from the school" },
  "member.join": { group: "people", label: "Joined with an invite" },
  "person.delete": { group: "people", label: "Deleted a person's data" },
  "invite.create": { group: "people", label: "Made an invite link" },
  "invite.delete": { group: "people", label: "Deleted an invite link" },
  "students.import": { group: "people", label: "Added students from a file" },
  "review.verify": { group: "work", label: "Verified work" },
  "review.needs_work": { group: "work", label: "Sent work back" },
  "signoff.pass": { group: "work", label: "Signed off a stage" },
  "signoff.not_yet": { group: "work", label: "Marked a stage not yet passed" },
  "signoff.clear": { group: "work", label: "Cleared a stage sign-off" },
  "assessment.save": { group: "work", label: "Saved an assessment" },
  "enrollment.status": { group: "work", label: "Changed a student's status" },
  "certificate.issue": { group: "work", label: "Issued a certificate" },
  "certificate.revoke": { group: "work", label: "Revoked a certificate" },
  "comment.hide": { group: "work", label: "Hid a comment" },
  "comment.unhide": { group: "work", label: "Showed a hidden comment again" },
  "attendance.save": { group: "class", label: "Took attendance" },
  "teach.mark": { group: "class", label: "Marked lessons taught" },
  "teach.unmark": { group: "class", label: "Marked lessons not taught" },
  "roadmap.create": { group: "roadmaps", label: "Started a roadmap" },
  "roadmap.publish": { group: "roadmaps", label: "Published a roadmap" },
  "roadmap.discard": { group: "roadmaps", label: "Discarded roadmap changes" },
  "roadmap.delete": { group: "roadmaps", label: "Deleted a draft roadmap" },
  "track.toggle": { group: "roadmaps", label: "Turned a track on or off" },
  "cohort.create": { group: "school", label: "Created a cohort" },
  "cohort.archive": { group: "school", label: "Archived or reopened a cohort" },
  "cohort.instructor": { group: "school", label: "Changed a cohort's instructors" },
  "school.export": { group: "school", label: "Downloaded the school backup" },
  "password.reset_link": { group: "account", label: "Made a password reset link" },
  "password.reset": { group: "account", label: "Set a new password with a reset link" },
} as const satisfies Record<string, { group: AuditGroup; label: string }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function actionsIn(group: AuditGroup): AuditAction[] {
  return (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter((a) => AUDIT_ACTIONS[a].group === group);
}

export function actionLabel(action: string) {
  return (AUDIT_ACTIONS as Record<string, { label: string }>)[action]?.label ?? action;
}

/** Keeps details short and single-line, so a log row can't be stuffed with text. */
export function cleanDetail(s: string, max = 200) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

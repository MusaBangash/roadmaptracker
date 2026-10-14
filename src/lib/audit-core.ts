// Activity log (Step 4, Story 3): the actions we record and how they read. Pure; used by
// src/lib/audit.ts (writing) and the Activity page (reading).

export const AUDIT_GROUPS = {
  people: "People and invites",
  work: "Reviews, sign-offs and assessments",
  class: "Attendance and teaching",
  roadmaps: "Roadmaps and tracks",
  school: "Cohorts and school data",
  account: "Passwords and sign-in",
  labs: "Labs and equipment",
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
  "students.add": { group: "people", label: "Added students from the school" },
  "review.verify": { group: "work", label: "Verified work" },
  "review.needs_work": { group: "work", label: "Sent work back" },
  "signoff.pass": { group: "work", label: "Signed off a stage" },
  "signoff.not_yet": { group: "work", label: "Marked a stage not yet passed" },
  "signoff.clear": { group: "work", label: "Cleared a stage sign-off" },
  "assessment.save": { group: "work", label: "Saved an assessment" },
  "enrollment.status": { group: "work", label: "Changed a student's status" },
  "enrollment.accept": { group: "people", label: "Accepted a student into a cohort" },
  "enrollment.decline": { group: "people", label: "Turned away from a cohort" },
  "student.residence": { group: "people", label: "Marked hostel or day scholar" },
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
  "cohort.update": { group: "school", label: "Changed a cohort's name, start date or roadmap" },
  "cohort.archive": { group: "school", label: "Archived or reopened a cohort" },
  "school.rename": { group: "school", label: "Renamed the school" },
  "school.groups": { group: "school", label: "Changed the class groups" },
  "school.hostel": { group: "school", label: "Turned the hostel on or off" },
  "cohort.instructor": { group: "school", label: "Changed a cohort's instructors" },
  "school.export": { group: "school", label: "Downloaded the school backup" },
  "certificate.design": { group: "school", label: "Uploaded a certificate design" },
  "certificate.design_layout": { group: "school", label: "Moved the values on the certificate design" },
  "certificate.design_off": { group: "school", label: "Stopped using the certificate design" },
  "certificate.design_delete": { group: "school", label: "Deleted an unused certificate design" },
  "certificate.design_online": { group: "school", label: "Changed the online version of the certificate design" },
  "lab.create": { group: "labs", label: "Added a lab" },
  "lab.update": { group: "labs", label: "Changed a lab" },
  "lab.inspect": { group: "labs", label: "Inspected a lab" },
  "lab.problem": { group: "labs", label: "Reported a lab problem" },
  "lab.fix": { group: "labs", label: "Marked a lab problem fixed" },
  "password.reset_link": { group: "account", label: "Made a password reset link" },
  "password.reset": { group: "account", label: "Set a new password with a reset link" },
  "password.change": { group: "account", label: "Changed their own password" },
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

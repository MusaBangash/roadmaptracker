import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { audit } from "@/lib/audit";
import { liveDoc } from "@/lib/track-store";

/**
 * Story 6: everything a school has in NoorAI Tracks, as one JSON file: people, cohorts, every
 * student's ticks, evidence, logs, attendance, sign-offs and assessments, the teaching plan, the
 * school's own roadmaps and the activity log. Items are named by track slug + stage key + item key
 * (stable), so the file can be imported into NoorAI Lab Studio later. No passwords or secrets.
 */
export async function GET() {
  const ctx = await requireRole(["ADMIN"]);
  const orgId = ctx.org.id;
  const cohorts = await db.select({ c: schema.cohorts, slug: schema.tracks.slug }).from(schema.cohorts)
    .innerJoin(schema.tracks, eq(schema.tracks.id, schema.cohorts.trackId)).where(eq(schema.cohorts.orgId, orgId));
  const cohortIds = cohorts.map((x) => x.c.id);
  const none = ["-"]; // inArray with an empty list is not allowed
  const enrollments = await db.select().from(schema.enrollments).where(inArray(schema.enrollments.cohortId, cohortIds.length ? cohortIds : none));
  const eIds = enrollments.length ? enrollments.map((e) => e.id) : none;
  const ref = { stageKey: schema.stages.key, itemKey: schema.items.key };

  const [people, instructors, progress, signoffs, assessments, logs, attendance, coverage, ownTracks, activity, comments] = await Promise.all([
    db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role, joinedAt: schema.memberships.createdAt, consentAt: schema.users.consentAt })
      .from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId)).where(eq(schema.memberships.orgId, orgId)),
    db.select().from(schema.cohortInstructors).where(inArray(schema.cohortInstructors.cohortId, cohortIds.length ? cohortIds : none)),
    db.select({ p: schema.itemProgress, ...ref }).from(schema.itemProgress)
      .innerJoin(schema.items, eq(schema.items.id, schema.itemProgress.itemId)).innerJoin(schema.stages, eq(schema.stages.id, schema.items.stageId))
      .where(inArray(schema.itemProgress.enrollmentId, eIds)),
    db.select({ s: schema.stageSignoffs, stageKey: schema.stages.key }).from(schema.stageSignoffs)
      .innerJoin(schema.stages, eq(schema.stages.id, schema.stageSignoffs.stageId)).where(inArray(schema.stageSignoffs.enrollmentId, eIds)),
    db.select().from(schema.assessments).where(inArray(schema.assessments.enrollmentId, eIds)),
    db.select().from(schema.weeklyLogs).where(inArray(schema.weeklyLogs.enrollmentId, eIds)),
    db.select().from(schema.attendance).where(inArray(schema.attendance.enrollmentId, eIds)),
    db.select({ c: schema.cohortCoverage, ...ref }).from(schema.cohortCoverage)
      .innerJoin(schema.items, eq(schema.items.id, schema.cohortCoverage.itemId)).innerJoin(schema.stages, eq(schema.stages.id, schema.items.stageId))
      .where(inArray(schema.cohortCoverage.cohortId, cohortIds.length ? cohortIds : none)),
    db.select().from(schema.tracks).where(eq(schema.tracks.ownerOrgId, orgId)),
    db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, orgId)).orderBy(schema.auditLog.createdAt),
    db.select({ c: schema.comments, ...ref }).from(schema.comments)
      .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId)).innerJoin(schema.stages, eq(schema.stages.id, schema.items.stageId))
      .where(inArray(schema.comments.enrollmentId, eIds)).orderBy(schema.comments.createdAt),
  ]);

  const byEnrollment = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const prog = byEnrollment(progress, (r) => r.p.enrollmentId);
  const sign = byEnrollment(signoffs, (r) => r.s.enrollmentId);
  const asmt = byEnrollment(assessments, (r) => r.enrollmentId);
  const log = byEnrollment(logs, (r) => r.enrollmentId);
  const att = byEnrollment(attendance, (r) => r.enrollmentId);
  const talk = byEnrollment(comments, (r) => r.c.enrollmentId);

  const backup = {
    format: "noorai-tracks-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    school: { id: ctx.org.id, name: ctx.org.name, slug: ctx.org.slug },
    people,
    roadmaps: await Promise.all(ownTracks.map(async (t) => ({
      slug: t.slug, status: t.status, published: t.status === "PUBLISHED" ? await liveDoc(db, t) : null, draft: t.draft,
    }))),
    cohorts: cohorts.map(({ c, slug }) => ({
      id: c.id, name: c.name, track: slug, startDate: c.startDate.toISOString().slice(0, 10), archived: c.archived,
      instructorIds: instructors.filter((i) => i.cohortId === c.id).map((i) => i.userId),
      teachingPlan: coverage.filter((x) => x.c.cohortId === c.id)
        .map((x) => ({ stage: x.stageKey, item: x.itemKey, taughtOn: x.c.taughtOn, taughtById: x.c.taughtById })),
      students: enrollments.filter((e) => e.cohortId === c.id).map((e) => ({
        enrollmentId: e.id, userId: e.userId, status: e.status, joinedAt: e.createdAt,
        progress: (prog.get(e.id) ?? []).map(({ p, stageKey, itemKey }) => ({
          stage: stageKey, item: itemKey, status: p.status, evidenceUrl: p.evidenceUrl, note: p.note, completedAt: p.completedAt,
          reviewedById: p.reviewedById, reviewedAt: p.reviewedAt, reviewNote: p.reviewNote, markedById: p.markedById,
        })),
        signoffs: (sign.get(e.id) ?? []).map(({ s, stageKey }) => ({ stage: stageKey, passed: s.passed, notes: s.notes, signedById: s.signedById, signedAt: s.signedAt })),
        assessments: (asmt.get(e.id) ?? []).map((a) => ({ title: a.title, date: a.date, scores: a.scores, average: a.average, passed: a.passed, notes: a.notes, assessorId: a.assessorId, createdAt: a.createdAt })),
        weeklyLogs: (log.get(e.id) ?? []).map((l) => ({ weekStart: l.weekStart, hours: l.hours, finished: l.finished, stuck: l.stuck, updatedAt: l.updatedAt })),
        attendance: (att.get(e.id) ?? []).map((a) => ({ date: a.date, present: a.present })),
        comments: (talk.get(e.id) ?? []).map(({ c, stageKey, itemKey }) => ({
          stage: stageKey, item: itemKey, authorId: c.authorId, authorRole: c.authorRole, kind: c.kind, body: c.body,
          createdAt: c.createdAt, editedAt: c.editedAt, hiddenAt: c.hiddenAt, hiddenById: c.hiddenById,
        })),
      })),
    })),
    activity: activity.map((a) => ({ at: a.createdAt, actorId: a.actorId, action: a.action, subjectId: a.subjectId, detail: a.detail })),
    // Lab checks: every lab with its teachers, inspections and problems (open and fixed).
    labs: await (async () => {
      const [labs, teachers, inspections, faults] = await Promise.all([
        db.select().from(schema.labs).where(eq(schema.labs.orgId, orgId)),
        db.select({ labId: schema.labTeachers.labId, userId: schema.labTeachers.userId }).from(schema.labTeachers)
          .innerJoin(schema.labs, eq(schema.labs.id, schema.labTeachers.labId)).where(eq(schema.labs.orgId, orgId)),
        db.select().from(schema.labInspections).where(eq(schema.labInspections.orgId, orgId)).orderBy(schema.labInspections.inspectedOn),
        db.select().from(schema.labFaults).where(eq(schema.labFaults.orgId, orgId)).orderBy(schema.labFaults.reportedAt),
      ]);
      return labs.map((l) => ({
        id: l.id, name: l.name, pcCount: l.pcCount, pcItems: l.pcItems, roomItems: l.roomItems, archived: l.archived,
        teacherIds: teachers.filter((t) => t.labId === l.id).map((t) => t.userId),
        inspections: inspections.filter((x) => x.labId === l.id).map((x) => ({
          id: x.id, inspectedOn: x.inspectedOn, byId: x.byId, pcCount: x.pcCount, pcItems: x.pcItems, roomItems: x.roomItems, findings: x.findings, note: x.note,
        })),
        problems: faults.filter((f) => f.labId === l.id).map((f) => ({
          station: f.station, item: f.item, status: f.status, note: f.note, inspectionId: f.inspectionId, reportedById: f.reportedById,
          reportedAt: f.reportedAt, fixedAt: f.fixedAt, fixedById: f.fixedById, fixNote: f.fixNote,
        })),
      }));
    })(),
  };
  await audit({ orgId, actorId: ctx.user.id, action: "school.export" });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.org.slug}-backup-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { courseWeeks, durationText, nextRegNo, parseLayout, sessionText } from "@/lib/certificate-design-core";

// A school's certificate design: loading it, and the values offered when issuing (rules in
// certificate-design-core.ts).

const designColumns = {
  id: schema.certificateDesigns.id, orgId: schema.certificateDesigns.orgId, width: schema.certificateDesigns.width,
  height: schema.certificateDesigns.height, layout: schema.certificateDesigns.layout, createdAt: schema.certificateDesigns.createdAt,
};

/** The design new certificates of this school are printed on (without the picture's bytes), or null. */
export async function currentDesign(orgId: string) {
  const [d] = await db.select(designColumns).from(schema.certificateDesigns)
    .where(and(eq(schema.certificateDesigns.orgId, orgId), eq(schema.certificateDesigns.current, true)));
  const layout = d && parseLayout(d.layout);
  return d && layout ? { ...d, layout } : null;
}

/** The picture's address. The id never points at another picture, so browsers may keep it. */
export const designImageUrl = (designId: string) => `/certificate-image/${designId}`;

/** What the issue form offers for this student: the next Reg No and the cohort's last-used values. */
export async function issueDefaults(orgId: string, cohort: typeof schema.cohorts.$inferSelect, trackTitle: string) {
  const [stages, cohortRegs, schoolRegs] = await Promise.all([
    db.select({ weeks: schema.stages.weeks, optional: schema.stages.optional, choiceGroup: schema.stages.choiceGroup })
      .from(schema.stages).where(and(eq(schema.stages.trackId, cohort.trackId), eq(schema.stages.archived, false))).orderBy(asc(schema.stages.order)),
    db.select({ regNo: schema.certificates.regNo }).from(schema.certificates)
      .innerJoin(schema.enrollments, eq(schema.enrollments.id, schema.certificates.enrollmentId))
      .where(and(eq(schema.enrollments.cohortId, cohort.id), isNotNull(schema.certificates.regNo)))
      .orderBy(desc(schema.certificates.issuedAt)).limit(20),
    db.select({ regNo: sql<string>`upper("reg_no")` }).from(schema.certificates)
      .where(and(eq(schema.certificates.orgId, orgId), isNotNull(schema.certificates.regNo), isNull(schema.certificates.revokedAt))),
  ]);
  const weeks = courseWeeks(stages);
  const saved = cohort.certDefaults ?? {};
  return {
    regNo: nextRegNo(cohortRegs.map((r) => r.regNo!), new Set(schoolRegs.map((r) => r.regNo))),
    courseTitle: saved.courseTitle ?? trackTitle,
    duration: saved.duration ?? durationText(weeks),
    session: saved.session ?? sessionText(cohort.startDate, weeks),
    level: saved.level ?? "",
  };
}

/** Is this Reg No already on a valid certificate in the school? */
export async function regNoTaken(orgId: string, regNo: string) {
  const [row] = await db.select({ id: schema.certificates.id }).from(schema.certificates)
    .where(and(eq(schema.certificates.orgId, orgId), isNull(schema.certificates.revokedAt), sql`upper("reg_no") = upper(${regNo})`)).limit(1);
  return !!row;
}

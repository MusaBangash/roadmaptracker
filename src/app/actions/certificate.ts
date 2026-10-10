"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, requireTeachableEnrollment } from "@/lib/access";
import { audit } from "@/lib/audit";
import { checkCertificateName } from "@/lib/certificate-core";
import { newCertificateCode, readinessOf, validCertificate } from "@/lib/certificates";
import { checkCertExtras } from "@/lib/certificate-design-core";
import { currentDesign, regNoTaken } from "@/lib/certificate-designs";
import { canJudgeWork } from "@/lib/security-core";
import type { FormState } from "./auth";

/** Story 2: a teacher of the cohort (or an admin) issues the certificate, once every required stage
 *  is passed. The printed details are copied in now and never change. With a school design (Certificate
 *  design, Story 3) the Reg No, course, duration, session and level are copied in too, with the design's
 *  layout, and remembered for the cohort's next student. */
export async function issueCertificateAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireTeachableEnrollment(String(form.get("enrollmentId") ?? ""));
  if (!canJudgeWork(ctx.user.id, ctx.enrollment.userId)) return { error: "This is your own work. Another teacher or an admin has to issue your certificate." };
  const name = checkCertificateName(String(form.get("name") ?? ""));
  if ("error" in name) return { error: name.error };
  const ready = await readinessOf(ctx.enrollment.id, ctx.cohort.trackId);
  if (!ready.ready || !ready.completedOn) return { error: `Not ready yet: ${ready.missing.join(", ")}.` };
  if (await validCertificate(ctx.enrollment.id)) return { error: "This student already has a certificate for this roadmap." };
  const design = await currentDesign(ctx.org.id);
  const extras = design ? checkCertExtras(design.layout, (k) => String(form.get(k) ?? "")) : null;
  if (extras && "error" in extras) return { error: extras.error };
  if (extras?.regNo && await regNoTaken(ctx.org.id, extras.regNo)) return { error: `Reg No ${extras.regNo} is already on another certificate of this school.` };
  const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, ctx.cohort.trackId) }))!;
  const code = await newCertificateCode();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.certificates).values({
        code, enrollmentId: ctx.enrollment.id, orgId: ctx.org.id, nameOnCertificate: name.name,
        trackTitle: track.title, trackEdition: track.edition, schoolName: ctx.org.name, cohortName: ctx.cohort.name,
        completedOn: ready.completedOn!, issuedById: ctx.user.id, issuedByName: ctx.user.name ?? ctx.user.email ?? "",
        ...(design && extras ? { designId: design.id, layout: design.layout, ...extras } : {}),
      });
      if (extras) {
        const { courseTitle, duration, session, level } = extras;
        const keep = Object.fromEntries(Object.entries({ courseTitle, duration, session, level }).filter(([, v]) => v)) as Record<string, string>;
        await tx.update(schema.cohorts).set({ certDefaults: { ...ctx.cohort.certDefaults, ...keep } }).where(eq(schema.cohorts.id, ctx.cohort.id));
      }
      await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.issue", subjectId: ctx.enrollment.userId, detail: `${track.title}, ${code}` }, tx);
    });
  } catch (e) {
    // Two teachers pressing Issue at once: the database allows only one valid certificate.
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505" && err.constraint === "certificate_reg_no") return { error: `Reg No ${extras && "regNo" in extras ? extras.regNo : ""} is already on another certificate of this school.` };
    if (err.code === "23505") return { error: "This student already has a certificate for this roadmap." };
    throw e;
  }
  revalidatePath(`/cohorts/${ctx.cohort.id}`, "layout");
  revalidatePath(`/learn/${ctx.enrollment.id}`);
  redirect(`/certificates/${code}`);
}

/** Story 6: an admin revokes a certificate issued by mistake, with a reason. The check page says so. */
export async function revokeCertificateAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireRole(["ADMIN"]);
  const reason = String(form.get("reason") ?? "").replace(/\s+/g, " ").trim();
  if (reason.length < 3) return { error: "Give a short reason, e.g. “Issued to the wrong student”." };
  const [cert] = await db.update(schema.certificates)
    .set({ revokedAt: new Date(), revokedById: ctx.user.id, revokeReason: reason.slice(0, 300) })
    .where(and(eq(schema.certificates.id, String(form.get("certificateId") ?? "")), eq(schema.certificates.orgId, ctx.org.id), isNull(schema.certificates.revokedAt)))
    .returning();
  if (!cert) return { error: "That certificate isn't valid any more, or isn't from your school." };
  const enrollment = await db.query.enrollments.findFirst({ where: eq(schema.enrollments.id, cert.enrollmentId) });
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.revoke", subjectId: enrollment?.userId ?? null, detail: `${cert.code}: ${reason}` });
  revalidatePath(`/certificates/${cert.code}`);
  if (enrollment) revalidatePath(`/cohorts/${enrollment.cohortId}`, "layout");
  return { ok: "Revoked. The check page now says this certificate was revoked." };
}

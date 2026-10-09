"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, requireTeachableEnrollment } from "@/lib/access";
import { audit } from "@/lib/audit";
import { checkCertificateName } from "@/lib/certificate-core";
import { newCertificateCode, readinessOf, validCertificate } from "@/lib/certificates";
import { canJudgeWork } from "@/lib/security-core";
import type { FormState } from "./auth";

/** Story 2: a teacher of the cohort (or an admin) issues the certificate, once every required stage
 *  is passed. The printed details are copied in now and never change. */
export async function issueCertificateAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireTeachableEnrollment(String(form.get("enrollmentId") ?? ""));
  if (!canJudgeWork(ctx.user.id, ctx.enrollment.userId)) return { error: "This is your own work. Another teacher or an admin has to issue your certificate." };
  const name = checkCertificateName(String(form.get("name") ?? ""));
  if ("error" in name) return { error: name.error };
  const ready = await readinessOf(ctx.enrollment.id, ctx.cohort.trackId);
  if (!ready.ready || !ready.completedOn) return { error: `Not ready yet: ${ready.missing.join(", ")}.` };
  if (await validCertificate(ctx.enrollment.id)) return { error: "This student already has a certificate for this roadmap." };
  const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, ctx.cohort.trackId) }))!;
  const code = await newCertificateCode();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.certificates).values({
        code, enrollmentId: ctx.enrollment.id, orgId: ctx.org.id, nameOnCertificate: name.name,
        trackTitle: track.title, trackEdition: track.edition, schoolName: ctx.org.name, cohortName: ctx.cohort.name,
        completedOn: ready.completedOn!, issuedById: ctx.user.id, issuedByName: ctx.user.name ?? ctx.user.email ?? "",
      });
      await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "certificate.issue", subjectId: ctx.enrollment.userId, detail: `${track.title}, ${code}` }, tx);
    });
  } catch (e) {
    // Two teachers pressing Issue at once: the database allows only one valid certificate.
    if ((e as { code?: string }).code === "23505") return { error: "This student already has a certificate for this roadmap." };
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

import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema } from "@/db";
import { certificateReady, makeCertificateCode } from "@/lib/certificate-core";

// Certificates (Step 5, feature 2): loading what the rules in certificate-core.ts need.

/** Is this enrollment ready for a certificate, and what is missing? */
export async function readinessOf(enrollmentId: string, trackId: string) {
  const [stages, signoffs] = await Promise.all([
    db.select({ id: schema.stages.id, title: schema.stages.title, optional: schema.stages.optional, choiceGroup: schema.stages.choiceGroup })
      .from(schema.stages).where(and(eq(schema.stages.trackId, trackId), eq(schema.stages.archived, false))).orderBy(asc(schema.stages.order)),
    db.select({ stageId: schema.stageSignoffs.stageId, passed: schema.stageSignoffs.passed, signedAt: schema.stageSignoffs.signedAt })
      .from(schema.stageSignoffs).where(eq(schema.stageSignoffs.enrollmentId, enrollmentId)),
  ]);
  return certificateReady(stages, signoffs);
}

/** The enrollment's valid (not revoked) certificate, if any. */
export async function validCertificate(enrollmentId: string) {
  return (await db.query.certificates.findFirst({
    where: and(eq(schema.certificates.enrollmentId, enrollmentId), isNull(schema.certificates.revokedAt)),
  })) ?? null;
}

/** A fresh, unused check code. */
export async function newCertificateCode() {
  for (;;) {
    const code = makeCertificateCode(randomBytes(16));
    if (code && !(await db.query.certificates.findFirst({ where: eq(schema.certificates.code, code), columns: { id: true } }))) return code;
  }
}

/** The QR code for a check link, as an SVG string (crisp when printed). */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}

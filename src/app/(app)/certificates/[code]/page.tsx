import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { canTeachCohort } from "@/lib/access-core";
import { normalizeCode } from "@/lib/certificate-core";
import { qrSvg } from "@/lib/certificates";
import { baseUrl } from "@/lib/url";
import { fmtDate } from "@/lib/utils";
import { Certificate } from "@/components/certificate";
import { PrintButton, RevokeCertificateForm } from "@/components/certificate-tools";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "Certificate" };

/** Story 3 + 5: the certificate, for the student who earned it and the people who teach their cohort. */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) notFound();
  const ctx = await getContext();
  const cert = await db.query.certificates.findFirst({ where: eq(schema.certificates.code, code) });
  if (!cert) notFound();
  const enrollment = (await db.query.enrollments.findFirst({ where: eq(schema.enrollments.id, cert.enrollmentId) }))!;
  const [cohort, links] = await Promise.all([
    db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, enrollment.cohortId) }).then((c) => c!),
    db.select({ userId: schema.cohortInstructors.userId }).from(schema.cohortInstructors).where(eq(schema.cohortInstructors.cohortId, enrollment.cohortId)),
  ]);
  const own = enrollment.userId === ctx.user.id;
  const teaches = canTeachCohort({ userId: ctx.user.id, orgId: ctx.org?.id ?? null, role: ctx.role }, cohort, links.map((l) => l.userId));
  if (!own && !teaches) notFound();

  const checkUrl = `${await baseUrl()}/verify/${code}`;
  const back = own ? { href: `/learn/${enrollment.id}`, label: "My roadmap" } : { href: `/cohorts/${cohort.id}/students/${enrollment.id}`, label: cert.nameOnCertificate };
  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
      <div className="print:hidden">
        <PageHeader title="Certificate" sub={`${cert.trackTitle} · ${cert.cohortName}`} back={back}
          actions={!cert.revokedAt && <>
            <PrintButton />
            <CopyButton text={checkUrl} label="Copy check link" />
          </>} />
        {cert.revokedAt ? (
          <p role="alert" className="mb-6 flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            <Icon name="error" size={20} />
            <span><b>This certificate was revoked</b> on {fmtDate(cert.revokedAt)}{cert.revokeReason ? `: ${cert.revokeReason}` : ""}. It is no longer valid.</span>
          </p>
        ) : (
          <p className="mb-6 text-sm text-ink-muted">
            <b className="text-ink">Download PDF</b> opens the print window: choose <b className="text-ink">Save as PDF</b>. Anyone can check it is genuine by scanning the QR code or opening{" "}
            <Link href={`/verify/${code}`} className="text-secondary underline">the check page</Link>.
          </p>
        )}
      </div>
      <div className={cert.revokedAt ? "opacity-50 print:hidden" : ""}>
        <Certificate c={cert} qr={await qrSvg(checkUrl)} checkUrl={checkUrl} />
      </div>
      {ctx.role === "ADMIN" && ctx.org?.id === cert.orgId && !cert.revokedAt && (
        <details className="card mt-8 p-4 print:hidden">
          <summary className="cursor-pointer font-semibold">Revoke this certificate</summary>
          <p className="my-2 text-sm text-ink-muted">Only if it was issued by mistake. The check page will say it was revoked, with your reason.</p>
          <RevokeCertificateForm certificateId={cert.id} />
        </details>
      )}
    </>
  );
}

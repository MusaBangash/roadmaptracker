import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/access";
import { canTeachCohort } from "@/lib/access-core";
import { normalizeCode } from "@/lib/certificate-core";
import { qrSvg } from "@/lib/certificates";
import { baseUrl } from "@/lib/url";
import { Certificate } from "@/components/certificate";
import { DesignedCertificate } from "@/components/designed-certificate";
import { designImageUrl } from "@/lib/certificate-designs";
import { formatCertDate, pakistanDay, parseLayout } from "@/lib/certificate-design-core";
import { PrintButton, RevokeCertificateForm } from "@/components/certificate-tools";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { getT } from "@/i18n/server";

export const metadata = { title: "Certificate" };

/** Story 3 + 5: the certificate, for the student who earned it and the people who teach their cohort. */
export default async function CertificatePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ copy?: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) notFound();
  const [ctx, t] = await Promise.all([getContext(), getT()]);
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
  // Printed on the school's own design (Certificate design, Story 4), with the places it was issued with.
  const layout = cert.layout && parseLayout(cert.layout);
  const design = cert.designId && layout
    ? await db.query.certificateDesigns.findFirst({ where: eq(schema.certificateDesigns.id, cert.designId), columns: { id: true, width: true, height: true, onlineUpdatedAt: true } })
    : null;
  // Option B: the online version (no signature lines) for everyone; the cohort's teachers and admins can
  // switch to the print version to print and sign by hand.
  const printCopy = !!design && teaches && (await searchParams).copy === "print";
  const hasOnline = !!design?.onlineUpdatedAt;
  const back = own ? { href: `/learn/${enrollment.id}`, label: t("cert.myRoadmap") } : { href: `/cohorts/${cohort.id}/students/${enrollment.id}`, label: cert.nameOnCertificate };
  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
      <div className="print:hidden">
        <PageHeader title={t("cert.title")} sub={`${cert.trackTitle} · ${cert.cohortName}`} back={back}
          actions={!cert.revokedAt && <>
            {printCopy ? <PrintButton label="Print" /> : <PrintButton />}
            {design && teaches && hasOnline && (printCopy
              ? <Link href={`/certificates/${code}`} className="btn-ghost">Online copy</Link>
              : <Link href={`/certificates/${code}?copy=print`} className="btn-ghost"><Icon name="print" size={18} />Print for signing</Link>)}
            <CopyButton text={checkUrl} label={t("cert.copyCheck")} />
          </>} />
        {printCopy && hasOnline && !cert.revokedAt && (
          <p className="mb-4 flex items-start gap-2 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
            <Icon name="info" size={20} /><span><b>Print version</b>, with the signature lines: print it and sign by hand. Students see the online version.</span>
          </p>
        )}
        {cert.revokedAt ? (
          <p role="alert" className="mb-6 flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            <Icon name="error" size={20} />
            <span>{cert.revokeReason
              ? t.rich("cert.revokedReason", { b: (s) => <b>{s}</b> }, { date: t.date(cert.revokedAt), reason: cert.revokeReason })
              : t.rich("cert.revoked", { b: (s) => <b>{s}</b> }, { date: t.date(cert.revokedAt) })}</span>
          </p>
        ) : !printCopy && (
          <p className="mb-6 text-sm text-ink-muted">
            {t.rich("cert.help", { b: (s) => <b className="text-ink">{s}</b>, link: (s) => <Link href={`/verify/${code}`} className="text-secondary underline">{s}</Link> })}
          </p>
        )}
      </div>
      <div className={cert.revokedAt ? "opacity-50 print:hidden" : ""}>
        {design && layout ? (
          <DesignedCertificate imageUrl={designImageUrl(design.id, printCopy ? null : design.onlineUpdatedAt)} aspect={design.width / design.height} layout={layout} qr={await qrSvg(checkUrl)} code={cert.code}
            values={{
              name: cert.nameOnCertificate, regNo: cert.regNo ?? "", date: formatCertDate(pakistanDay(cert.issuedAt), layout.dateFormat),
              course: cert.courseTitle ?? cert.trackTitle, duration: cert.duration ?? "", session: cert.session ?? "", level: cert.level ?? "",
            }} />
        ) : (
          <Certificate c={cert} qr={await qrSvg(checkUrl)} checkUrl={checkUrl} />
        )}
      </div>
      {ctx.role === "ADMIN" && ctx.org?.id === cert.orgId && !cert.revokedAt && (
        <details className="card mt-8 p-4 print:hidden">
          <summary className="cursor-pointer font-semibold">{t("cert.revokeTitle")}</summary>
          <p className="my-2 text-sm text-ink-muted">{t("cert.revokeHelp")}</p>
          <RevokeCertificateForm certificateId={cert.id} />
        </details>
      )}
    </>
  );
}

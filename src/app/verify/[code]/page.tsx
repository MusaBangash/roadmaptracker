import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeCode } from "@/lib/certificate-core";
import { fmtDate } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";

export const metadata = { title: "Check a certificate", robots: { index: false } };

const urdu = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);

/** Story 4: public check page behind the QR code. Shows only what is printed on the certificate. */
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const cert = code ? await db.query.certificates.findFirst({ where: eq(schema.certificates.code, code) }) : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-10">
      <Link href="/" className="mb-8 self-center"><Logo size={40} product="Tracks" /></Link>
      <div className="card p-6 sm:p-8">
        <p className="mb-1 text-sm text-ink-muted">Certificate no. <span className="font-mono text-ink">{code ?? (await params).code.slice(0, 20)}</span></p>
        {!cert ? (
          <>
            <h1 className="h2 mb-2">No certificate with this number</h1>
            <p className="text-sm text-ink-muted">Check the number on the certificate and try again. Numbers use the letters A–Z (without I, L, O, U, V) and the digits 2–9.</p>
          </>
        ) : (
          <>
            <div className="mb-4">
              {cert.revokedAt
                ? <Badge tone="danger" icon="x">This certificate was revoked</Badge>
                : <Badge tone="success" icon="check">Valid certificate</Badge>}
            </div>
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-ink-muted">Awarded to</dt>
                <dd lang={urdu(cert.nameOnCertificate) ? "ur" : "en"} dir="auto" className={`text-xl font-bold text-primary ${urdu(cert.nameOnCertificate) ? "leading-[2.2] [font-family:var(--font-urdu)]" : ""}`}>{cert.nameOnCertificate}</dd></div>
              <div><dt className="text-ink-muted">For completing</dt>
                <dd className="font-semibold">{cert.trackTitle}{cert.trackEdition ? ` · ${cert.trackEdition.replace(/\s+-\s+/g, " · ")}` : ""}</dd></div>
              <div><dt className="text-ink-muted">At</dt><dd className="font-semibold">{cert.schoolName}</dd></div>
              <div><dt className="text-ink-muted">Completed on</dt><dd className="font-semibold">{fmtDate(cert.completedOn)}</dd></div>
            </dl>
            {cert.revokedAt && <p className="mt-4 text-sm text-danger">Revoked on {fmtDate(cert.revokedAt)}. It is no longer valid.</p>}
          </>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-ink-muted">NoorAI Tracks keeps the record of every certificate it issues. <Link href="/privacy" className="underline">Privacy notice</Link></p>
    </main>
  );
}

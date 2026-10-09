import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeCode } from "@/lib/certificate-core";
import { getT } from "@/i18n/server";
import { hasUrdu } from "@/lib/comment-core";
import { LanguageSwitch } from "@/components/language-switch";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";

export const metadata = { title: "Check a certificate", robots: { index: false } };

const urdu = hasUrdu;

/** Story 4: public check page behind the QR code. Shows only what is printed on the certificate. */
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const cert = code ? await db.query.certificates.findFirst({ where: eq(schema.certificates.code, code) }) : null;
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-10">
      <Link href="/" className="mb-8 self-center"><Logo size={40} product="Tracks" /></Link>
      <div className="card p-6 sm:p-8">
        <p className="mb-1 text-sm text-ink-muted">{t("verify.number")} <span className="font-mono text-ink" dir="ltr">{code ?? (await params).code.slice(0, 20)}</span></p>
        {!cert ? (
          <>
            <h1 className="h2 mb-2">{t("verify.none")}</h1>
            <p className="text-sm text-ink-muted">{t("verify.noneSub")}</p>
          </>
        ) : (
          <>
            <div className="mb-4">
              {cert.revokedAt
                ? <Badge tone="danger" icon="x">{t("verify.revoked")}</Badge>
                : <Badge tone="success" icon="check">{t("verify.valid")}</Badge>}
            </div>
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-ink-muted">{t("verify.awardedTo")}</dt>
                <dd lang={urdu(cert.nameOnCertificate) ? "ur" : "en"} dir="auto" className={`text-xl font-bold text-primary ${urdu(cert.nameOnCertificate) ? "leading-[2.2] [font-family:var(--font-urdu)]" : ""}`}>{cert.nameOnCertificate}</dd></div>
              <div><dt className="text-ink-muted">{t("verify.forCompleting")}</dt>
                <dd className="font-semibold" lang="en" dir="auto">{cert.trackTitle}{cert.trackEdition ? ` · ${cert.trackEdition.replace(/\s+-\s+/g, " · ")}` : ""}</dd></div>
              <div><dt className="text-ink-muted">{t("verify.at")}</dt><dd className="font-semibold" dir="auto">{cert.schoolName}</dd></div>
              <div><dt className="text-ink-muted">{t("verify.completedOn")}</dt><dd className="font-semibold">{t.date(cert.completedOn)}</dd></div>
            </dl>
            {cert.revokedAt && <p className="mt-4 text-sm text-danger">{t("verify.revokedOn", { date: t.date(cert.revokedAt) })}</p>}
          </>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-ink-muted">{t("verify.footer")} <Link href="/privacy" className="underline">{t("account.privacy")}</Link></p>
      <div className="mt-4 self-center"><LanguageSwitch /></div>
    </main>
  );
}

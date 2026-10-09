import { Logo } from "@/components/logo";
import { fmtDate } from "@/lib/utils";

export type CertificateData = {
  code: string; nameOnCertificate: string; trackTitle: string; trackEdition: string; schoolName: string;
  cohortName: string; completedOn: string; issuedByName: string;
};

const urdu = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);

/**
 * The certificate itself (Step 5, feature 2). Always light, whatever the theme; sized with container
 * units so it shrinks to fit a phone and prints as one A4 landscape page (the page adds the @page rule).
 * `qr` is an SVG string from src/lib/certificates.ts (made by the qrcode library, not user input).
 */
export function Certificate({ c, qr, checkUrl }: { c: CertificateData; qr: string; checkUrl: string }) {
  const edition = c.trackEdition.replace(/\s+-\s+/g, " · ");
  return (
    <div data-theme="light" className="certificate mx-auto w-full max-w-5xl bg-surface print:w-[297mm] print:max-w-none text-ink [container-type:inline-size] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
      {/* A4 shape (210/297 = 70.7%), but allowed to grow if a long name or a narrow phone needs more room. */}
      <div className="relative flex min-h-[70.7cqw] flex-col border-[1.2cqw] border-primary p-[1.4cqw] print:h-[210mm] print:min-h-0 print:w-[297mm]">
        <div className="flex flex-1 flex-col border-[0.25cqw] border-highlight px-[6cqw] py-[4cqw]">
          <div className="flex items-start justify-between">
            <Logo size={36} product="Tracks" />
            <div className="text-right text-[1.5cqw] leading-tight text-ink-muted">
              <div className="font-semibold uppercase tracking-[0.2em]">Certificate no.</div>
              <div className="font-mono text-[1.9cqw] text-ink">{c.code}</div>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="text-[1.8cqw] font-semibold uppercase tracking-[0.35em] text-highlight-text">Certificate of completion</div>
            <div className="mt-[2.4cqw] text-[1.9cqw] text-ink-muted">This certifies that</div>
            <div lang={urdu(c.nameOnCertificate) ? "ur" : "en"} dir="auto"
              className={`mt-[1cqw] max-w-full break-words font-bold text-primary ${urdu(c.nameOnCertificate) ? "text-[4.4cqw] leading-[2.2] [font-family:var(--font-urdu)]" : "text-[5.2cqw] leading-tight"}`}>
              {c.nameOnCertificate}
            </div>
            <div className="mx-auto mt-[1.2cqw] h-[0.2cqw] w-[30cqw] bg-highlight" />
            <div className="mt-[2cqw] text-[1.9cqw] text-ink-muted">has completed the roadmap</div>
            <div className="mt-[0.6cqw] text-[3.2cqw] font-bold leading-tight">{c.trackTitle}</div>
            {edition && <div className="mt-[0.4cqw] text-[1.8cqw] text-ink-muted">{edition}</div>}
            <div className="mt-[1.6cqw] text-[1.8cqw]">at <b>{c.schoolName}</b> · {c.cohortName}</div>
          </div>

          <div className="flex items-end justify-between gap-[3cqw] text-[1.5cqw]">
            <div className="grid grid-cols-2 gap-x-[5cqw] gap-y-[0.4cqw]">
              <div className="text-ink-muted">Completed on</div><div className="text-ink-muted">Issued by</div>
              <div className="border-t-[0.15cqw] border-border-strong pt-[0.5cqw] text-[1.8cqw] font-semibold">{fmtDate(c.completedOn)}</div>
              <div className="border-t-[0.15cqw] border-border-strong pt-[0.5cqw] text-[1.8cqw] font-semibold">{c.issuedByName}</div>
            </div>
            <div className="flex items-end gap-[1.2cqw] text-right">
              <div className="text-[1.3cqw] leading-snug text-ink-muted">
                Scan to check this<br />certificate is genuine<br /><span className="break-all font-mono text-ink">{checkUrl.replace(/^https?:\/\//, "")}</span>
              </div>
              <div className="w-[11cqw] shrink-0 [&>svg]:h-auto [&>svg]:w-full" aria-label="QR code for the check page" role="img"
                dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { requireRole } from "@/lib/access";
import { currentDesign, designImageUrl } from "@/lib/certificate-designs";
import { qrSvg } from "@/lib/certificates";
import { baseUrl } from "@/lib/url";
import { removeDesignAction, removeOnlineAction } from "@/app/actions/certificate-design";
import { DesignEditor, DesignUploadForm } from "@/components/certificate-design-editor";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Certificate design" };

/** Stories 1 + 2 (+ option B, the online version): the school's own certificate picture, and where each
 *  value is printed on it. */
export default async function CertificateDesignPage({ searchParams }: { searchParams: Promise<{ removed?: string; n?: string }> }) {
  const ctx = await requireRole(["ADMIN"]);
  const { removed, n } = await searchParams;
  const design = await currentDesign(ctx.org.id);
  const sampleQr = await qrSvg(`${await baseUrl()}/verify/7K3MQ-9TXWA`);
  const kept = Number(n) || 0;
  return (
    <>
      <PageHeader title="Certificate design" sub={ctx.org.name} back={{ href: "/admin/members", label: "People" }} />
      {removed && !design && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Icon name="check" size={18} />
          {removed === "deleted"
            ? "Deleted. New certificates use the plain NoorAI design."
            : `Stopped. ${kept} ${kept === 1 ? "certificate was" : "certificates were"} printed on that design, so it is kept for ${kept === 1 ? "it" : "them"}. New certificates use the plain NoorAI design.`}
        </p>
      )}
      {!design ? (
        <div className="grid max-w-2xl gap-6">
          <p className="text-ink-muted">
            Certificates use the plain NoorAI design now. Upload your school&apos;s own certificate as a picture with the
            spaces left empty, and the app prints each student&apos;s name, Reg No, date, course and a QR code on it.
            You print it and sign it by hand; students download their own copy as a PDF.
          </p>
          <section className="card p-4 sm:p-5"><DesignUploadForm replacing={false} /></section>
        </div>
      ) : (
        <>
          <p className="mb-4 max-w-3xl text-sm text-ink-muted">
            New certificates of {ctx.org.name} are printed on this design (uploaded {fmtDate(design.createdAt)}, {design.width} × {design.height}).
            Certificates already issued keep the places they were printed with.
          </p>
          <DesignEditor key={design.id} designId={design.id} imageUrl={designImageUrl(design.id)}
            onlineUrl={design.onlineUpdatedAt ? designImageUrl(design.id, design.onlineUpdatedAt) : null}
            aspect={design.width / design.height} initial={design.layout} qr={sampleQr} />

          <section className="card mt-8 p-4 sm:p-5" aria-labelledby="online-h">
            <h2 id="online-h" className="h2 mb-1">Second picture for the online copy (optional)</h2>
            <p className="mb-3 max-w-3xl text-sm text-ink-muted">
              Usually not needed: mark texts such as the signatures &ldquo;Printed only&rdquo; and &ldquo;Digitally issued&rdquo; &ldquo;Online only&rdquo;
              above. Only if the <b>picture itself</b> must differ online (e.g. signature lines drawn into it), upload the same design without them here.
            </p>
            {design.onlineUpdatedAt ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="text-sm">
                  <p className="mb-3 flex items-center gap-2"><Icon name="check" size={18} />In use since {fmtDate(design.onlineUpdatedAt)}: students get the online version, &ldquo;Print for signing&rdquo; uses the print version.</p>
                  <form action={removeOnlineAction}>
                    <ConfirmButton className="btn-ghost" message="Remove the online version? Students' PDFs will use the print version again.">
                      <Icon name="trash" size={18} />Remove online version
                    </ConfirmButton>
                  </form>
                </div>
                <details><summary className="cursor-pointer text-sm font-semibold">Replace the online version</summary><div className="mt-3"><DesignUploadForm replacing online /></div></details>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm"><b>None yet:</b> both copies use the same picture.</p>
                <DesignUploadForm replacing={false} online />
              </>
            )}
          </section>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Replace the print version</summary>
              <p className="my-2 text-sm text-ink-muted">For a corrected design. The values stay in their places; check them afterwards.</p>
              <DesignUploadForm replacing />
            </details>
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Remove this design</summary>
              <p className="my-2 text-sm text-ink-muted">
                If no certificate was printed on it yet (a test or wrong picture), it is <b>deleted completely</b>. If certificates
                were printed on it, it is only stopped: those certificates keep it. New certificates go back to the plain NoorAI design.
              </p>
              <form action={removeDesignAction}>
                <ConfirmButton className="btn-danger" message="Remove this certificate design?"><Icon name="trash" size={18} />Remove design</ConfirmButton>
              </form>
            </details>
          </div>
        </>
      )}
    </>
  );
}

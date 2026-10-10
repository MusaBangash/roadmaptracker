import { requireRole } from "@/lib/access";
import { currentDesign, designImageUrl } from "@/lib/certificate-designs";
import { qrSvg } from "@/lib/certificates";
import { baseUrl } from "@/lib/url";
import { stopDesignAction } from "@/app/actions/certificate-design";
import { DesignEditor, DesignUploadForm } from "@/components/certificate-design-editor";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Certificate design" };

/** Stories 1 + 2: the school's own certificate picture, and where each value is printed on it. */
export default async function CertificateDesignPage() {
  const ctx = await requireRole(["ADMIN"]);
  const design = await currentDesign(ctx.org.id);
  const sampleQr = await qrSvg(`${await baseUrl()}/verify/7K3MQ-9TXWA`);
  return (
    <>
      <PageHeader title="Certificate design" sub={ctx.org.name} back={{ href: "/admin/members", label: "People" }} />
      {!design ? (
        <div className="grid max-w-2xl gap-6">
          <p className="text-ink-muted">
            Certificates use the plain NoorAI design now. Upload your school&apos;s own certificate as a picture with the
            spaces left empty, and the app prints each student&apos;s name, Reg No, date, course and a QR code on it.
            Students download it as a PDF; you print it and sign it by hand.
          </p>
          <section className="card p-4 sm:p-5"><DesignUploadForm replacing={false} /></section>
        </div>
      ) : (
        <>
          <p className="mb-4 max-w-3xl text-sm text-ink-muted">
            New certificates of {ctx.org.name} are printed on this design (uploaded {fmtDate(design.createdAt)}, {design.width} × {design.height}).
            Certificates already issued keep the design and places they were printed with.
          </p>
          <DesignEditor key={design.id} designId={design.id} imageUrl={designImageUrl(design.id)} aspect={design.width / design.height}
            initial={design.layout} qr={sampleQr} />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Replace the picture</summary>
              <p className="my-2 text-sm text-ink-muted">For a corrected design. The values stay in their places; check them afterwards.</p>
              <DesignUploadForm replacing />
            </details>
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Stop using this design</summary>
              <p className="my-2 text-sm text-ink-muted">New certificates go back to the plain NoorAI design. Issued ones don&apos;t change.</p>
              <form action={stopDesignAction}><button className="btn-danger"><Icon name="x" size={18} />Stop using it</button></form>
            </details>
          </div>
        </>
      )}
    </>
  );
}

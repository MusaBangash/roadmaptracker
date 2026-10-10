import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/access";
import { currentDesign, designImageUrl } from "@/lib/certificate-designs";
import { formatCertDate, pakistanDay } from "@/lib/certificate-design-core";
import { qrSvg } from "@/lib/certificates";
import { baseUrl } from "@/lib/url";
import { DesignedCertificate } from "@/components/designed-certificate";
import { PrintButton } from "@/components/certificate-tools";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Test print" };

/** Story 2: an example certificate with the saved places, to print once and hold against the light. */
export default async function DesignPreviewPage({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  const ctx = await requireRole(["ADMIN"]);
  const design = await currentDesign(ctx.org.id);
  if (!design) redirect("/admin/certificate-design");
  const qr = await qrSvg(`${await baseUrl()}/verify/7K3MQ-9TXWA`);
  const online = (await searchParams).copy === "online";
  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
      <div className="print:hidden">
        <PageHeader title="Test print" sub="An example only: it is not a certificate and its code checks as not found."
          back={{ href: "/admin/certificate-design", label: "Certificate design" }}
          actions={<>
            <PrintButton label="Print" />
            {(online
              ? <Link href="/admin/certificate-design/preview" className="btn-ghost">Show print version</Link>
              : <Link href="/admin/certificate-design/preview?copy=online" className="btn-ghost">Show online version</Link>)}
          </>} />
      </div>
      <DesignedCertificate copy={online ? "online" : "print"} imageUrl={designImageUrl(design.id, online ? design.onlineUpdatedAt : null)} aspect={design.width / design.height} layout={design.layout} qr={qr} code="7K3MQ-9TXWA"
        values={{
          name: "Hafiza Maryam Munir", regNo: "B5-AI-011", date: formatCertDate(pakistanDay(new Date()), design.layout.dateFormat),
          course: "Artificial Intelligence", duration: "12 Weeks", session: "Jun 2026 – Aug 2026", level: "Foundation",
        }} />
    </>
  );
}

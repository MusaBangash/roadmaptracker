import { requireLabAccess } from "@/lib/access";
import { labProblems } from "@/lib/labs";
import { pakistanDay } from "@/lib/certificate-design-core";
import { InspectionForm } from "@/components/lab-forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New inspection" };

/** Story 2: the monthly inspection of one lab. */
export default async function InspectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireLabAccess((await params).id);
  const open = await labProblems(ctx.lab.id, "open");
  return (
    <>
      <PageHeader title="New inspection" sub={`${ctx.lab.name} · ${ctx.lab.pcCount} PCs`} back={{ href: `/labs/${ctx.lab.id}`, label: ctx.lab.name }} />
      <InspectionForm lab={ctx.lab} today={pakistanDay(new Date())}
        open={open.map(({ f }) => ({ station: f.station, item: f.item, status: f.status, note: f.note }))} />
    </>
  );
}

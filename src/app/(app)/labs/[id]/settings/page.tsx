import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireLabAccess } from "@/lib/access";
import { staffOf } from "@/lib/labs";
import { LabForm } from "@/components/lab-forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Lab settings" };

/** Story 1: an admin changes a lab. */
export default async function LabSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireLabAccess((await params).id);
  if (ctx.role !== "ADMIN") redirect(`/labs/${ctx.lab.id}`);
  const [staff, links] = await Promise.all([
    staffOf(ctx.org.id),
    db.select({ userId: schema.labTeachers.userId }).from(schema.labTeachers).where(eq(schema.labTeachers.labId, ctx.lab.id)),
  ]);
  return (
    <>
      <PageHeader title="Lab settings" sub={ctx.lab.name} back={{ href: `/labs/${ctx.lab.id}`, label: ctx.lab.name }} />
      <LabForm lab={ctx.lab} staff={staff} teacherIds={links.map((l) => l.userId)} />
    </>
  );
}

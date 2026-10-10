import { requireRole } from "@/lib/access";
import { staffOf } from "@/lib/labs";
import { LabForm } from "@/components/lab-forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Add lab" };

/** Story 1: an admin adds a lab. */
export default async function NewLabPage() {
  const ctx = await requireRole(["ADMIN"]);
  return (
    <>
      <PageHeader title="Add lab" sub={ctx.org.name} back={{ href: "/labs", label: "Labs" }} />
      <LabForm staff={await staffOf(ctx.org.id)} />
    </>
  );
}

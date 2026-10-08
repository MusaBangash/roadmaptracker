import { redirect } from "next/navigation";
import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { OrgForm } from "@/components/org-form";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Schools" };

export default async function PlatformPage() {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/dashboard");
  const orgs = await db.select({
    o: schema.organizations,
    members: sql<number>`(select count(*) from "membership" m where m.org_id = "organization"."id")`,
    students: sql<number>`(select count(*) from "membership" m where m.org_id = "organization"."id" and m.role = 'STUDENT')`,
    cohorts: sql<number>`(select count(*) from "cohort" c where c.org_id = "organization"."id")`,
  }).from(schema.organizations).orderBy(asc(schema.organizations.name));
  return (
    <>
      <PageHeader title="Schools" sub="Every school on this NoorAI Tracks installation. Each school's data is kept separate." />
      <OrgForm />
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">School</th><th className="p-3">Members</th><th className="p-3">Students</th><th className="p-3">Cohorts</th><th className="p-3">Created</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orgs.map(({ o, members, students, cohorts }) => (
              <tr key={o.id}><td className="p-3 font-semibold">{o.name}</td><td className="p-3">{Number(members)}</td><td className="p-3">{Number(students)}</td><td className="p-3">{Number(cohorts)}</td><td className="p-3 text-muted">{fmtDate(o.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

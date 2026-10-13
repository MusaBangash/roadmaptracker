import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { SchoolNameForm } from "@/components/school-name-form";
import { AddGroupForm, GroupNameForm } from "@/components/school-settings";
import { deleteGroupAction, setHostelAction } from "@/app/actions/school";
import { loadGroups } from "@/lib/groups";
import { plural } from "@/lib/utils";

export const metadata = { title: "School settings" };

/** School settings (admins): the school's name, its class groups and its hostel. */
export default async function SchoolSettingsPage() {
  const ctx = await requireRole(["ADMIN"]);
  const [groups, used, hostel] = await Promise.all([
    loadGroups(ctx.org.id),
    db.select({ g: schema.cohorts.groupId, n: sql<number>`count(*)::int` }).from(schema.cohorts)
      .where(eq(schema.cohorts.orgId, ctx.org.id)).groupBy(schema.cohorts.groupId),
    db.select({ r: schema.memberships.residence, n: sql<number>`count(*)::int` }).from(schema.memberships)
      .where(eq(schema.memberships.orgId, ctx.org.id)).groupBy(schema.memberships.residence),
  ]);
  const classesIn = new Map(used.map((u) => [u.g, u.n]));
  const count = (r: string) => hostel.find((h) => h.r === r)?.n ?? 0;

  return (
    <>
      <PageHeader title="School settings" sub={ctx.org.name} back={{ href: "/admin/members", label: "People" }} />
      <div className="grid max-w-2xl gap-6">
        <SchoolNameForm name={ctx.org.name} />

        <section className="card grid gap-4 p-4">
          <div>
            <h2 className="h2">Class groups</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Your school&apos;s own groups, e.g. Morning Boys, Morning Girls, Evening Boys, Evening Girls. Choose a class&apos;s group
              on New cohort or Edit cohort; then the dashboard, cohort list and insights can show one group, with totals per group.
            </p>
          </div>
          {groups.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-start gap-2 p-3">
                  <GroupNameForm groupId={g.id} name={g.name} />
                  <span className="self-center text-xs text-ink-muted">{plural(classesIn.get(g.id) ?? 0, "class", "classes")}</span>
                  <form action={deleteGroupAction}>
                    <input type="hidden" name="groupId" value={g.id} />
                    <button className="btn-ghost py-1.5 text-xs text-danger" aria-label={`Remove ${g.name}`}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <AddGroupForm />
          <p className="text-xs text-ink-muted">Removing a group keeps its classes; they just have no group.</p>
        </section>

        <section className="card grid gap-3 p-4">
          <div>
            <h2 className="h2">Hostel</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {ctx.org.hasHostel
                ? <>On. Teachers mark each student as Hostel or Day scholar (on the class page or the student&apos;s page). The <b>Hostel</b> page lists hostel students who are absent or on leave each day, for the warden. Now: {count("HOSTEL")} hostel, {count("DAY")} day scholars.</>
                : "Turn this on if your school has a hostel. Then students can be marked Hostel or Day scholar, lists can show one or the other, and a daily hostel list can go to the warden."}
            </p>
          </div>
          <form action={setHostelAction}>
            <input type="hidden" name="on" value={ctx.org.hasHostel ? "0" : "1"} />
            <button className={ctx.org.hasHostel ? "btn-ghost" : "btn-primary"}>{ctx.org.hasHostel ? "Turn the hostel off" : "We have a hostel: turn on"}</button>
          </form>
          {ctx.org.hasHostel && <p className="text-xs text-ink-muted">Turning it off hides the hostel lists; each student&apos;s mark is kept for when you turn it on again.</p>}
        </section>
      </div>
    </>
  );
}

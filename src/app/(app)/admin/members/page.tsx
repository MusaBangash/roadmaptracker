import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { setMemberRoleAction, removeMemberAction, createInviteAction, deleteInviteAction } from "@/app/actions/admin";
import { PageHeader, Tag, sentence } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { DeletePersonForm, ResetLinkForm } from "@/components/member-tools";
import { Icon } from "@/components/icon";
import { SchoolNameForm } from "@/components/school-name-form";
import Link from "next/link";
import { baseUrl } from "@/lib/url";
import { fmtDate, plural } from "@/lib/utils";

export const metadata = { title: "People" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const ctx = await requireRole(["ADMIN"]);
  const { deleted } = await searchParams;
  const members = await db.select({ m: schema.memberships, u: schema.users }).from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.memberships.orgId, ctx.org.id)).orderBy(schema.memberships.role, schema.users.name);
  const invites = await db.query.invites.findMany({ where: and(eq(schema.invites.orgId, ctx.org.id), isNull(schema.invites.cohortId)) });
  const url = await baseUrl();
  const counts = { ADMIN: 0, INSTRUCTOR: 0, STUDENT: 0 } as Record<string, number>;
  for (const { m } of members) counts[m.role]++;

  return (
    <>
      <PageHeader title="People" sub={`${ctx.org.name} · ${plural(counts.ADMIN ?? 0, "admin")} · ${plural(counts.INSTRUCTOR ?? 0, "instructor")} · ${plural(counts.STUDENT ?? 0, "student")}`}
        actions={<>
          <Link href="/admin/activity" className="btn-ghost"><Icon name="clock" size={18} />Activity</Link>
          <Link href="/admin/certificate-design" className="btn-ghost"><Icon name="star" size={18} />Certificate design</Link>
          <a href="/admin/backup" className="btn-ghost"><Icon name="download" size={18} />Download school backup</a>
        </>} />

      <div className="mb-8 max-w-xl"><SchoolNameForm name={ctx.org.name} /></div>

      {deleted && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Icon name="check" size={18} />
          {deleted === "account" ? "Deleted. Their account and all their data are gone." : "Deleted their place and work in this school. Their account stays for their other school."}
        </p>
      )}
      <section className="mb-8">
        <h2 className="h2 mb-1">School invite links</h2>
        <p className="mb-3 text-sm text-ink-muted">For staff, or students not yet in a cohort. To put students straight into a cohort, use the invite link on the cohort page.</p>
        <div className="card divide-y divide-border">
          {invites.map((inv) => {
            const link = `${url}/join/${inv.code}`;
            return (
              <div key={inv.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <Tag>{sentence(inv.role)}</Tag>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
                <span className="text-xs text-ink-muted">{inv.uses}/{inv.maxUses} used · until {fmtDate(inv.expiresAt)}</span>
                <CopyButton text={link} />
                <form action={deleteInviteAction}><input type="hidden" name="inviteId" value={inv.id} /><button className="text-xs text-danger">Delete</button></form>
              </div>
            );
          })}
          <form action={createInviteAction} className="flex flex-wrap items-end gap-2 p-3">
            <div><label className="label" htmlFor="role">Role</label>
              <select id="role" name="role" className="input py-1.5"><option value="INSTRUCTOR">Instructor</option><option value="ADMIN">Admin</option><option value="STUDENT">Student</option></select></div>
            <div><label className="label" htmlFor="maxUses">Max uses</label><input id="maxUses" name="maxUses" type="number" defaultValue={5} min={1} max={500} className="input w-24 py-1.5" /></div>
            <div><label className="label" htmlFor="days">Valid days</label><input id="days" name="days" type="number" defaultValue={14} min={1} max={365} className="input w-24 py-1.5" /></div>
            <button className="btn-primary">Create link</button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="h2 mb-3">Members</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-border text-left text-sm font-semibold text-ink-muted"><tr><th className="p-3">Name</th><th className="p-3">Joined</th><th className="p-3">Role</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-border">
              {members.map(({ m, u }) => (
                <tr key={m.id}>
                  <td className="p-3"><div className="font-semibold">{u.name ?? "—"}</div><div className="text-xs text-ink-muted">{u.email}</div></td>
                  <td className="p-3 text-ink-muted">{fmtDate(m.createdAt)}</td>
                  <td className="p-3">
                    <form action={setMemberRoleAction} className="flex gap-2">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select name="role" defaultValue={m.role} className="input py-1" aria-label={`Role for ${u.email}`}>
                        <option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option><option value="ADMIN">Admin</option>
                      </select>
                      <button className="btn-ghost px-3 py-1 text-xs">Save</button>
                    </form>
                  </td>
                  <td className="p-3 text-right">
                    {m.userId !== ctx.user.id && (
                      <details className="inline-block text-left">
                        <summary className="btn-ghost cursor-pointer list-none px-3 text-sm">More</summary>
                        <div className="mt-2 grid w-[min(22rem,80vw)] gap-4 rounded-md border border-border bg-surface-sunken p-3">
                          {!u.isSuperAdmin && <ResetLinkForm userId={u.id} name={u.name ?? u.email ?? "this person"} />}
                          <form action={removeMemberAction} className="grid gap-1 border-t border-border pt-3">
                            <input type="hidden" name="membershipId" value={m.id} />
                            <p className="text-sm text-ink-muted">Remove from this school. Their work stays in the school&apos;s records.</p>
                            <div><button className="btn-ghost text-danger">Remove from school</button></div>
                          </form>
                          {!u.isSuperAdmin && u.email && (
                            <div className="border-t border-border pt-3"><DeletePersonForm userId={u.id} email={u.email} name={u.name ?? u.email} /></div>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { actionLabel, actionsIn, AUDIT_GROUPS, type AuditGroup } from "@/lib/audit-core";
import { PageHeader, Empty } from "@/components/ui";

export const metadata = { title: "Activity" };

const PAGE = 50;
const actor = alias(schema.users, "actor");
const subject = alias(schema.users, "subject");

const when = (d: Date) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(d);

/** Story 3: who did what, and when, in this school. Read-only: nothing here can be changed. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ group?: string; person?: string; before?: string }> }) {
  const ctx = await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const group = sp.group && sp.group in AUDIT_GROUPS ? (sp.group as AuditGroup) : null;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : null;
  const people = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.orgId, ctx.org.id)).orderBy(schema.users.name);
  const person = people.find((p) => p.id === sp.person) ?? null;

  const where: SQL[] = [eq(schema.auditLog.orgId, ctx.org.id)];
  if (group) where.push(inArray(schema.auditLog.action, actionsIn(group)));
  if (person) where.push(or(eq(schema.auditLog.actorId, person.id), eq(schema.auditLog.subjectId, person.id))!);
  if (before) where.push(lt(schema.auditLog.createdAt, before));
  const rows = await db.select({
    a: schema.auditLog,
    actor: { name: actor.name, email: actor.email },
    subject: { name: subject.name, email: subject.email },
  }).from(schema.auditLog)
    .leftJoin(actor, eq(actor.id, schema.auditLog.actorId))
    .leftJoin(subject, eq(subject.id, schema.auditLog.subjectId))
    .where(and(...where)).orderBy(desc(schema.auditLog.createdAt)).limit(PAGE + 1);
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const who = (u: { name: string | null; email: string | null } | null, id: string | null) =>
    id ? (u?.name ?? u?.email ?? "Deleted person") : "Deleted person";
  const nextHref = () => {
    const q = new URLSearchParams();
    if (group) q.set("group", group);
    if (person) q.set("person", person.id);
    q.set("before", shown.at(-1)!.a.createdAt.toISOString());
    return `/admin/activity?${q}`;
  };

  return (
    <>
      <PageHeader title="Activity" back={{ href: "/admin/members", label: "People" }}
        sub="Who did what, and when, in your school. Nobody can change or delete these records." />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="group">Type</label>
          <select id="group" name="group" defaultValue={group ?? ""} className="input">
            <option value="">Everything</option>
            {(Object.keys(AUDIT_GROUPS) as AuditGroup[]).map((g) => <option key={g} value={g}>{AUDIT_GROUPS[g]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="person">Person</label>
          <select id="person" name="person" defaultValue={person?.id ?? ""} className="input">
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
          </select>
        </div>
        <div className="flex gap-2"><button className="btn-primary">Show</button>{(group || person) && <Link href="/admin/activity" className="btn-ghost">Clear</Link>}</div>
      </form>

      {shown.length === 0 ? <Empty title="Nothing here yet">Changes to people, work, attendance, teaching and roadmaps appear here as they happen.</Empty> : (
        <ol className="card divide-y divide-border">
          {shown.map(({ a, actor: by, subject: about }) => (
            <li key={a.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_1fr]">
              <time dateTime={a.createdAt.toISOString()} className="text-ink-muted">{when(a.createdAt)}</time>
              <div>
                <b>{who(by, a.actorId)}</b> · {actionLabel(a.action)}
                {a.subjectId !== null || a.action === "person.delete" ? <> · <span className="font-semibold">{a.subjectId === a.actorId ? "themself" : who(about, a.subjectId)}</span></> : null}
                {a.detail && <span className="text-ink-muted"> · {a.detail}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {more && <div className="mt-4"><Link href={nextHref()} className="btn-ghost">Older</Link></div>}
    </>
  );
}

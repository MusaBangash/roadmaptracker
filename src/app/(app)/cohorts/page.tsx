import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/access";
import { PageHeader, Empty, Tag } from "@/components/ui";
import { FilterChips, groupOptions } from "@/components/filter-chips";
import { loadGroups } from "@/lib/groups";
import { inGroup, parseGroup } from "@/lib/group-core";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Cohorts" };

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const ctx = await requireRole(["ADMIN", "INSTRUCTOR"]);
  const base = db.select({ c: schema.cohorts, t: schema.tracks }).from(schema.cohorts)
    .innerJoin(schema.tracks, eq(schema.cohorts.trackId, schema.tracks.id));
  const [all, groups] = await Promise.all([
    ctx.role === "ADMIN"
      ? base.where(eq(schema.cohorts.orgId, ctx.org.id)).orderBy(desc(schema.cohorts.startDate))
      : base.innerJoin(schema.cohortInstructors, eq(schema.cohortInstructors.cohortId, schema.cohorts.id))
          .where(and(eq(schema.cohorts.orgId, ctx.org.id), eq(schema.cohortInstructors.userId, ctx.user.id)))
          .orderBy(desc(schema.cohorts.startDate)),
    loadGroups(ctx.org.id),
  ]);
  // Group filter: only groups that have one of these classes.
  const shown = groups.filter((g) => all.some((r) => r.c.groupId === g.id));
  const group = parseGroup((await searchParams).group, shown.map((g) => g.id));
  const rows = all.filter((r) => inGroup(group, r.c.groupId));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const active = rows.filter((r) => !r.c.archived);
  const archived = rows.filter((r) => r.c.archived);

  const List = ({ list }: { list: typeof rows }) => (
    <div className="card divide-y divide-border">
      {list.map(({ c, t }) => (
        <Link key={c.id} href={`/cohorts/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-sunken">
          <div>
            <div className="font-semibold">{c.name}{c.groupId && <span className="ms-2 align-middle"><Tag>{groupName.get(c.groupId)}</Tag></span>}</div>
            <div className="text-sm text-ink-muted">{t.title}</div>
          </div>
          <div className="text-sm text-ink-muted">Started {fmtDate(c.startDate)}</div>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title="Cohorts" sub={ctx.org.name} actions={ctx.role === "ADMIN" ? <Link href="/cohorts/new" className="btn-primary">New cohort</Link> : null} />
      {shown.length > 0 && (
        <FilterChips label="Group" current={group}
          options={groupOptions(shown, (g) => (g ? `/cohorts?group=${g}` : "/cohorts"), all.some((r) => !r.c.groupId))} />
      )}
      {active.length === 0 ? <Empty title="No active cohorts">{ctx.role === "ADMIN" ? "Create one to start inviting students." : "Ask your school admin to add you to a cohort."}</Empty> : <List list={active} />}
      {archived.length > 0 && (<><h2 className="h2 mb-3 mt-8">Archived</h2><List list={archived} /></>)}
    </>
  );
}

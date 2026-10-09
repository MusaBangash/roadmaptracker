import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { cohortRows, pendingReviewCount } from "@/lib/cohort-stats";
import { PageHeader, ProgressBar, Stat, RiskPill, Empty, EnrollmentBadge, Tag, sentence } from "@/components/ui";
import { Icon } from "@/components/icon";
import { ClassStageList, PlanLineNote } from "@/components/progress";
import { currentStageIndex } from "@/lib/progress";
import { CopyButton } from "@/components/copy-button";
import { createInviteAction, deleteInviteAction, setCohortInstructorAction, archiveCohortAction } from "@/app/actions/admin";
import { baseUrl } from "@/lib/url";
import { pct, fmtDate, daysAgo } from "@/lib/utils";

export const metadata = { title: "Cohort" };

/** One stage as a mini bar: the fill height is how much is ticked; an icon below marks a sign-off.
 *  Shape and icon carry the meaning, so it never depends on colour alone. */
function StageCell({ p, signed, title }: { p: number; signed: boolean | null; title: string }) {
  return (
    <span title={title} className="flex w-3 flex-col items-center gap-0.5">
      <span className="flex h-5 w-full flex-col justify-end overflow-hidden rounded-xs bg-surface-sunken">
        <span className={signed === false ? "bg-danger" : "bg-primary"} style={{ height: pct(signed === true ? 1 : p) }} />
      </span>
      <span className={`h-3 ${signed === false ? "text-danger" : "text-success"}`}>
        {signed === true && <Icon name="check" size={12} />}
        {signed === false && <Icon name="x" size={12} />}
      </span>
    </span>
  );
}

export default async function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeachableCohort(id);
  const { cohort } = ctx;
  // Independent queries run together: each trip to the database costs time.
  const [track, { tree, rows, expected, expectedStages, stages, coverage }, pendingBy, invites, url, instructors, staff] = await Promise.all([
    db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }).then((t) => t!),
    cohortRows(cohort),
    pendingReviewCount([cohort.id]),
    db.query.invites.findMany({ where: eq(schema.invites.cohortId, cohort.id) }),
    baseUrl(),
    db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.cohortInstructors).innerJoin(schema.users, eq(schema.cohortInstructors.userId, schema.users.id))
      .where(eq(schema.cohortInstructors.cohortId, cohort.id)),
    ctx.role === "ADMIN"
      ? db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
          .from(schema.memberships).innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
          .where(and(eq(schema.memberships.orgId, ctx.org.id), inArray(schema.memberships.role, ["ADMIN", "INSTRUCTOR"])))
      : Promise.resolve([]),
  ]);
  const pending = pendingBy.get(cohort.id) ?? 0;
  const active = rows.filter((r) => r.enrollment.status === "ACTIVE");
  const avg = active.length ? active.reduce((a, r) => a + r.sum.pct, 0) / active.length : 0;

  // Where the cohort is: each active student's first unfinished stage.
  const atStage = new Map<number, number>();
  for (const r of active) {
    const i = currentStageIndex(tree, r.sum);
    if (i >= 0) atStage.set(i, (atStage.get(i) ?? 0) + 1);
  }

  const notTeaching = staff.filter((s) => !instructors.some((i) => i.id === s.id));

  return (
    <>
      <PageHeader
        title={cohort.name}
        sub={<>{track.title} · started {fmtDate(cohort.startDate)}{cohort.archived ? " · archived" : ""}</>}
        back={{ href: "/cohorts", label: "Cohorts" }}
        actions={<>
          <Link href={`/cohorts/${cohort.id}/review`} className={pending ? "btn-primary" : "btn-ghost"}>Review{pending ? ` (${pending})` : ""}</Link>
          <Link href={`/cohorts/${cohort.id}/teach`} className="btn-ghost">Teaching plan</Link>
          <Link href={`/cohorts/${cohort.id}/attendance`} className="btn-ghost">Attendance</Link>
          <a href={`/cohorts/${cohort.id}/export`} className="btn-ghost">Export CSV</a>
        </>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Active students" value={active.length} sub={`${rows.length - active.length} paused, finished or withdrawn`} />
        <div className="card p-4">
          <div className="text-sm font-semibold text-ink-muted">Average progress</div>
          <div className="mt-1 font-bold text-2xl">{pct(avg)}</div>
          <div className="mt-2"><ProgressBar value={avg} expected={expected} /></div>
          <div className="mt-1 text-xs text-ink-muted">plan expects {pct(expected)} by today</div>
        </div>
        <Stat label="Need attention" value={active.filter((r) => r.risk).length} sub="inactive 14+ days or behind pace" />
        <Stat label="Waiting for review" value={pending} sub="projects, deliverables, milestones" />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Students</h2>
          <Link href={`/cohorts/${cohort.id}/import`} className="btn-ghost"><Icon name="addPerson" size={18} />Add students from a file</Link>
        </div>
        {rows.length === 0 ? (
          <Empty title="No students yet">Share the student invite link below, or add the whole class at once with <b>Add students from a file</b>.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border text-left text-sm font-semibold text-ink-muted">
                <tr><th className="p-3">Student</th><th className="p-3">Progress</th><th className="p-3">Stages</th><th className="p-3">Hours</th><th className="p-3">Attend.</th><th className="p-3">Last active</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.enrollment.id} className="hover:bg-surface-sunken">
                    <td className="p-3">
                      <Link href={`/cohorts/${cohort.id}/students/${r.enrollment.id}`} className="font-semibold text-primary hover:underline">{r.user.name ?? r.user.email}</Link>
                      <div className="text-xs text-ink-muted">{r.user.email}</div>
                    </td>
                    <td className="w-40 p-3"><ProgressBar value={r.sum.pct} expected={expected} /><div className="mt-1 text-xs text-ink-muted">{pct(r.sum.pct)} · {r.sum.verified} verified</div></td>
                    <td className="p-3">
                      <div className="flex items-start gap-0.5" aria-label={`${r.sum.stagesPassed} of ${tree.length} stages passed`}>
                        {r.sum.stages.map((s, i) => (
                          <StageCell key={s.stageId} p={s.pct} signed={s.signedOff} title={`${i + 1}. ${tree[i].title}: ${pct(s.pct)} ticked${s.signedOff === true ? " · signed off" : s.signedOff === false ? " · not passed" : ""}`} />
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-ink-muted">{r.sum.stagesPassed}/{tree.length} passed</div>
                    </td>
                    <td className="p-3">{r.hours}</td>
                    <td className="p-3">{r.attendance ? pct(r.attendance.present / r.attendance.total) : "—"}</td>
                    <td className="p-3 text-ink-muted">{daysAgo(r.last)}</td>
                    <td className="p-3">{r.enrollment.status === "ACTIVE" ? <RiskPill risk={r.risk} /> : <EnrollmentBadge status={r.enrollment.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-4 border-t border-border p-3 text-xs text-ink-muted">
              <span>Each stage is a small bar: the fuller it is, the more the student has ticked.</span>
              <span className="inline-flex items-center gap-1 text-success"><Icon name="check" size={14} /><span className="text-ink-muted">signed off</span></span>
              <span className="inline-flex items-center gap-1 text-danger"><Icon name="x" size={14} /><span className="text-ink-muted">not passed</span></span>
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="h2 mb-1">Progress by stage</h2>
        <div className="mb-3"><PlanLineNote who="the class" /></div>
        <ClassStageList tree={tree} stages={stages} expectedStages={expectedStages} coverage={coverage.stages} open={[...atStage.keys()].sort((a, b) => a - b)[0]} />
      </section>

      {atStage.size > 0 && (
        <section className="mb-8">
          <h2 className="h2 mb-3">Where the cohort is</h2>
          <div className="card space-y-2 p-4">
            {[...atStage.entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm sm:grid-cols-[260px_1fr_auto]">
                <span className="truncate">{i + 1}. {tree[i].title}</span>
                <span className="hidden sm:block"><ProgressBar value={n / active.length} tone="saffron" /></span>
                <span className="text-ink-muted">{n} student{n > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="h2 mb-3">Invite links</h2>
          <div className="card divide-y divide-border">
            {invites.length === 0 && <p className="p-4 text-sm text-ink-muted">No invite links yet.</p>}
            {invites.map((inv) => {
              const link = `${url}/join/${inv.code}`;
              const expired = (inv.expiresAt && inv.expiresAt < new Date()) || inv.uses >= inv.maxUses;
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <Tag>{sentence(inv.role)}</Tag>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
                  <span className={`text-xs ${expired ? "text-danger" : "text-ink-muted"}`}>{inv.uses}/{inv.maxUses} used · {expired ? "expired" : `until ${fmtDate(inv.expiresAt)}`}</span>
                  <CopyButton text={link} />
                  <form action={deleteInviteAction}><input type="hidden" name="inviteId" value={inv.id} /><button className="text-xs text-danger">Delete</button></form>
                </div>
              );
            })}
            <form action={createInviteAction} className="flex flex-wrap items-end gap-2 p-3">
              <input type="hidden" name="cohortId" value={cohort.id} />
              <div><label className="label" htmlFor="role">Role</label>
                <select id="role" name="role" className="input py-1.5">
                  <option value="STUDENT">Student</option>
                  {ctx.role === "ADMIN" && <option value="INSTRUCTOR">Instructor</option>}
                </select></div>
              <div><label className="label" htmlFor="maxUses">Max uses</label><input id="maxUses" name="maxUses" type="number" defaultValue={40} min={1} max={500} className="input w-24 py-1.5" /></div>
              <div><label className="label" htmlFor="days">Valid days</label><input id="days" name="days" type="number" defaultValue={30} min={1} max={365} className="input w-24 py-1.5" /></div>
              <button className="btn-primary">Create link</button>
            </form>
          </div>
        </div>
        <div>
          <h2 className="h2 mb-3">Instructors</h2>
          <div className="card divide-y divide-border">
            {instructors.length === 0 && <p className="p-4 text-sm text-ink-muted">No instructors assigned.</p>}
            {instructors.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 text-sm">
                <span>{i.name ?? i.email}<span className="ml-2 text-xs text-ink-muted">{i.email}</span></span>
                {ctx.role === "ADMIN" && (
                  <form action={setCohortInstructorAction}><input type="hidden" name="cohortId" value={cohort.id} /><input type="hidden" name="userId" value={i.id} /><input type="hidden" name="op" value="remove" /><button className="text-xs text-danger">Remove</button></form>
                )}
              </div>
            ))}
            {ctx.role === "ADMIN" && notTeaching.length > 0 && (
              <form action={setCohortInstructorAction} className="flex gap-2 p-3">
                <input type="hidden" name="cohortId" value={cohort.id} /><input type="hidden" name="op" value="add" />
                <select name="userId" className="input py-1.5" aria-label="Add instructor">
                  {notTeaching.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
                </select>
                <button className="btn-ghost">Add</button>
              </form>
            )}
          </div>
          {ctx.role === "ADMIN" && (
            <form action={archiveCohortAction} className="mt-4">
              <input type="hidden" name="cohortId" value={cohort.id} /><input type="hidden" name="archived" value={cohort.archived ? "0" : "1"} />
              <button className="btn-ghost text-xs">{cohort.archived ? "Restore cohort" : "Archive cohort"}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

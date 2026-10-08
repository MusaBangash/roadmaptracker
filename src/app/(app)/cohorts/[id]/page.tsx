import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { cohortRows, pendingReviewCount } from "@/lib/cohort-stats";
import { PageHeader, ProgressBar, Stat, RiskPill, Empty } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { createInviteAction, deleteInviteAction, setCohortInstructorAction, archiveCohortAction } from "@/app/actions/admin";
import { baseUrl } from "@/lib/url";
import { pct, fmtDate, daysAgo } from "@/lib/utils";

export const metadata = { title: "Cohort" };

function cellClass(p: number, signed: boolean | null) {
  if (signed === true) return "bg-forest";
  if (signed === false) return "bg-danger";
  if (p >= 1) return "bg-forest-2/70";
  if (p >= 0.5) return "bg-saffron";
  if (p > 0) return "bg-saffron/40";
  return "bg-surface-2";
}

export default async function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeachableCohort(id);
  const { cohort } = ctx;
  const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }))!;
  const { tree, rows, expected } = await cohortRows(cohort);
  const pending = (await pendingReviewCount([cohort.id])).get(cohort.id) ?? 0;
  const active = rows.filter((r) => r.enrollment.status === "ACTIVE");
  const avg = active.length ? active.reduce((a, r) => a + r.sum.pct, 0) / active.length : 0;

  // Where the cohort is: each active student's first unfinished stage.
  const atStage = new Map<number, number>();
  for (const r of active) {
    const i = r.sum.stages.findIndex((s, si) => !tree[si].optional && s.signedOff !== true && s.pct < 1);
    if (i >= 0) atStage.set(i, (atStage.get(i) ?? 0) + 1);
  }

  const invites = await db.query.invites.findMany({ where: eq(schema.invites.cohortId, cohort.id) });
  const url = await baseUrl();
  const instructors = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.cohortInstructors).innerJoin(schema.users, eq(schema.cohortInstructors.userId, schema.users.id))
    .where(eq(schema.cohortInstructors.cohortId, cohort.id));
  const staff = ctx.role === "ADMIN"
    ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.memberships).innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
        .where(and(eq(schema.memberships.orgId, ctx.org.id), inArray(schema.memberships.role, ["ADMIN", "INSTRUCTOR"])))
    : [];
  const notTeaching = staff.filter((s) => !instructors.some((i) => i.id === s.id));

  return (
    <>
      <PageHeader
        title={cohort.name}
        sub={<>{track.title} · started {fmtDate(cohort.startDate)}{cohort.archived ? " · archived" : ""}</>}
        back={{ href: "/cohorts", label: "Cohorts" }}
        actions={<>
          <Link href={`/cohorts/${cohort.id}/review`} className={pending ? "btn-primary" : "btn-ghost"}>Review{pending ? ` (${pending})` : ""}</Link>
          <Link href={`/cohorts/${cohort.id}/attendance`} className="btn-ghost">Attendance</Link>
          <a href={`/cohorts/${cohort.id}/export`} className="btn-ghost">Export CSV</a>
        </>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Active students" value={active.length} sub={`${rows.length - active.length} paused, finished or withdrawn`} />
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Average progress</div>
          <div className="mt-1 font-serif text-2xl">{pct(avg)}</div>
          <div className="mt-2"><ProgressBar value={avg} expected={expected} /></div>
          <div className="mt-1 text-xs text-muted">plan expects {pct(expected)} by today</div>
        </div>
        <Stat label="Need attention" value={active.filter((r) => r.risk).length} sub="inactive 14+ days or behind pace" />
        <Stat label="Waiting for review" value={pending} sub="projects, deliverables, milestones" />
      </div>

      <section className="mb-8">
        <h2 className="h2 mb-3">Students</h2>
        {rows.length === 0 ? (
          <Empty title="No students yet">Share the student invite link below. Students who open it join this cohort automatically.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="p-3">Student</th><th className="p-3">Progress</th><th className="p-3">Stages</th><th className="p-3">Hours</th><th className="p-3">Attend.</th><th className="p-3">Last active</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.enrollment.id} className="hover:bg-surface-2">
                    <td className="p-3">
                      <Link href={`/cohorts/${cohort.id}/students/${r.enrollment.id}`} className="font-semibold text-forest hover:underline">{r.user.name ?? r.user.email}</Link>
                      <div className="text-xs text-muted">{r.user.email}</div>
                    </td>
                    <td className="w-40 p-3"><ProgressBar value={r.sum.pct} expected={expected} /><div className="mt-1 text-xs text-muted">{pct(r.sum.pct)} · {r.sum.verified} verified</div></td>
                    <td className="p-3">
                      <div className="flex gap-0.5" aria-label={`${r.sum.stagesPassed} of ${tree.length} stages passed`}>
                        {r.sum.stages.map((s, i) => (
                          <span key={s.stageId} title={`${i + 1}. ${tree[i].title}: ${pct(s.pct)}${s.signedOff ? " · signed off" : ""}`} className={`h-4 w-2.5 rounded-sm ${cellClass(s.pct, s.signedOff)}`} />
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-muted">{r.sum.stagesPassed}/{tree.length} passed</div>
                    </td>
                    <td className="p-3">{r.hours}</td>
                    <td className="p-3">{r.attendance ? pct(r.attendance.present / r.attendance.total) : "—"}</td>
                    <td className="p-3 text-muted">{daysAgo(r.last)}</td>
                    <td className="p-3">{r.enrollment.status === "ACTIVE" ? <RiskPill risk={r.risk} /> : <span className="pill bg-surface-2 text-muted">{r.enrollment.status.toLowerCase()}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-4 border-t border-line p-3 text-xs text-muted">
              <span><span className="mr-1 inline-block h-3 w-2 rounded-sm bg-forest align-middle" />signed off</span>
              <span><span className="mr-1 inline-block h-3 w-2 rounded-sm bg-forest-2/70 align-middle" />all ticked</span>
              <span><span className="mr-1 inline-block h-3 w-2 rounded-sm bg-saffron align-middle" />half or more</span>
              <span><span className="mr-1 inline-block h-3 w-2 rounded-sm bg-saffron/40 align-middle" />started</span>
              <span><span className="mr-1 inline-block h-3 w-2 rounded-sm bg-danger align-middle" />not passed</span>
            </div>
          </div>
        )}
      </section>

      {atStage.size > 0 && (
        <section className="mb-8">
          <h2 className="h2 mb-3">Where the cohort is</h2>
          <div className="card space-y-2 p-4">
            {[...atStage.entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm sm:grid-cols-[260px_1fr_auto]">
                <span className="truncate">{i + 1}. {tree[i].title}</span>
                <span className="hidden sm:block"><ProgressBar value={n / active.length} tone="saffron" /></span>
                <span className="text-muted">{n} student{n > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="h2 mb-3">Invite links</h2>
          <div className="card divide-y divide-line">
            {invites.length === 0 && <p className="p-4 text-sm text-muted">No invite links yet.</p>}
            {invites.map((inv) => {
              const link = `${url}/join/${inv.code}`;
              const expired = (inv.expiresAt && inv.expiresAt < new Date()) || inv.uses >= inv.maxUses;
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="pill bg-surface-2 text-muted">{inv.role.toLowerCase()}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
                  <span className={`text-xs ${expired ? "text-danger" : "text-muted"}`}>{inv.uses}/{inv.maxUses} used · {expired ? "expired" : `until ${fmtDate(inv.expiresAt)}`}</span>
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
          <div className="card divide-y divide-line">
            {instructors.length === 0 && <p className="p-4 text-sm text-muted">No instructors assigned.</p>}
            {instructors.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 text-sm">
                <span>{i.name ?? i.email}<span className="ml-2 text-xs text-muted">{i.email}</span></span>
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

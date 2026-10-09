import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableEnrollment } from "@/lib/access";
import { loadTrackTree, loadProgress, summarize, expectedPct, expectedStagePcts, currentStageIndex } from "@/lib/progress";
import { GroupBar, KindBars, PlanLineNote, StageLine } from "@/components/progress";
import { reviewItemAction, signoffStageAction, setEnrollmentStatusAction } from "@/app/actions/teach";
import { PageHeader, ProgressBar, Stat, KindPill, StatusPill, Badge } from "@/components/ui";
import { AssessmentForm } from "@/components/assessment-form";
import { DEFAULT_RUBRIC } from "@/lib/rubric";
import { pct, fmtDate } from "@/lib/utils";
import { canJudgeWork } from "@/lib/security-core";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { readinessOf, validCertificate } from "@/lib/certificates";
import { IssueCertificateForm } from "@/components/certificate-tools";
import { byThread, loadComments, toViews, unreadFor } from "@/lib/comments";
import { CommentThread } from "@/components/comment-thread";
import { REVIEW_KINDS } from "@/lib/progress-core";

export const metadata = { title: "Student" };

export default async function StudentPage({ params }: { params: Promise<{ id: string; enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { cohort, enrollment, user, role } = await requireTeachableEnrollment(enrollmentId);
  // Story 4: nobody checks their own work (a teacher who is also enrolled in this cohort).
  const own = !canJudgeWork(user.id, enrollment.userId);
  const student = (await db.query.users.findFirst({ where: eq(schema.users.id, enrollment.userId) }))!;
  const track = (await db.query.tracks.findFirst({ where: eq(schema.tracks.id, cohort.trackId) }))!;
  const tree = await loadTrackTree(track.id);
  const { progress, signoffs } = await loadProgress([enrollment.id]);
  const sum = summarize(tree, progress, signoffs);
  const expectedStages = expectedStagePcts(tree, cohort.startDate);
  const here = currentStageIndex(tree, sum);
  const byItem = new Map(progress.map((p) => [p.itemId, p]));
  const signBy = new Map(signoffs.map((s) => [s.stageId, s]));
  const [assessments, logs] = await Promise.all([
    db.query.assessments.findMany({ where: eq(schema.assessments.enrollmentId, enrollment.id), orderBy: desc(schema.assessments.date) }),
    db.query.weeklyLogs.findMany({ where: eq(schema.weeklyLogs.enrollmentId, enrollment.id), orderBy: desc(schema.weeklyLogs.weekStart), limit: 8 }),
  ]);
  const rubric = track.rubric?.length ? track.rubric : DEFAULT_RUBRIC;
  const [cert, readiness, comments] = await Promise.all([validCertificate(enrollment.id), readinessOf(enrollment.id, cohort.trackId), loadComments([enrollment.id])]);
  const threads = byThread(comments);
  const viewer = { id: user.id, admin: role === "ADMIN" };

  return (
    <>
      <PageHeader
        title={student.name ?? student.email ?? "Student"}
        sub={<>{student.email} · {cohort.name}</>}
        back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }}
        actions={
          <form action={setEnrollmentStatusAction} className="flex gap-2">
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <select name="status" defaultValue={enrollment.status} className="input py-1.5" aria-label="Enrollment status">
              {["ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
            </select>
            <button className="btn-ghost">Update</button>
          </form>
        }
      />
      {own && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
          <Icon name="info" size={20} /><span><b>This is your own work.</b> Another teacher or an admin has to verify, sign off and assess it.</span>
        </p>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card p-4 sm:col-span-2">
          <div className="flex items-baseline justify-between"><span className="text-sm font-semibold text-ink-muted">Progress</span><span className="font-bold text-2xl">{pct(sum.pct)}</span></div>
          <div className="mt-3"><ProgressBar value={sum.pct} expected={expectedPct(tree, cohort.startDate)} label="Overall progress" /></div>
          <p className="mt-2 text-sm">{here >= 0 ? <>Now on <b>Stage {here + 1} · {tree[here].title}</b></> : "Every required stage is done and signed off."}</p>
          <div className="mt-1"><PlanLineNote who="this student" /></div>
        </div>
        <Stat label="Stages passed" value={`${sum.stagesPassed}/${tree.length}`} />
        <Stat label="Verified items" value={sum.verified} sub={`${sum.done} done in total`} />
      </div>

      <section className="card mb-8 p-4 sm:p-5" aria-labelledby="cert-h">
        <h2 id="cert-h" className="h2 mb-2">Certificate</h2>
        {cert ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success" icon="star">Issued {fmtDate(cert.issuedAt)} · {cert.code}</Badge>
            <Link href={`/certificates/${cert.code}`} className="btn-ghost">Open certificate</Link>
          </div>
        ) : readiness.ready ? (
          own ? <p className="text-sm text-ink-muted">Ready for a certificate. Another teacher or an admin has to issue it.</p> : (
            <>
              <p className="mb-3"><Badge tone="success" icon="check">Ready for a certificate</Badge> <span className="text-sm text-ink-muted">Every required stage is passed.</span></p>
              <IssueCertificateForm enrollmentId={enrollment.id} defaultName={student.name ?? ""} />
            </>
          )
        ) : (
          <div className="text-sm">
            <p className="mb-1"><Badge tone="neutral" icon="clock">Not ready yet</Badge> <span className="text-ink-muted">Still to pass ({readiness.missing.length}):</span></p>
            <ul className="mt-2 list-disc pl-5 text-ink-muted">
              {readiness.missing.slice(0, 6).map((m) => <li key={m}>{m}</li>)}
              {readiness.missing.length > 6 && <li>…and {readiness.missing.length - 6} more</li>}
            </ul>
          </div>
        )}
      </section>

      <h2 className="h2 mb-3">Stages and sign-off</h2>
      <div className="mb-8 space-y-3">
        {tree.map((stage, i) => {
          const s = sum.stages[i];
          const so = signBy.get(stage.id);
          return (
            <details key={stage.id} className="card">
              <summary className="flex cursor-pointer list-none p-4">
                <StageLine index={i} stage={stage} s={s} expected={expectedStages[i]} here={i === here} />
              </summary>
              <div className="border-t border-border p-4">
                {s.groups.length > 0 ? (
                  <div className="mb-4 grid gap-3 rounded-md bg-surface-sunken p-3 sm:grid-cols-2">
                    {s.groups.map((g, gi) => <GroupBar key={g.name} s={s} groupIndex={gi} stageExpected={expectedStages[i]} />)}
                  </div>
                ) : <KindBars s={s} />}
                <p className="mb-3 text-sm text-ink-muted">{s.verified} of {s.required} required items verified.</p>
                {stage.doneWhen && <p className="mb-3 text-sm"><b className="text-highlight-text">Done when:</b> {stage.doneWhen}</p>}
                {!own && <form action={signoffStageAction} className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-surface-sunken p-3">
                  <input type="hidden" name="enrollmentId" value={enrollment.id} /><input type="hidden" name="stageId" value={stage.id} />
                  <input name="notes" defaultValue={so?.notes ?? ""} placeholder="Sign-off notes (evidence seen, test passed…)" className="input min-w-0 flex-1" />
                  <button name="decision" value="PASS" className="btn-primary">Pass stage</button>
                  <button name="decision" value="FAIL" className="btn-danger">Not yet</button>
                  {so && <button name="decision" value="CLEAR" className="btn-ghost">Clear</button>}
                  {so && <span className="w-full text-xs text-ink-muted">Last decision {fmtDate(so.signedAt)}</span>}
                </form>}
                <ul className="divide-y divide-border">
                  {stage.items.map((it) => {
                    const p = byItem.get(it.id);
                    return (
                      <li key={it.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{it.title}</span> <KindPill kind={it.kind} /> <StatusPill status={p?.status} />
                          {p?.evidenceUrl && <a href={p.evidenceUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-secondary underline">evidence</a>}
                          {p?.note && <span className="block text-xs text-ink-muted">“{p.note}”</span>}
                          {p && (REVIEW_KINDS as readonly string[]).includes(it.kind) && (() => {
                            const rows = threads.get(`${enrollment.id}:${it.id}`) ?? [];
                            return <CommentThread enrollmentId={enrollment.id} itemId={it.id} comments={toViews(rows, viewer)} side={own ? "STUDENT" : "TEACHER"}
                              admin={viewer.admin} unread={own ? 0 : unreadFor(rows, "TEACHER", p.staffSeenAt)} canWrite />;
                          })()}
                        </span>
                        {p?.status !== "VERIFIED" && !own && (
                          <form action={reviewItemAction}>
                            <input type="hidden" name="enrollmentId" value={enrollment.id} /><input type="hidden" name="itemId" value={it.id} />
                            <button name="decision" value="VERIFIED" className="text-xs font-semibold text-primary">Verify</button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="h2 mb-3">Score an assessment</h2>
          {own ? <p className="text-sm text-ink-muted">Another teacher or an admin has to score your assessments.</p>
            : <AssessmentForm enrollmentId={enrollment.id} rubric={rubric} today={new Date().toISOString().slice(0, 10)} />}
          {assessments.length > 0 && (
            <div className="card mt-4 divide-y divide-border">
              {assessments.map((a) => (
                <div key={a.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{a.title}</span>
                    {a.passed ? <Badge tone="success" icon="online">Passed · {a.average?.toFixed(2)}</Badge> : <Badge tone="danger" icon="x">Not passed · {a.average?.toFixed(2)}</Badge>}
                  </div>
                  <div className="text-xs text-ink-muted">{fmtDate(a.date)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">{Object.entries(a.scores).map(([k, v]) => <span key={k}>{k}: {v.join(" / ")}</span>)}</div>
                  {a.notes && <p className="mt-1 text-xs">{a.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="h2 mb-3">Recent weekly logs</h2>
          <div className="card divide-y divide-border">
            {logs.length === 0 && <p className="p-4 text-sm text-ink-muted">No weeks logged yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="p-3 text-sm">
                <div className="flex justify-between"><span className="font-semibold">Week of {fmtDate(l.weekStart)}</span><span className="text-ink-muted">{l.hours} h</span></div>
                {l.finished && <p className="mt-1">{l.finished}</p>}
                {l.stuck && <p className="mt-1 text-ink-muted">Stuck: {l.stuck}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireTeachableCohort } from "@/lib/access";
import { REVIEW_KINDS } from "@/lib/progress";
import { reviewItemAction } from "@/app/actions/teach";
import { PageHeader, Empty, KindPill, Badge, StatusPill } from "@/components/ui";
import { byThread, loadComments, toViews, unreadFor, waitingSql } from "@/lib/comments";
import { CommentThread } from "@/components/comment-thread";
import { Icon } from "@/components/icon";
import { daysAgo, plural } from "@/lib/utils";

export const metadata = { title: "Review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cohort, user, role } = await requireTeachableCohort(id);
  const rows = await db
    .select({ p: schema.itemProgress, i: schema.items, s: schema.stages, u: { id: schema.users.id, name: schema.users.name, email: schema.users.email } })
    .from(schema.itemProgress)
    .innerJoin(schema.items, eq(schema.itemProgress.itemId, schema.items.id))
    .innerJoin(schema.stages, eq(schema.items.stageId, schema.stages.id))
    .innerJoin(schema.enrollments, eq(schema.itemProgress.enrollmentId, schema.enrollments.id))
    .innerJoin(schema.users, eq(schema.enrollments.userId, schema.users.id))
    .where(and(eq(schema.enrollments.cohortId, cohort.id), inArray(schema.items.kind, [...REVIEW_KINDS]), waitingSql))
    .orderBy(asc(schema.itemProgress.updatedAt));
  // Comments (feature 3): each card's thread; the student's words since a teacher last opened it count as new.
  const threads = byThread(await loadComments([...new Set(rows.map((r) => r.p.enrollmentId))]));
  const viewer = { id: user.id, admin: role === "ADMIN" };
  const cards = rows.map((r) => {
    const all = threads.get(`${r.p.enrollmentId}:${r.p.itemId}`) ?? [];
    const last = all.filter((c) => !c.hiddenAt).at(-1);
    return { ...r, comments: toViews(all, viewer), unread: unreadFor(all, "TEACHER", r.p.staffSeenAt), replied: last?.authorRole === "STUDENT" && last.kind === "COMMENT" };
  });
  const newReplies = cards.reduce((a, c) => a + c.unread, 0);

  return (
    <>
      <PageHeader title="Review queue" sub={<>{cohort.name} · {rows.length} waiting · oldest first{newReplies > 0 && <> · <b className="text-info">{plural(newReplies, "new reply", "new replies")}</b></>}</>} back={{ href: `/cohorts/${cohort.id}`, label: cohort.name }} />
      {rows.length === 0 ? <Empty title="Nothing to review">When students mark projects, deliverables or milestones as done, or reply to a comment, they appear here.</Empty> : (
        <div className="space-y-3">
          {cards.map(({ p, i, s, u, comments, unread, replied }) => (
            <div key={p.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{i.title}</span><KindPill kind={i.kind} />
                    {p.status !== "DONE" && <StatusPill status={p.status} />}
                    {replied && <Badge tone="info" icon="comment">Student replied</Badge>}</div>
                  <div className="text-sm text-ink-muted">{s.title}{i.group ? ` · ${i.group}` : ""}</div>
                  {i.detail && <div className="mt-1 text-sm text-ink-muted">{i.detail}</div>}
                </div>
                <div className="text-right text-sm">
                  <Link href={`/cohorts/${cohort.id}/students/${p.enrollmentId}`} className="font-semibold text-primary hover:underline">{u.name ?? u.email}</Link>
                  <div className="text-xs text-ink-muted">submitted {daysAgo(p.updatedAt)}</div>
                </div>
              </div>
              <div className="mt-3 rounded-md bg-surface-sunken p-3 text-sm">
                {p.evidenceUrl ? <a href={p.evidenceUrl} target="_blank" rel="noreferrer" className="break-all text-secondary underline">{p.evidenceUrl}</a> : <span className="text-ink-muted">No link attached.</span>}
                {p.note && <p className="mt-1">{p.note}</p>}
              </div>
              <CommentThread enrollmentId={p.enrollmentId} itemId={p.itemId} comments={comments} side={u.id === user.id ? "STUDENT" : "TEACHER"}
                admin={viewer.admin} unread={unread} canWrite startOpen={replied} />
              {u.id === user.id ? <p className="mt-3 text-sm text-ink-muted">This is your own work. Another teacher or an admin has to check it.</p> : (
              <form action={reviewItemAction} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="enrollmentId" value={p.enrollmentId} />
                <input type="hidden" name="itemId" value={p.itemId} />
                <input name="reviewNote" placeholder="Feedback for the student (needed if sending back)" className="input min-w-0 flex-1" />
                {p.status !== "VERIFIED" && <button name="decision" value="VERIFIED" className="btn-primary"><Icon name="check" size={18} />Verify</button>}
                <button name="decision" value="NEEDS_WORK" className="btn-danger">Needs work</button>
              </form>)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

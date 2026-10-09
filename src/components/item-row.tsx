"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { toggleItemAction, saveEvidenceAction } from "@/app/actions/learn";
import { Badge, KindPill, StatusPill, Tag } from "@/components/ui";
import { CommentThread } from "@/components/comment-thread";
import type { CommentView } from "@/lib/comments";

type Props = {
  /** null = "Preview as student": ticks stay on this screen only and nothing is saved. */
  enrollmentId: string | null;
  item: { id: string; title: string; detail: string; kind: string; optional: boolean };
  progress: { status: string; evidenceUrl: string | null; note: string | null; reviewNote: string | null; byTeacher?: boolean } | null;
  /** The date the teacher taught this lesson to the cohort, ready to show (e.g. "14 Oct 2026"). */
  taughtOn?: string | null;
  /** Comments on this work (projects, deliverables, milestones), with how many the student hasn't read. */
  thread?: { comments: CommentView[]; unread: number } | null;
};

export function ItemRow({ enrollmentId, item, progress, taughtOn, thread }: Props) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useOptimistic(!!progress && progress.status !== "NEEDS_WORK");
  const [previewDone, setPreviewDone] = useState(false);
  const preview = enrollmentId === null;
  const done = preview ? previewDone : saved;
  const reviewable = item.kind !== "LESSON";
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState(saveEvidenceAction, undefined);
  const locked = progress?.status === "VERIFIED";

  return (
    <li id={`item-${item.id}`} className={`scroll-mt-20 border-b border-border py-3 last:border-0 ${reviewable ? "-mx-3 rounded-md bg-warning-soft/40 px-3" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          checked={done}
          disabled={locked || pending}
          aria-label={`Mark "${item.title}" as done`}
          onChange={(e) => {
            const next = e.target.checked;
            if (preview) return setPreviewDone(next);
            start(async () => {
              setSaved(next);
              await toggleItemAction(enrollmentId, item.id, next);
            });
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{item.title}</span>
            <KindPill kind={item.kind} />
            {item.optional && <Tag>Optional</Tag>}
            <StatusPill status={progress?.status} />
            {taughtOn && (done
              ? <Badge tone="info" icon="info" wrap>Taught in class · {taughtOn}</Badge>
              : <Badge tone="warning" icon="offline" wrap>Taught in class · {taughtOn} — not done yet</Badge>)}
            {progress?.byTeacher && done && <Tag>Marked by teacher</Tag>}
          </div>
          {item.detail && <p className="mt-0.5 text-sm text-ink-muted">{item.detail}</p>}
          {progress?.status === "NEEDS_WORK" && progress.reviewNote && (
            <p dir="auto" className="mt-2 whitespace-pre-wrap rounded-md bg-danger-soft px-2 py-1 text-sm text-danger">Teacher: {progress.reviewNote}</p>
          )}
          {progress?.evidenceUrl && (
            <a href={progress.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-secondary underline">
              {progress.evidenceUrl}
            </a>
          )}
          {preview ? (reviewable && <p className="mt-1 text-xs text-ink-muted">Students add a link to their work here for review.</p>) : (<>
          <button type="button" onClick={() => setOpen(!open)} className="mt-1 block text-xs font-semibold text-primary">
            {open ? "Close" : reviewable ? (progress?.evidenceUrl ? "Edit evidence" : "Add evidence for review") : "Add a note or link"}
          </button>
          {open && (
            <form action={action} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="enrollmentId" value={enrollmentId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input name="evidenceUrl" defaultValue={progress?.evidenceUrl ?? ""} placeholder="GitHub or document link (https://…)" className="input" />
              <input name="note" defaultValue={progress?.note ?? ""} placeholder="Short note (optional)" className="input" />
              <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              {state?.error && <p className="text-sm text-danger sm:col-span-3">{state.error}</p>}
              {state?.ok && <p className="text-sm text-primary sm:col-span-3">{state.ok}</p>}
            </form>
          )}
          {reviewable && enrollmentId && (
            <CommentThread enrollmentId={enrollmentId} itemId={item.id} comments={thread?.comments ?? []} side="STUDENT" admin={false}
              unread={thread?.unread ?? 0} canWrite={!!progress} />
          )}
          </>)}
        </div>
      </div>
    </li>
  );
}

"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { toggleItemAction, saveEvidenceAction } from "@/app/actions/learn";
import { KindPill, StatusPill, Tag } from "@/components/ui";

type Props = {
  enrollmentId: string;
  item: { id: string; title: string; detail: string; kind: string; optional: boolean };
  progress: { status: string; evidenceUrl: string | null; note: string | null; reviewNote: string | null } | null;
};

export function ItemRow({ enrollmentId, item, progress }: Props) {
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(!!progress && progress.status !== "NEEDS_WORK");
  const reviewable = item.kind !== "LESSON";
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState(saveEvidenceAction, undefined);
  const locked = progress?.status === "VERIFIED";

  return (
    <li className={`border-b border-border py-3 last:border-0 ${reviewable ? "-mx-3 rounded-md bg-warning-soft/40 px-3" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          checked={done}
          disabled={locked || pending}
          aria-label={`Mark "${item.title}" as done`}
          onChange={(e) => {
            const next = e.target.checked;
            start(async () => {
              setDone(next);
              await toggleItemAction(enrollmentId, item.id, next);
            });
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${done ? "text-ink" : "text-ink"}`}>{item.title}</span>
            <KindPill kind={item.kind} />
            {item.optional && <Tag>Optional</Tag>}
            <StatusPill status={progress?.status} />
          </div>
          {item.detail && <p className="mt-0.5 text-sm text-ink-muted">{item.detail}</p>}
          {progress?.status === "NEEDS_WORK" && progress.reviewNote && (
            <p className="mt-2 rounded-md bg-danger-soft px-2 py-1 text-sm text-danger">Instructor: {progress.reviewNote}</p>
          )}
          {progress?.evidenceUrl && (
            <a href={progress.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-secondary underline">
              {progress.evidenceUrl}
            </a>
          )}
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
        </div>
      </div>
    </li>
  );
}

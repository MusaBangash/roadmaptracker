"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addFromSchoolAction } from "@/app/actions/import";
import { FormError, Tag } from "@/components/ui";
import { keepFields } from "@/components/keep-fields";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { CopyButton } from "@/components/copy-button";

const boxes = (form: HTMLFormElement | null) => [...(form?.querySelectorAll<HTMLInputElement>('input[name="userId"]') ?? [])];

export type AddRow = { userId: string; name: string; email: string | null; ticked: boolean; tag: string | null; note: string | null; classes: string[] };

/** The tick list on "Add students from the school": Tick all, a count, Add selected, then a WhatsApp message. */
export function AddFromSchool({ cohortId, rows, more }: { cohortId: string; rows: AddRow[]; more: number }) {
  const [state, action, pending] = useActionState(addFromSchoolAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  const [ticked, setTicked] = useState(rows.filter((r) => r.ticked).length);
  const count = () => setTicked(boxes(form.current).filter((b) => b.checked).length);

  useEffect(() => {
    // After adding: clear the ticks (the added students leave the list when the page refreshes).
    if (state?.ok) for (const b of boxes(form.current)) b.checked = false;
    setTicked(boxes(form.current).filter((b) => b.checked).length);
  }, [state, rows]);

  const tickAll = (on: boolean) => {
    for (const b of boxes(form.current)) b.checked = on;
    count();
  };

  return (
    <>
      {state?.ok && (
        <div role="status" className="card mb-4 grid gap-2 border-success p-4">
          <p className="text-sm font-semibold text-success">{state.ok}</p>
          {state.message && (
            <>
              <p className="text-sm text-ink-muted">Let them know in the class group:</p>
              <p className="rounded-md bg-surface-sunken p-3 text-sm" dir="auto">{state.message}</p>
              <div className="flex flex-wrap gap-2">
                <WhatsAppButton text={state.message} label="Send on WhatsApp" />
                <CopyButton text={state.message} label="Copy message" />
              </div>
            </>
          )}
        </div>
      )}
      <form ref={form} onSubmit={keepFields(action)} onChange={count} className="card">
        <input type="hidden" name="cohortId" value={cohortId} />
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Nobody to add here. Everyone shown is already in this class, or no student matches what you chose above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.userId}>
                <label className="flex cursor-pointer items-start gap-3 p-3 text-sm hover:bg-surface-sunken">
                  <input type="checkbox" name="userId" value={r.userId} defaultChecked={r.ticked} aria-label={`Tick ${r.name}`} className="mt-0.5 size-5 shrink-0 accent-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold" dir="auto">{r.name}</span>
                    {r.tag && <> <Tag>{r.tag}</Tag></>}
                    {r.email && <span className="block truncate text-xs text-ink-muted">{r.email}</span>}
                    {r.classes.length > 0 && <span className="block text-xs text-ink-muted">In: {r.classes.join(", ")}</span>}
                    {r.note && <span className="block text-xs text-highlight-text">{r.note}. Adding them makes them active again; their old work is kept.</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {more > 0 && <p className="border-t border-border p-3 text-xs text-ink-muted">{more} more not shown. Search or choose a class to find them.</p>}
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
          <label className="me-2 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rows.length > 0 && ticked === rows.length} onChange={(e) => tickAll(e.target.checked)} disabled={!rows.length} className="size-5 accent-primary" />
            Tick all
          </label>
          <span className="me-2 text-sm text-ink-muted">{ticked} ticked</span>
          <button className="btn-primary" disabled={pending || ticked === 0}>{pending ? "Adding…" : ticked > 1 ? `Add ${ticked} students` : "Add selected"}</button>
        </div>
        <div className="px-3 pb-3"><FormError message={state?.error} /></div>
      </form>
    </>
  );
}

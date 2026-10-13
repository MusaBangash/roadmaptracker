"use client";

import { useActionState, useEffect, useState } from "react";
import { classListAction } from "@/app/actions/teach";
import { FormError } from "@/components/ui";

export type ClassListButton = { op: "accept" | "accept-all" | "decline" | "withdraw"; label: string; primary?: boolean; danger?: boolean; confirm?: string };

const DONE_EVENT = "class-list-done";

const boxes = (formId: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="enrollmentId"][form="${formId}"]`)];

/** A tick box for one student; it belongs to the ClassListBar form with the same id, wherever it sits on the page. */
export function PickBox({ formId, id, name }: { formId: string; id: string; name: string }) {
  return <input type="checkbox" name="enrollmentId" value={id} form={formId} aria-label={`Tick ${name}`} className="size-5 shrink-0 accent-primary" />;
}

/** The buttons under a list of students: "Tick all", how many are ticked, and the actions. */
export function ClassListBar({ formId, cohortId, buttons }: { formId: string; cohortId: string; buttons: ClassListButton[] }) {
  // The list can empty and vanish after the action (everyone accepted), so the "done" message is shown
  // by ClassListNotice, which is always on the page.
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof classListAction>>, form: FormData) => {
    const result = await classListAction(prev, form);
    if (result?.ok) window.dispatchEvent(new CustomEvent(DONE_EVENT, { detail: result.ok }));
    return result;
  }, undefined);
  const [ticked, setTicked] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (state?.ok) for (const b of boxes(formId)) b.checked = false;
    const count = () => {
      const all = boxes(formId);
      setTicked(all.filter((b) => b.checked).length);
      setTotal(all.length);
    };
    count();
    document.addEventListener("change", count);
    return () => document.removeEventListener("change", count);
  }, [formId, state]);

  const tickAll = (on: boolean) => {
    for (const b of boxes(formId)) b.checked = on;
    setTicked(on ? total : 0);
  };

  return (
    <form id={formId} action={action} className="grid gap-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="me-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={total > 0 && ticked === total} onChange={(e) => tickAll(e.target.checked)} className="size-5 accent-primary" />
          Tick all
        </label>
        <span className="me-2 text-sm text-ink-muted">{ticked} ticked</span>
        {buttons.map((b) => (
          <button
            key={b.op}
            name="op"
            value={b.op}
            disabled={pending || (b.op !== "accept-all" && ticked === 0)}
            onClick={(e) => { if (b.confirm && !window.confirm(b.confirm)) e.preventDefault(); }}
            className={b.primary ? "btn-primary" : b.danger ? "btn-danger" : "btn-ghost"}
          >
            {b.label}
          </button>
        ))}
      </div>
      <FormError message={state?.error} />
    </form>
  );
}

/** "Accepted: 2 students." after any ClassListBar action on the page. */
export function ClassListNotice() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const show = (e: Event) => setMessage((e as CustomEvent<string>).detail);
    window.addEventListener(DONE_EVENT, show);
    return () => window.removeEventListener(DONE_EVENT, show);
  }, []);
  if (!message) return null;
  return <p role="status" className="mb-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">{message}</p>;
}

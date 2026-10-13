"use client";

import { useActionState, useEffect, useState } from "react";
import { classListAction, setEnrollmentStatusAction } from "@/app/actions/teach";
import { FormError } from "@/components/ui";
import { keepFields } from "@/components/keep-fields";
import { CHOOSABLE_REASONS, LEAVE_NOTE_MAX, LEAVE_REASONS } from "@/lib/cohort-core";

export type ClassListButton = { op: "accept" | "accept-all" | "decline" | "withdraw"; label: string; primary?: boolean; danger?: boolean; confirm?: string };

const DONE_EVENT = "class-list-done";

const boxes = (formId: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="enrollmentId"][form="${formId}"]`)];

/** A tick box for one student; it belongs to the ClassListBar form with the same id, wherever it sits on the page. */
export function PickBox({ formId, id, name }: { formId: string; id: string; name: string }) {
  return <input type="checkbox" name="enrollmentId" value={id} form={formId} aria-label={`Tick ${name}`} className="size-5 shrink-0 accent-primary" />;
}

/** The buttons under a list of students: "Tick all", how many are ticked, and the actions. */
export function ClassListBar({ formId, cohortId, buttons, today }: { formId: string; cohortId: string; buttons: ClassListButton[]; today?: string }) {
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
    <form id={formId} onSubmit={keepFields(action)} className="grid gap-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      {today && ticked > 0 && <LeaveFields idPrefix={formId} today={today} />}
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

/** Why and when a student left: asked whenever someone is marked Withdrawn. */
export function LeaveFields({ idPrefix, today, reason, leftOn, note }: { idPrefix: string; today: string; reason?: string | null; leftOn?: string | null; note?: string | null }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
      <div>
        <label className="label" htmlFor={`${idPrefix}-reason`}>Why they left</label>
        <select id={`${idPrefix}-reason`} name="reason" required defaultValue={reason && (CHOOSABLE_REASONS as readonly string[]).includes(reason) ? reason : ""} className="input py-1.5">
          <option value="" disabled>Choose…</option>
          {CHOOSABLE_REASONS.map((r) => <option key={r} value={r}>{LEAVE_REASONS[r]}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-leftOn`}>Date they left</label>
        <input id={`${idPrefix}-leftOn`} name="leftOn" type="date" required max={today} defaultValue={leftOn ?? today} className="input py-1.5" />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-note`}>Note <span className="font-normal text-ink-muted">(needed for Other)</span></label>
        <input id={`${idPrefix}-note`} name="note" maxLength={LEAVE_NOTE_MAX} defaultValue={note ?? ""} dir="auto" className="input py-1.5" />
      </div>
    </div>
  );
}

const STATUS_WORDS = { ACTIVE: "Active", PAUSED: "Paused", COMPLETED: "Completed", WITHDRAWN: "Withdrawn" } as const;

/** A student's status on their page; choosing Withdrawn asks why and when they left. */
export function EnrollmentStatusForm({ enrollmentId, status, today, reason, leftOn, note }: {
  enrollmentId: string; status: keyof typeof STATUS_WORDS; today: string; reason: string | null; leftOn: string | null; note: string | null;
}) {
  const [state, action, pending] = useActionState(setEnrollmentStatusAction, undefined);
  const [chosen, setChosen] = useState<string>(status);
  return (
    <form onSubmit={keepFields(action)} className="grid gap-2">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" value={chosen} onChange={(e) => setChosen(e.target.value)} className="input py-1.5">
            {Object.entries(STATUS_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
          </select>
        </div>
        <button className="btn-ghost" disabled={pending}>{pending ? "Saving…" : "Update"}</button>
      </div>
      {chosen === "WITHDRAWN" && <LeaveFields idPrefix="status" today={today} reason={reason} leftOn={leftOn} note={note} />}
      <FormError message={state?.error} />
      {state?.ok && <p role="status" className="text-sm text-success">{state.ok}</p>}
    </form>
  );
}

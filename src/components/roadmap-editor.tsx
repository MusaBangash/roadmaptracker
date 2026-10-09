"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createRoadmapAction, editRoadmapAction, importRoadmapAction, publishRoadmapAction, type ImportState,
} from "@/app/actions/roadmap";
import type { FormState } from "@/app/actions/auth";
import { Icon, type IconName } from "@/components/icon";
import { FormError } from "@/components/ui";

// The Roadmap Builder's controls. The fields themselves are rendered by the page; these wrap them
// in a form that sends one change to the draft and says whether it worked.

type Target = { trackId: string; stageKey?: string; itemKey?: string };

function Hidden({ op, trackId, stageKey, itemKey, dir }: Target & { op: string; dir?: "up" | "down" }) {
  return (<>
    <input type="hidden" name="op" value={op} />
    <input type="hidden" name="trackId" value={trackId} />
    {stageKey && <input type="hidden" name="stageKey" value={stageKey} />}
    {itemKey && <input type="hidden" name="itemKey" value={itemKey} />}
    {dir && <input type="hidden" name="dir" value={dir} />}
  </>);
}

function Result({ state }: { state: FormState }) {
  if (state?.error) return <FormError message={state.error} />;
  if (state?.ok) return <p role="status" className="inline-flex items-center gap-1 text-sm text-success"><Icon name="check" size={16} />{state.ok}</p>;
  return null;
}

export function SaveButton({ label = "Save", busy = "Saving…", icon = "check", tone = "btn-primary" }: { label?: string; busy?: string; icon?: IconName; tone?: string }) {
  const { pending } = useFormStatus();
  return <button className={tone} disabled={pending}><Icon name={icon} size={18} />{pending ? busy : label}</button>;
}

/** A form that saves one change to the draft (details, add or edit a stage or item). */
export function EditForm({ op, children, className = "grid gap-3", ...target }: Target & { op: string; children: React.ReactNode; className?: string }) {
  const [state, action] = useActionState(editRoadmapAction, undefined);
  return (
    <form action={action} className={className}>
      <Hidden op={op} {...target} />
      {children}
      <div aria-live="polite"><Result state={state} /></div>
    </form>
  );
}

/** One-click steps: move up or down, remove. Asks first when `confirm` is given. */
export function StepButton({ op, dir, icon, label, confirm, ...target }: Target & { op: string; dir?: "up" | "down"; icon: IconName; label: string; confirm?: string }) {
  const [state, action, pending] = useActionState(editRoadmapAction, undefined);
  return (
    <form action={action} className="contents">
      <Hidden op={op} dir={dir} {...target} />
      <button className={`btn-ghost px-3 text-sm ${op.startsWith("remove") ? "text-danger" : ""}`} disabled={pending}
        onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
        <Icon name={icon} size={16} />{label}
      </button>
      {state?.error && <span role="alert" className="w-full text-sm text-danger">{state.error}</span>}
    </form>
  );
}

/** Asks before a button that loses work (discard changes, delete a draft roadmap). */
export function ConfirmButton({ message, className, children }: { message: string; className: string; children: React.ReactNode }) {
  return <button className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</button>;
}

export function NewRoadmapForm({ fields }: { fields: React.ReactNode }) {
  const [state, action] = useActionState(createRoadmapAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      {fields}
      <FormError message={state?.error} />
      <div><SaveButton label="Create draft" busy="Creating…" icon="plus" /></div>
    </form>
  );
}

/** Story 5: upload a roadmap file, as a new roadmap or as the new draft of `trackId`. */
export function ImportForm({ trackId }: { trackId?: string }) {
  const [state, action] = useActionState<ImportState, FormData>(importRoadmapAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      {trackId && <input type="hidden" name="trackId" value={trackId} />}
      <div>
        <label className="label" htmlFor={`file-${trackId ?? "new"}`}>Roadmap file (.json)</label>
        <input id={`file-${trackId ?? "new"}`} name="file" type="file" accept=".json,application/json" required className="input py-2" />
      </div>
      {state?.errors && (
        <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          <p className="font-semibold">Nothing was saved. Fix {state.errors.length === 1 ? "this" : "these"} in the file and upload it again:</p>
          <ul className="mt-1 list-disc pl-5">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div><SaveButton label={trackId ? "Upload as the new draft" : "Upload as a new draft"} busy="Checking the file…" icon="upload" tone={trackId ? "btn-ghost" : "btn-primary"} /></div>
    </form>
  );
}

export function PublishForm({ trackId, label, disabled }: { trackId: string; label: string; disabled?: boolean }) {
  const [state, action] = useActionState(publishRoadmapAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="trackId" value={trackId} />
      <div>{disabled
        ? <button className="btn-primary" disabled><Icon name="upload" size={18} />{label}</button>
        : <SaveButton label={label} busy="Publishing…" icon="upload" />}</div>
      <div aria-live="polite"><Result state={state} /></div>
    </form>
  );
}

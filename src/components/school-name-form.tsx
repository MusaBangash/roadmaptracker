"use client";

import { useActionState } from "react";
import { renameSchoolAction } from "@/app/actions/admin";

/** The school's name with a Save button (People page; per school on the Schools page with orgId). */
export function SchoolNameForm({ name, orgId, compact = false }: { name: string; orgId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(renameSchoolAction, undefined);
  const id = `school-name-${orgId ?? "mine"}`;
  return (
    <form action={action} className={compact ? "grid gap-1" : "card grid gap-2 p-4"}>
      {orgId && <input type="hidden" name="orgId" value={orgId} />}
      <label className={compact ? "sr-only" : "label"} htmlFor={id}>School name</label>
      <div className="flex flex-wrap gap-2">
        <input id={id} name="name" required minLength={2} maxLength={120} defaultValue={name} dir="auto" className="input min-w-0 flex-1 py-1.5" />
        <button className="btn-ghost py-1.5" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-xs text-success">{state.ok}</p>}
      {!compact && <p className="text-xs text-ink-muted">Shown everywhere in the app and on new certificates. Certificates already issued keep the name printed on them.</p>}
    </form>
  );
}

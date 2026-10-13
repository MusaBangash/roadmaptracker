"use client";

import { useActionState } from "react";
import { addGroupAction, renameGroupAction, setResidenceAction } from "@/app/actions/school";
import { keepFields } from "@/components/keep-fields";
import { GROUP_NAME_MAX, RESIDENCE_WORDS } from "@/lib/group-core";

function Message({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p role="alert" className="text-xs text-danger">{state.error}</p>;
  if (state?.ok) return <p role="status" className="text-xs text-success">{state.ok}</p>;
  return null;
}

/** "Add a group" on School settings. */
export function AddGroupForm() {
  const [state, action, pending] = useActionState(addGroupAction, undefined);
  return (
    <form onSubmit={keepFields(action)} className="grid gap-1">
      <label className="label" htmlFor="new-group">Add a group</label>
      <div className="flex flex-wrap gap-2">
        <input id="new-group" name="name" required minLength={2} maxLength={GROUP_NAME_MAX} placeholder="e.g. Morning Boys" dir="auto" className="input min-w-0 flex-1 py-1.5" />
        <button className="btn-primary py-1.5" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      </div>
      <Message state={state} />
    </form>
  );
}

/** A group's name with Save (rename). */
export function GroupNameForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, action, pending] = useActionState(renameGroupAction, undefined);
  return (
    <form onSubmit={keepFields(action)} className="grid min-w-0 flex-1 basis-full gap-1 sm:basis-0">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex gap-2">
        <input name="name" required minLength={2} maxLength={GROUP_NAME_MAX} defaultValue={name} aria-label={`Name of ${name}`} dir="auto" className="input min-w-0 flex-1 py-1.5" />
        <button className="btn-ghost py-1.5" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
      <Message state={state} />
    </form>
  );
}

/** Hostel / Day scholar on a student's page. */
export function ResidenceForm({ enrollmentId, residence }: { enrollmentId: string; residence: "HOSTEL" | "DAY" | null }) {
  const [state, action, pending] = useActionState(setResidenceAction, undefined);
  return (
    <form onSubmit={keepFields(action)} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div>
        <label className="label" htmlFor="residence">Hostel or day scholar</label>
        <select id="residence" name="residence" defaultValue={residence ?? ""} className="input py-1.5">
          <option value="">Not set</option>
          <option value="HOSTEL">{RESIDENCE_WORDS.HOSTEL}</option>
          <option value="DAY">{RESIDENCE_WORDS.DAY}</option>
        </select>
      </div>
      <button className="btn-ghost py-1.5" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      <Message state={state} />
    </form>
  );
}

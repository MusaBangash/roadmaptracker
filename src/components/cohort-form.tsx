"use client";

import { useActionState } from "react";
import { createCohortAction } from "@/app/actions/admin";
import { FormError } from "@/components/ui";

export function CohortForm({ tracks, staff, today }: {
  tracks: { id: string; title: string; edition: string }[];
  staff: { id: string; name: string | null; email: string | null }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createCohortAction, undefined);
  return (
    <form action={action} className="card grid max-w-2xl gap-4 p-6">
      <div><label className="label" htmlFor="name">Cohort name</label><input id="name" name="name" required className="input" placeholder="AI Engineer — October 2026" /></div>
      <div>
        <label className="label" htmlFor="trackId">Track</label>
        <select id="trackId" name="trackId" required className="input" defaultValue="">
          <option value="" disabled>Choose a track…</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}{t.edition ? ` (${t.edition.replace(/\s+-\s+/g, " · ")})` : ""}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" required defaultValue={today} className="input" /></div>
      {staff.length > 0 && (
        <fieldset>
          <legend className="label">Instructors</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="instructorIds" value={s.id} className="h-4 w-4 accent-primary" />
                {s.name ?? s.email}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <FormError message={state?.error} />
      <div><button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create cohort"}</button></div>
    </form>
  );
}

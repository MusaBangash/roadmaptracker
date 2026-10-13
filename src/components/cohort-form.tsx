"use client";

import { useActionState } from "react";
import { createCohortAction, updateCohortAction } from "@/app/actions/admin";
import { FormError } from "@/components/ui";
import { keepFields } from "@/components/keep-fields";

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

/** Fix a cohort's name and start date; its roadmap only while nobody has joined. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EditCohortForm({ cohort, tracks, trackLocked }: {
  cohort: { id: string; name: string; startDate: string; trackId: string; classDays: number[] | null };
  tracks: { id: string; title: string; edition: string }[];
  trackLocked: boolean;
}) {
  const [state, action, pending] = useActionState(updateCohortAction, undefined);
  const current = tracks.find((t) => t.id === cohort.trackId);
  return (
    <form onSubmit={keepFields(action)} className="card grid max-w-2xl gap-4 p-6">
      <input type="hidden" name="cohortId" value={cohort.id} />
      <div><label className="label" htmlFor="name">Cohort name</label><input id="name" name="name" required defaultValue={cohort.name} className="input" /></div>
      <div>
        <label className="label" htmlFor="startDate">Start date</label>
        <input id="startDate" name="startDate" type="date" required defaultValue={cohort.startDate} className="input" />
        <p className="mt-1 text-xs text-ink-muted">The plan, the &ldquo;behind&rdquo; warnings and the teaching plan follow this date.</p>
      </div>
      <div>
        <label className="label" htmlFor="trackId">Track</label>
        {trackLocked ? (
          <>
            <p className="input bg-surface-sunken">{current?.title ?? "This cohort's roadmap"}</p>
            <p className="mt-1 text-xs text-ink-muted">Students have joined, so the roadmap can&apos;t change: their ticks belong to its lessons.</p>
          </>
        ) : (
          <>
            <select id="trackId" name="trackId" required className="input" defaultValue={cohort.trackId}>
              {!current && <option value={cohort.trackId}>This cohort&apos;s roadmap</option>}
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}{t.edition ? ` (${t.edition.replace(/\s+-\s+/g, " · ")})` : ""}</option>)}
            </select>
            <p className="mt-1 text-xs text-ink-muted">You can change the roadmap until the first student joins.</p>
          </>
        )}
      </div>
      <fieldset>
        <legend className="label">Class days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm has-checked:border-primary has-checked:bg-primary-soft">
              <input type="checkbox" name="classDays" value={i} defaultChecked={cohort.classDays?.includes(i)} className="size-4 accent-primary" />{d}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-muted">The days this class meets. On these days the dashboard reminds teachers when attendance isn&apos;t taken.</p>
      </fieldset>
      <FormError message={state?.error} />
      {state?.ok && <p role="status" className="text-sm text-ink-muted">{state.ok}</p>}
      <div><button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button></div>
    </form>
  );
}

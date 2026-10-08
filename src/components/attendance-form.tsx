"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveAttendanceAction } from "@/app/actions/teach";

export function AttendanceForm({ cohortId, date, students }: {
  cohortId: string; date: string; students: { enrollmentId: string; name: string; present: boolean | null }[];
}) {
  const [state, action, pending] = useActionState(saveAttendanceAction, undefined);
  const router = useRouter();
  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="date">Session date</label>
          <input id="date" name="date" type="date" defaultValue={date} className="input"
            onChange={(e) => router.push(`?date=${e.target.value}`)} /></div>
        <button type="button" className="btn-ghost" onClick={(e) => {
          e.currentTarget.form?.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((c) => (c.checked = true));
        }}>Mark all present</button>
      </div>
      <ul className="divide-y divide-line">
        {students.map((s) => (
          <li key={s.enrollmentId}>
            <label className="flex items-center gap-3 py-2 text-sm">
              <input type="checkbox" name={`p_${s.enrollmentId}`} defaultChecked={s.present ?? false} className="h-5 w-5 accent-[var(--forest)]" />
              {s.name}
              {s.present === null && <span className="text-xs text-muted">not recorded</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save attendance"}</button>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
        {state?.ok && <span className="text-sm text-forest">{state.ok}</span>}
      </div>
    </form>
  );
}

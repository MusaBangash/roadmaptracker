"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAttendanceAction } from "@/app/actions/teach";
import { FormError } from "@/components/ui";
import { keepFields } from "@/components/keep-fields";
import { ATTENDANCE_STATUSES, ATTENDANCE_WORDS, MARK_OF, type AttendanceStatus } from "@/lib/attendance-core";

type Student = { enrollmentId: string; name: string; paused: boolean; status: AttendanceStatus | null };

/** Selected look of each choice: colour, plus the word/letter, so it never depends on colour alone. */
const ON: Record<AttendanceStatus, string> = {
  PRESENT: "border-success bg-success-soft text-success",
  ABSENT: "border-danger bg-danger-soft text-danger",
  LATE: "border-warning bg-warning-soft text-warning",
  LEAVE: "border-border-strong bg-surface-sunken text-ink",
};

/**
 * Taking attendance on a phone: everyone starts as Present (paused students as Leave) when nothing is
 * saved for the day yet, so the teacher only taps the few who are absent, late or on leave.
 */
export function AttendanceForm({ cohortId, date, today, students }: { cohortId: string; date: string; today: string; students: Student[] }) {
  const [state, action, pending] = useActionState(saveAttendanceAction, undefined);
  const router = useRouter();
  const start = (s: Student): AttendanceStatus => s.status ?? (s.paused ? "LEAVE" : "PRESENT");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => Object.fromEntries(students.map((s) => [s.enrollmentId, start(s)])));
  const count = (st: AttendanceStatus) => Object.values(marks).filter((m) => m === st).length;
  const unsaved = students.every((s) => s.status === null);

  return (
    <form onSubmit={keepFields(action)} className="card p-4">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="date">Day</label>
          <input id="date" name="date" type="date" defaultValue={date} max={today} className="input"
            onChange={(e) => e.target.value && router.push(`?date=${e.target.value}`)} />
        </div>
        <button type="button" className="btn-ghost" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.enrollmentId, "PRESENT"])))}>
          Everyone present
        </button>
      </div>
      {unsaved && (
        <p role="status" className="mb-3 rounded-md bg-info-soft px-3 py-2 text-sm text-info">
          Not saved yet for this day. Everyone starts as Present: tap the few who are absent, late or on leave, then press Save.
        </p>
      )}
      <p className="mb-1 text-xs text-ink-muted sm:hidden">P present · A absent · L late · Lv leave</p>
      <ul className="divide-y divide-border">
        {students.map((s) => (
          <li key={s.enrollmentId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 text-sm font-semibold" dir="auto">
              {s.name}{s.paused && <span className="ms-2 text-xs font-normal text-ink-muted">paused</span>}
            </span>
            <fieldset className="flex gap-1">
              <legend className="sr-only">{s.name}</legend>
              {ATTENDANCE_STATUSES.map((st) => (
                <label key={st} title={ATTENDANCE_WORDS[st]}
                  className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-2 text-sm font-semibold has-focus-visible:outline-2 ${marks[s.enrollmentId] === st ? ON[st] : "border-border text-ink-muted hover:bg-surface-sunken"}`}>
                  <input type="radio" name={`s_${s.enrollmentId}`} value={st} checked={marks[s.enrollmentId] === st}
                    onChange={() => setMarks((m) => ({ ...m, [s.enrollmentId]: st }))} className="sr-only" />
                  <span aria-hidden className="sm:hidden">{MARK_OF[st]}</span>
                  <span className="max-sm:sr-only">{ATTENDANCE_WORDS[st]}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm" aria-live="polite">
        <b>Present {count("PRESENT") + count("LATE")}</b> · Absent {count("ABSENT")} · Late {count("LATE")} · Leave {count("LEAVE")}
        <span className="text-ink-muted"> (late counts as present)</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save attendance"}</button>
        {state?.ok && <span role="status" className="text-sm text-success">{state.ok}</span>}
      </div>
      <div className="mt-2"><FormError message={state?.error} /></div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { saveAssessmentAction } from "@/app/actions/teach";

export function AssessmentForm({ enrollmentId, rubric, today }: {
  enrollmentId: string; rubric: { criterion: string; levels: string[] }[]; today: string;
}) {
  const [state, action, pending] = useActionState(saveAssessmentAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-4">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div><label className="label" htmlFor="title">Assessment</label>
          <input id="title" name="title" list="assessment-titles" required className="input" placeholder="Oral Defense 1" />
          <datalist id="assessment-titles">
            {["Oral Defense 1", "Oral Defense 2", "Oral Defense 3", "Oral Defense 4", "Oral Defense 5", "Practical Assessment 1", "Practical Assessment 2", "Capstone", "Final exam"].map((t) => <option key={t} value={t} />)}
          </datalist></div>
        <div><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={today} required className="input" /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="py-2 pr-2">Criterion</th><th className="py-2 pr-2">Examiner 1</th><th className="py-2 pr-2">Examiner 2 (optional)</th><th className="py-2">Level guide</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rubric.map((r, i) => (
              <tr key={r.criterion}>
                <td className="py-2 pr-2 font-semibold">{r.criterion}</td>
                {(["a", "b"] as const).map((x) => (
                  <td key={x} className="py-2 pr-2">
                    <select name={`c${i}_${x}`} className="input w-20 py-1" defaultValue="" required={x === "a"} aria-label={`${r.criterion} examiner ${x === "a" ? 1 : 2}`}>
                      <option value="">–</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                ))}
                <td className="py-2 text-xs text-muted">{r.levels.map((l, li) => <span key={li} className="mr-2 whitespace-nowrap">{li + 1}: {l}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={2} className="input" placeholder="What was strong, what to fix before the re-defense…" /></div>
      <p className="text-xs text-muted">Pass rule: average 3.0 or higher, and no criterion below 2.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save scores"}</button>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
        {state?.ok && <span className="text-sm text-forest">{state.ok}</span>}
      </div>
    </form>
  );
}

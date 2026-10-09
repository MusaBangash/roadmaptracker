"use client";

import { useActionState } from "react";
import { saveWeeklyLogAction } from "@/app/actions/learn";
import { useT } from "@/i18n/client";

export function WeeklyLogForm({ enrollmentId, weekStart, initial }: {
  enrollmentId: string; weekStart: string; initial?: { hours: number; finished: string; stuck: string };
}) {
  const t = useT();
  const [state, action, pending] = useActionState(saveWeeklyLogAction, undefined);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div><label className="label" htmlFor="weekStart">{t("log.weekStart")}</label><input id="weekStart" name="weekStart" type="date" defaultValue={weekStart} required className="input" /></div>
      <div><label className="label" htmlFor="hours">{t("log.hours")}</label><input id="hours" name="hours" type="number" step="0.5" min="0" max="100" defaultValue={initial?.hours ?? ""} required className="input" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="finished">{t("log.finished")}</label><textarea id="finished" name="finished" dir="auto" rows={3} defaultValue={initial?.finished ?? ""} className="input" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="stuck">{t("log.stuckNext")}</label><textarea id="stuck" name="stuck" dir="auto" rows={2} defaultValue={initial?.stuck ?? ""} className="input" /></div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? t("common.saving") : t("log.save")}</button>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
        {state?.ok && <span className="text-sm text-primary">{state.ok}</span>}
      </div>
    </form>
  );
}

"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { markTaughtAction, unmarkTaughtAction, type TeachResult } from "@/app/actions/teach";
import { Icon } from "@/components/icon";

// The Teaching plan's controls: one date and one "mark done for present students" choice at
// the top, used by every "Mark taught" button below it.

type Ctx = { cohortId: string; date: string; markPresent: boolean; busy: boolean; run: (fn: () => Promise<TeachResult>) => void };
const TeachContext = createContext<Ctx | null>(null);

export function TeachProvider({ cohortId, today, children }: { cohortId: string; today: string; children: React.ReactNode }) {
  const [date, setDate] = useState(today);
  const [markPresent, setMarkPresent] = useState(false);
  const [result, setResult] = useState<TeachResult | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<TeachResult>) => start(async () => setResult(await fn()));

  return (
    <TeachContext.Provider value={{ cohortId, date, markPresent, busy, run }}>
      <div className="card sticky top-[70px] z-10 mb-4 flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label" htmlFor="taught-date">Date taught</label>
          <input id="taught-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className="flex min-h-[var(--control-height)] items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={markPresent} onChange={(e) => setMarkPresent(e.target.checked)} />
          Also mark the lessons done for students who were present that day
        </label>
        <div className="min-h-6 w-full text-sm" role="status" aria-live="polite">
          {busy && <span className="text-ink-muted">Saving…</span>}
          {!busy && result?.ok && <span className="inline-flex items-center gap-1 text-success"><Icon name="check" size={16} />{result.ok}</span>}
          {!busy && result?.error && <span className="inline-flex items-center gap-1 text-danger"><Icon name="error" size={16} />{result.error}</span>}
        </div>
      </div>
      {children}
    </TeachContext.Provider>
  );
}

/** "Mark taught" for one lesson, a week or a stage; with undo=true, "Mark not taught". */
export function MarkTaughtButton({ itemIds, label, undo = false, small = false }: { itemIds: string[]; label: string; undo?: boolean; small?: boolean }) {
  const ctx = useContext(TeachContext);
  if (!ctx || !itemIds.length) return null;
  const { cohortId, date, markPresent, busy, run } = ctx;
  const onClick = () => run(() => (undo ? unmarkTaughtAction({ cohortId, itemIds }) : markTaughtAction({ cohortId, itemIds, date, markPresent })));
  const cls = undo ? "btn-ghost" : small ? "btn-ghost" : "btn-primary";
  return (
    <button type="button" className={`${cls} ${small ? "px-3 py-1 text-xs" : ""}`} disabled={busy} onClick={onClick}>
      <Icon name={undo ? "restore" : "check"} size={small ? 14 : 18} />
      {label}
    </button>
  );
}

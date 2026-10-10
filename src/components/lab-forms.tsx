"use client";

import { useActionState, useMemo, useState } from "react";
import { createLabAction, fixProblemAction, reportProblemAction, saveInspectionAction, updateLabAction } from "@/app/actions/lab";
import { FormError } from "@/components/ui";
import { Icon } from "@/components/icon";
import { DEFAULT_PC_ITEMS, DEFAULT_ROOM_ITEMS, FAULT_STATUSES, ROOM, STATUS_LABELS, cellKey, stations, type FaultStatus } from "@/lib/lab-core";

type LabShape = { id: string; name: string; pcCount: number; pcItems: string[]; roomItems: string[]; archived: boolean };
type Staff = { id: string; name: string | null; email: string | null; role: string };

/** Story 1: add or change a lab (admins). */
export function LabForm({ lab, staff, teacherIds }: { lab?: LabShape; staff: Staff[]; teacherIds?: string[] }) {
  const [state, action, pending] = useActionState(lab ? updateLabAction : createLabAction, undefined);
  return (
    <form action={action} className="card grid max-w-2xl gap-4 p-4 sm:p-5">
      {lab && <input type="hidden" name="labId" value={lab.id} />}
      <div>
        <label className="label" htmlFor="lab-name">Lab name</label>
        <input id="lab-name" name="name" required maxLength={60} defaultValue={lab?.name} placeholder="e.g. AI Lab 03" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="lab-pcs">Number of PCs</label>
        <input id="lab-pcs" name="pcCount" type="number" min={0} max={100} required defaultValue={lab?.pcCount ?? 12} className="input max-w-32" />
        <p className="mt-1 text-xs text-ink-muted">They are named PC 1, PC 2 … (like the numbers on the desks).</p>
      </div>
      <div>
        <label className="label" htmlFor="lab-pc-items">Checked on each PC</label>
        <textarea id="lab-pc-items" name="pcItems" rows={2} className="input" defaultValue={(lab?.pcItems ?? DEFAULT_PC_ITEMS).join(", ")} />
        <p className="mt-1 text-xs text-ink-muted">Separate with commas, e.g. Screen, System (CPU), Keyboard, Mouse, Cables, Headphones.</p>
      </div>
      <div>
        <label className="label" htmlFor="lab-room-items">Room equipment</label>
        <textarea id="lab-room-items" name="roomItems" rows={2} className="input" defaultValue={(lab?.roomItems ?? DEFAULT_ROOM_ITEMS).join(", ")} />
        <p className="mt-1 text-xs text-ink-muted">e.g. Projector, Projector screen, AC, Whiteboard, UPS. Leave empty if none.</p>
      </div>
      <fieldset>
        <legend className="label">Teachers who look after this lab</legend>
        {staff.length === 0 ? <p className="text-sm text-ink-muted">No teachers in the school yet.</p> : (
          <div className="grid gap-1 sm:grid-cols-2">
            {staff.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="teacher" value={s.id} defaultChecked={teacherIds?.includes(s.id)} className="h-4 w-4 accent-primary" />
                <span className="truncate">{s.name ?? s.email}</span>{s.role === "ADMIN" && <span className="text-xs text-ink-muted">admin</span>}
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-ink-muted">Admins can always see and check every lab.</p>
      </fieldset>
      {lab && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" defaultChecked={lab.archived} className="h-4 w-4 accent-primary" />
          Archived (no longer in use; its reports are kept)
        </label>
      )}
      <FormError message={state?.error} />
      {state?.ok && <p role="status" className="text-sm text-success">{state.ok}</p>}
      <div><button className="btn-primary" disabled={pending}><Icon name="check" size={18} />{pending ? "Saving…" : lab ? "Save" : "Add lab"}</button></div>
    </form>
  );
}

type Cell = { status: FaultStatus | "OK"; note: string };
type OpenFault = { station: string; item: string; status: FaultStatus; note: string | null };

/** Story 2: the monthly inspection. Everything starts OK, except what is already known to be broken. */
export function InspectionForm({ lab, open, today }: { lab: LabShape; open: OpenFault[]; today: string }) {
  const [state, action, pending] = useActionState(saveInspectionAction, undefined);
  const start = useMemo(() => new Map(open.map((f) => [cellKey(f.station, f.item), { status: f.status, note: f.note ?? "" } as Cell])), [open]);
  const [cells, setCells] = useState(start);
  const get = (s: string, i: string): Cell => cells.get(cellKey(s, i)) ?? { status: "OK", note: "" };
  const set = (s: string, i: string, c: Cell) => setCells((m) => new Map(m).set(cellKey(s, i), c));
  const groups = [
    ...stations(lab.pcCount).map((s) => ({ station: s, items: lab.pcItems })),
    ...(lab.roomItems.length ? [{ station: ROOM, items: lab.roomItems }] : []),
  ];
  const problems = [...cells].filter(([, c]) => c.status !== "OK");
  const nowFixed = open.filter((f) => get(f.station, f.item).status === "OK");
  const brokenPcs = new Set(problems.map(([k]) => k.split("|")[0]).filter((s) => s !== ROOM)).size;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="labId" value={lab.id} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="inspected-on">Day of the inspection</label>
          <input id="inspected-on" name="inspectedOn" type="date" required max={today} defaultValue={today} className="input" />
        </div>
        <p className="text-sm text-ink-muted">Everything starts as <b>OK</b>. Change only what is wrong. Problems already open are filled in.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const bad = g.items.some((i) => get(g.station, i).status !== "OK");
          return (
            <fieldset key={g.station} className={`card p-3 ${bad ? "border-danger" : ""}`}>
              <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
                {g.station === ROOM ? "Room equipment" : g.station}
                {bad ? <span className="flex items-center gap-1 text-danger"><Icon name="error" size={14} />problem</span>
                  : <span className="flex items-center gap-1 text-success"><Icon name="check" size={14} />OK</span>}
              </legend>
              <div className="grid gap-2">
                {g.items.map((item) => {
                  const c = get(g.station, item);
                  const k = cellKey(g.station, item);
                  return (
                    <div key={item} className="grid gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`c-${k}`} className="text-sm">{item}</label>
                        <select id={`c-${k}`} name={`c|${k}`} value={c.status} onChange={(e) => set(g.station, item, { ...c, status: e.target.value as Cell["status"] })}
                          className={`rounded-md border px-2 py-1 text-sm font-semibold ${c.status === "OK" ? "border-border bg-surface text-ink" : "border-danger bg-danger-soft text-danger"}`}>
                          <option value="OK">OK</option>
                          {FAULT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      </div>
                      {c.status !== "OK" && (
                        <input name={`n|${k}`} value={c.note} maxLength={200} placeholder="What is wrong? (optional)" aria-label={`${g.station} ${item}: note`}
                          onChange={(e) => set(g.station, item, { ...c, note: e.target.value })} className="input py-1 text-sm" />
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div>
        <label className="label" htmlFor="ins-note">Remarks (optional)</label>
        <textarea id="ins-note" name="note" rows={2} maxLength={200} className="input" placeholder="e.g. AC serviced, cables tied" />
      </div>

      <div className="card grid gap-2 p-4 text-sm" role="status">
        <p><b>{lab.pcCount - brokenPcs} of {lab.pcCount}</b> PCs fully working · <b>{problems.length}</b> {problems.length === 1 ? "problem" : "problems"}</p>
        {nowFixed.length > 0 && (
          <div className="rounded-md bg-success-soft p-3 text-success">
            <p className="font-semibold">{nowFixed.length === 1 ? "This open problem is" : "These open problems are"} now OK and will be marked fixed:</p>
            <ul className="list-disc ps-5">{nowFixed.map((f) => <li key={cellKey(f.station, f.item)}>{f.station} · {f.item} (was {STATUS_LABELS[f.status].toLowerCase()})</li>)}</ul>
          </div>
        )}
        <FormError message={state?.error} />
        <div><button className="btn-primary" disabled={pending}><Icon name="check" size={18} />{pending ? "Saving…" : "Save inspection"}</button></div>
      </div>
    </form>
  );
}

/** Story 4: report a problem on any day. */
export function ReportProblemForm({ lab }: { lab: LabShape }) {
  const [state, action, pending] = useActionState(reportProblemAction, undefined);
  const options = [...stations(lab.pcCount), ...(lab.roomItems.length ? [ROOM] : [])];
  const [station, setStation] = useState(options[0] ?? "");
  const items = station === ROOM ? lab.roomItems : lab.pcItems;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="labId" value={lab.id} />
      <div>
        <label className="label" htmlFor="rp-station">Where</label>
        <select id="rp-station" name="station" className="input" value={station} onChange={(e) => setStation(e.target.value)}>
          {options.map((s) => <option key={s} value={s}>{s === ROOM ? "Room equipment" : s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="rp-item">What</label>
        <select id="rp-item" name="item" className="input" key={station}>
          {items.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">Problem</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {FAULT_STATUSES.map((s, i) => (
            <label key={s} className="flex items-center gap-2"><input type="radio" name="status" value={s} defaultChecked={i === 1} className="accent-primary" />{STATUS_LABELS[s]}</label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="rp-note">Note (optional)</label>
        <input id="rp-note" name="note" maxLength={200} className="input" placeholder="e.g. right button broken" />
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}><Icon name="plus" size={18} />{pending ? "Saving…" : "Report problem"}</button>
        <FormError message={state?.error} />
        {state?.ok && <span role="status" className="text-sm text-success">{state.ok}</span>}
      </div>
    </form>
  );
}

/** Story 5: mark one problem fixed. */
export function FixProblemForm({ faultId }: { faultId: string }) {
  const [state, action, pending] = useActionState(fixProblemAction, undefined);
  if (state?.ok) return <span role="status" className="text-sm text-success">{state.ok}</span>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="faultId" value={faultId} />
      <input name="fixNote" maxLength={200} placeholder="How it was fixed (optional)" aria-label="How it was fixed" className="input min-w-0 flex-1 py-1 text-sm" />
      <button className="btn-ghost py-1 text-sm" disabled={pending}><Icon name="check" size={16} />{pending ? "Saving…" : "Mark fixed"}</button>
      <FormError message={state?.error} />
    </form>
  );
}

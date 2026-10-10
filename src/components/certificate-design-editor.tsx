"use client";

import { useActionState, useEffect, useState } from "react";
import { saveLayoutAction, uploadDesignAction } from "@/app/actions/certificate-design";
import { DesignedCertificate, type DesignValues } from "@/components/designed-certificate";
import { FormError } from "@/components/ui";
import { Icon } from "@/components/icon";
import {
  DATE_FORMATS, DEFAULT_LAYOUT, FIELD_LABELS, TEXT_FIELDS, formatCertDate,
  type CertLayout, type FieldKey, type TextField,
} from "@/lib/certificate-design-core";

const SAMPLE: Omit<DesignValues, "name" | "date"> = {
  regNo: "B5-AI-011", course: "Artificial Intelligence", duration: "12 Weeks", session: "Jun 2026 – Aug 2026", level: "Foundation",
};

/** Story 1: upload (or replace) the school's empty certificate picture. */
export function DesignUploadForm({ replacing }: { replacing: boolean }) {
  const [state, action, pending] = useActionState(uploadDesignAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="design-file">{replacing ? "New picture" : "Certificate picture"}</label>
        <input id="design-file" name="file" type="file" required accept="image/png,image/jpeg" className="input" />
        <p className="mt-1 text-xs text-ink-muted">PNG (best) or JPG, A4 lying down, at least 2000 pixels wide (3508 × 2480 is best), under 8 MB. The spaces for the name, Reg No, date and course must be <b>empty</b>.</p>
      </div>
      <FormError message={state?.error} />
      {state?.ok && <p role="status" className="text-sm text-success">{state.ok}</p>}
      <div><button className="btn-primary" disabled={pending}><Icon name="upload" size={18} />{pending ? "Uploading…" : replacing ? "Replace picture" : "Upload"}</button></div>
    </form>
  );
}

/** Story 2: drag each value to its place, set its look, preview, save. */
export function DesignEditor({ designId, imageUrl, aspect, initial, qr }: {
  designId: string; imageUrl: string; aspect: number; initial: CertLayout; qr: string;
}) {
  const [layout, setLayout] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [selected, setSelected] = useState<FieldKey | null>("name");
  const [sampleName, setSampleName] = useState("Hafiza Maryam Munir");
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof saveLayoutAction>[0], form: FormData) => {
    const r = await saveLayoutAction(prev, form);
    if (r?.ok) setSaved(String(form.get("layout")));
    return r;
  }, undefined);
  const json = JSON.stringify(layout);
  const dirty = json !== saved;

  // Don't lose an unsaved layout by closing the tab.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setField = (k: FieldKey, patch: Record<string, unknown>) =>
    setLayout((l) => ({ ...l, fields: { ...l.fields, [k]: { ...l.fields[k], ...patch } } }));
  const round = (v: number) => Math.round(v * 10000) / 10000;

  // Arrow keys move the chosen value a little (Shift = more): for exact placing and for keyboards.
  function onKey(e: React.KeyboardEvent) {
    if (!selected || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.01 : 0.001;
    const f = layout.fields[selected];
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    setField(selected, { x: round(Math.min(1, Math.max(0, f.x + dx))), y: round(Math.min(1, Math.max(0, f.y + dy))) });
  }

  const values: DesignValues = { ...SAMPLE, name: sampleName, date: formatCertDate(new Date().toISOString().slice(0, 10), layout.dateFormat) };
  const sel = selected ? layout.fields[selected] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]" onKeyDown={onKey}>
      <div>
        <div className="mb-2 flex flex-wrap gap-1.5" role="toolbar" aria-label="Values on the certificate">
          {(["name", ...TEXT_FIELDS.filter((k) => k !== "name"), "qr"] as FieldKey[]).map((k) => (
            <button key={k} type="button" onClick={() => setSelected(k)} aria-pressed={selected === k}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${selected === k ? "border-primary bg-primary text-on-primary" : "border-border-strong text-ink-muted hover:text-ink"} ${layout.fields[k].hidden ? "line-through opacity-70" : ""}`}>
              {FIELD_LABELS[k]}
            </button>
          ))}
        </div>
        <div tabIndex={0} className="rounded-md border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <DesignedCertificate imageUrl={imageUrl} aspect={aspect} layout={layout} values={values} qr={qr} code="7K3MQ-9TXWA"
            editing={{ selected, onSelect: setSelected, onMove: (k, x, y) => setField(k, { x: round(x), y: round(y) }) }} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">Drag a value to move it. Arrow keys move the chosen one a little (hold Shift for more). The example text is not saved. Easiest on a computer.</p>
      </div>

      <div className="grid content-start gap-4">
        {sel && selected && (
          <fieldset className="card grid gap-3 p-4">
            <legend className="px-1 text-sm font-semibold">{FIELD_LABELS[selected]}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!sel.hidden} onChange={(e) => setField(selected, { hidden: !e.target.checked })} />
              Show on the certificate
            </label>
            {selected === "qr" ? (
              <Range label="Size" value={sel.w * 100} min={4} max={30} step={0.5} unit="%" onChange={(v) => setField("qr", { w: round(v / 100) })} />
            ) : (
              <TextSettings f={sel as TextField} onChange={(p) => setField(selected, p)} />
            )}
            {selected === "name" && (
              <div>
                <label className="label" htmlFor="sample-name">Try a name</label>
                <input id="sample-name" className="input" value={sampleName} onChange={(e) => setSampleName(e.target.value)} dir="auto" />
                <p className="mt-1 text-xs text-ink-muted">Try the longest name in your class: it gets smaller to fit the box.</p>
              </div>
            )}
            {selected === "date" && (
              <div>
                <label className="label" htmlFor="date-format">Date looks like</label>
                <select id="date-format" className="input" value={layout.dateFormat}
                  onChange={(e) => setLayout((l) => ({ ...l, dateFormat: e.target.value as CertLayout["dateFormat"] }))}>
                  {DATE_FORMATS.map((f) => <option key={f} value={f}>{formatCertDate("2026-09-01", f)}</option>)}
                </select>
              </div>
            )}
          </fieldset>
        )}

        <form action={action} className="card grid gap-3 p-4">
          <input type="hidden" name="designId" value={designId} />
          <input type="hidden" name="layout" value={json} />
          <FormError message={state?.error} />
          {state?.ok && !dirty && <p role="status" className="text-sm text-success">{state.ok}</p>}
          {dirty && <p className="text-sm text-warning">Changes not saved yet.</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={pending || !dirty}><Icon name="check" size={18} />{pending ? "Saving…" : "Save places"}</button>
            <a href="/admin/certificate-design/preview" className="btn-ghost" target="_blank" rel="noopener"><Icon name="print" size={18} />Test print</a>
          </div>
          <button type="button" className="text-start text-xs text-secondary underline"
            onClick={() => { if (window.confirm("Put every value back in its starting place?")) setLayout(DEFAULT_LAYOUT); }}>
            Put everything back to the starting places
          </button>
          <p className="text-xs text-ink-muted">Test print uses the <b>saved</b> places: save first. Certificates already issued never change.</p>
        </form>
      </div>
    </div>
  );
}

function TextSettings({ f, onChange }: { f: TextField; onChange: (p: Partial<TextField>) => void }) {
  return (
    <>
      <Range label="Text size" value={f.size} min={0.5} max={8} step={0.05} onChange={(v) => onChange({ size: Math.round(v * 100) / 100 })} />
      <Range label="Box width (longer text gets smaller)" value={f.w * 100} min={3} max={100} step={0.5} unit="%" onChange={(v) => onChange({ w: Math.round(v * 100) / 10000 })} />
      <div className="flex items-center gap-3">
        <label className="label mb-0" htmlFor="field-color">Colour</label>
        <input id="field-color" type="color" value={f.color} onChange={(e) => onChange({ color: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-border bg-surface" />
        <button type="button" className="text-xs text-secondary underline" onClick={() => onChange({ color: "#25255e" })}>Dark blue</button>
        <button type="button" className="text-xs text-secondary underline" onClick={() => onChange({ color: "#1c1c1c" })}>Black</button>
      </div>
      <Choice label="Line up" value={f.align} options={[["left", "Left"], ["center", "Centre"], ["right", "Right"]]} onChange={(v) => onChange({ align: v })} />
      <Choice label="Letters" value={f.font} options={[["sans", "Plain"], ["serif", "Classic"]]} onChange={(v) => onChange({ font: v })} />
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.bold} onChange={(e) => onChange({ bold: e.target.checked })} />Bold</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.upper} onChange={(e) => onChange({ upper: e.target.checked })} />CAPITALS</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.underline} onChange={(e) => onChange({ underline: e.target.checked })} />Underline</label>
      </div>
    </>
  );
}

function Range({ label, value, min, max, step, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex justify-between"><span>{label}</span><span className="text-ink-muted">{value.toFixed(1)}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Choice<V extends string>({ label, value, options, onChange }: {
  label: string; value: V; options: [V, string][]; onChange: (v: V) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 text-sm">
      <span>{label}</span>
      <div className="flex gap-1">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`flex-1 rounded-md border px-2 py-1 text-xs font-semibold ${value === v ? "border-primary bg-primary-soft text-ink" : "border-border text-ink-muted"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

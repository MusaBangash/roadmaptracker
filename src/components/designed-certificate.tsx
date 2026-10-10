"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { boxOf, FIELD_LABELS, showsOn, type CertLayout, type Copy, type FieldKey, type TextField, type TextFieldKey } from "@/lib/certificate-design-core";

export type DesignValues = Record<TextFieldKey, string>;
/** Something on the design that can be chosen and dragged: a value, the QR code, or a school text ("t:<id>"). */
export type ElementKey = FieldKey | `t:${string}`;

const FONTS = {
  sans: "var(--font-sans, 'Public Sans'), Arial, sans-serif",
  // Many school certificates are made in Arial (CorelDraw / Word default); on every Windows PC.
  arial: "Arial, 'Helvetica Neue', Helvetica, 'Liberation Sans', sans-serif",
  // The school's design, not the app: certificates often print the name in a classic serif.
  serif: "'Times New Roman', Times, Georgia, serif",
};
const urdu = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);

/**
 * A certificate printed on the school's own design (Story 4). Every position and size is a share of
 * the picture's width (container units), so it is the same on a phone, a laptop and A4 paper.
 * `copy`: the printed copy (signed by hand) or the online one; the school's texts say which they are on.
 * `editing` turns on the editor's outlines and dragging (Story 2).
 */
export function DesignedCertificate({ imageUrl, aspect, layout, values, qr, code, copy, editing }: {
  imageUrl: string; aspect: number; layout: CertLayout; values: DesignValues;
  qr: string; code: string; copy: Copy;
  editing?: { selected: ElementKey | null; onSelect: (k: ElementKey) => void; onMove: (k: ElementKey, x: number, y: number) => void };
}) {
  const box = useRef<HTMLDivElement>(null);
  const posOf = (k: ElementKey) => k.startsWith("t:") ? layout.texts.find((x) => `t:${x.id}` === k)! : layout.fields[k as FieldKey];

  // Drag: the pointer's movement as a share of the picture, applied to the element's x/y.
  function startDrag(k: ElementKey, e: ReactPointerEvent) {
    if (!editing || !box.current) return;
    e.preventDefault();
    editing.onSelect(k);
    const rect = box.current.getBoundingClientRect();
    const f = posOf(k);
    const start = { px: e.clientX, py: e.clientY, x: f.x, y: f.y };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      editing.onMove(k, clamp(start.x + (ev.clientX - start.px) / rect.width), clamp(start.y + (ev.clientY - start.py) / rect.height));
    };
    const up = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", up); };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  const outline = (k: ElementKey) => editing
    ? `cursor-move touch-none outline-dashed outline-[0.12cqw] ${editing.selected === k ? "outline-primary bg-primary/10" : "outline-ink-muted/60"}`
    : "";

  const q = layout.fields.qr;
  return (
    <div ref={box} data-theme="light"
      className="designed-certificate relative mx-auto w-full overflow-hidden bg-white [container-type:inline-size] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:h-[210mm] print:w-[297mm] print:max-w-none"
      style={{ aspectRatio: String(aspect) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the school's own picture, printed at full quality */}
      <img src={imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill" />
      {layout.texts.filter((x) => showsOn(x, copy)).map((x) => (
        <FieldText key={x.id} f={x} text={x.text} label={x.text || "Text"} className={outline(`t:${x.id}`)} lineAbove={x.lineAbove}
          onPointerDown={editing ? (e) => startDrag(`t:${x.id}`, e) : undefined} />
      ))}
      {(Object.keys(values) as TextFieldKey[]).map((k) => {
        const f = layout.fields[k];
        if (f.hidden) return null;
        return (
          <FieldText key={k} f={f} text={values[k]} label={FIELD_LABELS[k]} className={outline(k)}
            onPointerDown={editing ? (e) => startDrag(k, e) : undefined} />
        );
      })}
      {!q.hidden && (
        <div className={`absolute flex flex-col items-center ${outline("qr")}`}
          style={{ left: `${(q.x - q.w / 2) * 100}%`, top: `${q.y * 100}%`, width: `${q.w * 100}%`, transform: "translateY(-50%)" }}
          onPointerDown={editing ? (e) => startDrag("qr", e) : undefined}>
          <div className="w-full bg-white p-[4%] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label="QR code to check this certificate"
            dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="mt-[0.3cqw] whitespace-nowrap text-center font-semibold leading-tight text-[#1c1c1c]" style={{ fontSize: `${Math.max(0.95, q.w * 11)}cqw`, fontFamily: FONTS.sans }}>
            Verify: <span className="font-mono">{code}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** One value on the design. A value too long for its box gets smaller until it fits (one line). */
function FieldText({ f, text, label, className, lineAbove = false, onPointerDown }: {
  f: TextField; text: string; label: string; className: string; lineAbove?: boolean; onPointerDown?: (e: ReactPointerEvent) => void;
}) {
  const inner = useRef<HTMLSpanElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // The scale on screen right now: a later measure (after fonts load) must divide by this, not by the
  // value its closure saw.
  const shownScale = useRef(1);
  shownScale.current = scale;
  const shown = f.upper ? text.toLocaleUpperCase("en") : text;
  const isUrdu = urdu(shown);

  useLayoutEffect(() => {
    // The scale doesn't depend on screen size (everything is in container units), so measuring once
    // per text/size change is enough; fonts loading late can change widths, so measure again then.
    const fit = () => {
      const o = outer.current, i = inner.current;
      if (!o || !i) return;
      const room = o.getBoundingClientRect().width;
      const natural = i.getBoundingClientRect().width / shownScale.current;
      if (!room || !natural) return;
      setScale(natural > room ? Math.max(0.3, room / natural) : 1);
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
  }, [shown, f.size, f.w, f.font, f.bold, f.upper, f.spacing]);

  const { left, width } = boxOf(f);
  return (
    <div ref={outer} title={className ? label : undefined} onPointerDown={onPointerDown}
      className={`absolute whitespace-nowrap ${className}`}
      style={{
        left: `${left * 100}%`, top: `${f.y * 100}%`, width: `${width * 100}%`, transform: "translateY(-50%)",
        textAlign: f.align, color: f.color, lineHeight: isUrdu ? 1.9 : 1.2,
        ...(lineAbove ? { borderTop: `0.13cqw solid ${f.color}`, paddingTop: "0.35cqw" } : {}),
      }}>
      <span ref={inner} lang={isUrdu ? "ur" : "en"} dir="auto"
        style={{
          fontSize: `${f.size * scale}cqw`, fontFamily: isUrdu ? "var(--font-urdu)" : FONTS[f.font], fontWeight: f.bold ? 700 : 400,
          textDecoration: f.underline ? "underline" : undefined, textDecorationThickness: "0.08em", textUnderlineOffset: "0.15em",
          // Letter spacing also adds space after the last letter; take it back so centring stays true.
          ...(f.spacing ? { letterSpacing: `${f.spacing}em`, marginInlineEnd: `-${f.spacing}em` } : {}),
        }}>
        {shown || (className ? `[${label}]` : "")}
      </span>
    </div>
  );
}

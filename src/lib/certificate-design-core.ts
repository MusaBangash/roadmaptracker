// A school's own certificate design (Step 5, certificate design), pure and tested in
// certificate-design-core.test.ts: checking the uploaded picture, where each printed value sits on
// it (the layout), and the values a teacher is offered when issuing.

import { z } from "zod";

// ---------- The picture ----------

/** At most 8 MB: a 300 dpi A4 PNG of a detailed border is usually 3–6 MB. */
export const DESIGN_MAX_BYTES = 8 * 1024 * 1024;
export const DESIGN_MIN_WIDTH = 2000;
/** A4 landscape is 297 / 210 = 1.414; a little either way still prints without visible stretching. */
const RATIO_MIN = 1.39;
const RATIO_MAX = 1.44;

export type ImageInfo = { mime: "image/png" | "image/jpeg"; width: number; height: number };

/** Reads a PNG's or JPEG's size from its bytes (never trusts the file name or the browser's type). */
export function imageInfo(b: Uint8Array): ImageInfo | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 24 && png.every((v, i) => b[i] === v)) {
    const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    return { mime: "image/png", width: u32(16), height: u32(20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; } // fill byte
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; } // markers without a length
      // SOF0–SOF15 hold the size (C4 = Huffman tables, C8 = reserved, CC = arithmetic coding are not frames).
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { mime: "image/jpeg", height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

/** Why this picture can't be a certificate design, in plain words, or null when it is fine. */
export function designProblem(info: ImageInfo | null, bytes: number): string | null {
  if (bytes === 0) return "Choose the certificate picture first.";
  if (bytes > DESIGN_MAX_BYTES) return `The picture is ${(bytes / 1024 / 1024).toFixed(1)} MB. Keep it under 8 MB (save it as PNG or JPG again from the design program).`;
  if (!info) return "That isn't a PNG or JPG picture. Export the design as PNG (best) or JPG.";
  if (info.height > info.width) return "The picture is standing up (portrait). The certificate is A4 lying down (landscape), wider than tall.";
  const ratio = info.width / info.height;
  if (ratio < RATIO_MIN || ratio > RATIO_MAX) {
    return `The picture is ${info.width} × ${info.height} pixels, which isn't the shape of an A4 page. Export it at A4 landscape, e.g. 3508 × 2480.`;
  }
  if (info.width < DESIGN_MIN_WIDTH) return `The picture is only ${info.width} pixels wide, so it would print blurry. Export it at least ${DESIGN_MIN_WIDTH} wide (3508 × 2480 is best).`;
  return null;
}

/** The online version must be the same design at the same shape, so every value lands in the same place. */
export function onlineProblem(print: { width: number; height: number }, info: ImageInfo | null, bytes: number): string | null {
  const basic = designProblem(info, bytes);
  if (basic || !info) return basic;
  if (Math.abs(info.width / info.height - print.width / print.height) > 0.005) {
    return `The online version is ${info.width} × ${info.height} but the print version is ${print.width} × ${print.height}. Export both at the same size, so the values land in the same places.`;
  }
  return null;
}

// ---------- The layout ----------

export const TEXT_FIELDS = ["name", "regNo", "date", "course", "duration", "session", "level"] as const;
export type TextFieldKey = (typeof TEXT_FIELDS)[number];
export type FieldKey = TextFieldKey | "qr";

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Name", regNo: "Reg No", date: "Date", course: "Course", duration: "Duration", session: "Session", level: "Level", qr: "QR code",
};

export const DATE_FORMATS = ["DD-MMM-YYYY", "D MMMM YYYY", "DD/MM/YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const frac = z.number().finite().min(0).max(1);
/**
 * One printed value. All positions are fractions of the picture (0–1), so the layout fits any size:
 * `y` is the middle of the line; `x` is where the text starts (left), its middle (center) or its end
 * (right). `w` is the widest it may be: a longer name gets smaller, never runs off the design.
 * `size` is the letter size in hundredths of the picture's width.
 */
const textField = z.object({
  x: frac, y: frac, w: z.number().finite().min(0.03).max(1), size: z.number().finite().min(0.5).max(8),
  color: hex, align: z.enum(["left", "center", "right"]), font: z.enum(["sans", "serif"]),
  bold: z.boolean(), upper: z.boolean(), underline: z.boolean(), hidden: z.boolean(),
}).strict();
/** The QR code: `x`/`y` its middle, `w` its width; the check code is printed under it. */
const qrField = z.object({ x: frac, y: frac, w: z.number().finite().min(0.04).max(0.3), hidden: z.boolean() }).strict();

const layoutSchema = z.object({
  version: z.literal(1),
  dateFormat: z.enum(DATE_FORMATS),
  fields: z.object({
    name: textField, regNo: textField, date: textField, course: textField, duration: textField,
    session: textField, level: textField, qr: qrField,
  }).strict(),
}).strict();

export type TextField = z.infer<typeof textField>;
export type QrField = z.infer<typeof qrField>;
export type CertLayout = z.infer<typeof layoutSchema>;

/** A layout from the editor or the database, or null if anything about it is wrong. */
export function parseLayout(raw: unknown): CertLayout | null {
  const r = layoutSchema.safeParse(typeof raw === "string" ? safeJson(raw) : raw);
  return r.success ? r.data : null;
}
function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

const NAVY = "#25255e";
const INK = "#1c1c1c";
const t = (x: number, y: number, w: number, size: number, more: Partial<TextField> = {}): TextField => ({
  x, y, w, size, color: INK, align: "left", font: "sans", bold: true, upper: false, underline: false, hidden: false, ...more,
});

/**
 * Where the values go on a fresh design, measured from Aisha Cahn College's certificate (the first
 * design used). Another school's admin drags them to their own empty spaces.
 */
export const DEFAULT_LAYOUT: CertLayout = {
  version: 1,
  dateFormat: "DD-MMM-YYYY",
  fields: {
    regNo: t(0.129, 0.251, 0.095, 1.45, { upper: true }),
    date: t(0.8415, 0.251, 0.093, 1.45, { upper: true }),
    name: t(0.5, 0.428, 0.46, 3.1, { align: "center", font: "serif", color: NAVY, upper: true }),
    course: t(0.5, 0.562, 0.6, 3.6, { align: "center", color: NAVY, upper: true, underline: true }),
    duration: t(0.284, 0.615, 0.085, 1.75, { underline: true }),
    session: t(0.4965, 0.615, 0.17, 1.75, { underline: true }),
    level: t(0.7555, 0.615, 0.13, 1.75, { underline: true }),
    qr: { x: 0.5, y: 0.775, w: 0.085, hidden: false },
  },
};

/** Where the box of a text value starts and how wide it is (fractions of the picture's width). */
export function boxOf(f: TextField) {
  const left = f.align === "left" ? f.x : f.align === "center" ? f.x - f.w / 2 : f.x - f.w;
  return { left, width: f.w };
}

// ---------- The values ----------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A calendar day ("2026-09-01") as the design wants it: 01-SEP-2026, 1 September 2026 or 01/09/2026. */
export function formatCertDate(day: string, format: DateFormat) {
  const [y, m, d] = day.split("-").map(Number);
  const dd = String(d).padStart(2, "0");
  if (format === "DD-MMM-YYYY") return `${dd}-${MONTHS[m - 1].slice(0, 3).toUpperCase()}-${y}`;
  if (format === "D MMMM YYYY") return `${d} ${MONTHS[m - 1]} ${y}`;
  return `${dd}/${String(m).padStart(2, "0")}/${y}`;
}

/** Today's calendar day in Pakistan (the school's day, whatever the server's clock zone). */
export function pakistanDay(at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * The next Reg No after the most recent ones (newest first): the number at the end goes up by one and
 * keeps its zeros (B5-AI-010 → B5-AI-011). Skips numbers already used. Empty when there is nothing to
 * go on, so the teacher types the first one.
 */
export function nextRegNo(recent: string[], taken: Set<string>) {
  const last = recent.find((r) => /\d+$/.test(r.trim()));
  if (!last) return "";
  const m = last.trim().match(/^(.*?)(\d+)$/)!;
  let n = Number(m[2]);
  for (let tries = 0; tries < 1000; tries++) {
    n++;
    const next = `${m[1]}${String(n).padStart(m[2].length, "0")}`;
    if (!taken.has(next.toUpperCase())) return next;
  }
  return "";
}

/** Weeks a student needs: required stages, plus one stage of each pick-one group (the longest). */
export function courseWeeks(stages: { weeks: number; optional: boolean; choiceGroup: string | null }[]) {
  const groups = new Map<string, number>();
  let total = 0;
  for (const s of stages) {
    if (s.choiceGroup) groups.set(s.choiceGroup, Math.max(groups.get(s.choiceGroup) ?? 0, s.weeks));
    else if (!s.optional) total += s.weeks;
  }
  for (const w of groups.values()) total += w;
  return total;
}

export function durationText(weeks: number) {
  return weeks > 0 ? `${weeks} ${weeks === 1 ? "Week" : "Weeks"}` : "";
}

/** "Jun 2026 – Aug 2026": from the cohort's start to the planned end (start + the course's weeks). */
export function sessionText(start: Date, weeks: number) {
  const end = new Date(start.getTime() + Math.max(weeks * 7 - 1, 0) * 86_400_000);
  const f = (d: Date) => `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
  return f(start) === f(end) ? f(start) : `${f(start)} – ${f(end)}`;
}

/** What the teacher typed when issuing, checked. Only the values the design shows are required. */
export type CertExtras = { regNo: string | null; courseTitle: string | null; duration: string | null; session: string | null; level: string | null };
const EXTRA_INPUTS = [
  { key: "regNo", field: "regNo", label: "Reg No", max: 30 },
  { key: "courseTitle", field: "course", label: "Course", max: 80 },
  { key: "duration", field: "duration", label: "Duration", max: 40 },
  { key: "session", field: "session", label: "Session", max: 40 },
  { key: "level", field: "level", label: "Level", max: 40 },
] as const;

export function checkCertExtras(layout: CertLayout, get: (key: string) => string): CertExtras | { error: string } {
  const out: CertExtras = { regNo: null, courseTitle: null, duration: null, session: null, level: null };
  for (const e of EXTRA_INPUTS) {
    if (layout.fields[e.field].hidden) continue;
    const v = get(e.key).replace(/\s+/g, " ").trim();
    if (!v) return { error: `Fill in ${e.label}: the certificate design shows it.` };
    if (v.length > e.max) return { error: `Keep ${e.label} under ${e.max} characters.` };
    out[e.key] = v;
  }
  return out;
}

/** Which issue-form boxes the design needs (hidden values aren't asked for). */
export function askedFields(layout: CertLayout) {
  return EXTRA_INPUTS.filter((e) => !layout.fields[e.field].hidden).map((e) => e.key);
}

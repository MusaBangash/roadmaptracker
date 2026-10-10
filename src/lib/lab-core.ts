// Lab checks (equipment inspections), pure and tested in lab-core.test.ts: what a lab is, checking an
// inspection form, the report's numbers, and how an inspection meets the problems already open.

export const FAULT_STATUSES = ["MISSING", "NOT_WORKING", "DAMAGED"] as const;
export type FaultStatus = (typeof FAULT_STATUSES)[number];
export const STATUS_LABELS: Record<FaultStatus, string> = { MISSING: "Missing", NOT_WORKING: "Not working", DAMAGED: "Damaged" };

export const DEFAULT_PC_ITEMS = ["Screen", "System (CPU)", "Keyboard", "Mouse", "Cables"];
export const DEFAULT_ROOM_ITEMS = ["Projector", "Projector screen"];
/** The room's own equipment is one more "station" in reports and problems. */
export const ROOM = "Room";
export const MAX_PCS = 100;
const MAX_ITEMS = 15;

export const stationName = (n: number) => `PC ${n}`;
export function stations(pcCount: number) {
  return Array.from({ length: pcCount }, (_, i) => stationName(i + 1));
}

/** "Screen, Mouse" or one per line → a clean list (no blanks, no repeats in any letter case). */
export function itemList(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const v = part.replace(/\s+/g, " ").trim();
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out;
}

export type LabInput = { name: string; pcCount: number; pcItems: string[]; roomItems: string[] };

/** The lab form, checked, with plain-English problems. */
export function checkLab(raw: { name: string; pcCount: string; pcItems: string; roomItems: string }): LabInput | { error: string } {
  const name = raw.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return { error: "Give the lab a name, e.g. “AI Lab 03” (up to 60 characters)." };
  const pcCount = Number(raw.pcCount);
  if (!Number.isInteger(pcCount) || pcCount < 0 || pcCount > MAX_PCS) return { error: `Number of PCs: a whole number from 0 to ${MAX_PCS}.` };
  const pcItems = itemList(raw.pcItems);
  const roomItems = itemList(raw.roomItems);
  if (pcCount > 0 && pcItems.length === 0) return { error: "Say what is checked on each PC, e.g. Screen, Keyboard, Mouse." };
  if (pcItems.length > MAX_ITEMS || roomItems.length > MAX_ITEMS) return { error: `At most ${MAX_ITEMS} things per list.` };
  if ([...pcItems, ...roomItems].some((i) => i.length > 40)) return { error: "Keep each thing under 40 characters." };
  if (pcCount === 0 && roomItems.length === 0) return { error: "A lab needs PCs or room equipment to check." };
  return { name, pcCount, pcItems, roomItems };
}

/** Every thing that can be checked in a lab: each PC's items, then the room's. */
export function cellsOf(lab: { pcCount: number; pcItems: string[]; roomItems: string[] }) {
  return [
    ...stations(lab.pcCount).flatMap((station) => lab.pcItems.map((item) => ({ station, item }))),
    ...lab.roomItems.map((item) => ({ station: ROOM, item })),
  ];
}
export const cellKey = (station: string, item: string) => `${station}|${item}`;

export type Finding = { station: string; item: string; status: FaultStatus; note: string };

/** The inspection form → its problems. Each cell's field is `c|<station>|<item>` = OK or a status, with
 *  the note in `n|<station>|<item>`. Anything not on the lab is ignored, so a forged field adds nothing. */
export function readFindings(lab: { pcCount: number; pcItems: string[]; roomItems: string[] }, get: (key: string) => string) {
  const out: Finding[] = [];
  for (const { station, item } of cellsOf(lab)) {
    const status = get(`c|${cellKey(station, item)}`);
    if (!(FAULT_STATUSES as readonly string[]).includes(status)) continue;
    out.push({ station, item, status: status as FaultStatus, note: get(`n|${cellKey(station, item)}`).replace(/\s+/g, " ").trim().slice(0, 200) });
  }
  return out;
}

/** A report's numbers: PCs with nothing wrong, and problems by kind. */
export function inspectionSummary(lab: { pcCount: number }, findings: Finding[]) {
  const broken = new Set(findings.filter((f) => f.station !== ROOM).map((f) => f.station));
  const byStatus = Object.fromEntries(FAULT_STATUSES.map((s) => [s, findings.filter((f) => f.status === s).length])) as Record<FaultStatus, number>;
  return { pcsWorking: lab.pcCount - broken.size, pcCount: lab.pcCount, problems: findings.length, byStatus, roomProblems: findings.filter((f) => f.station === ROOM).length };
}

/**
 * How a saved inspection meets the problems already open: a problem found again stays open (its status
 * and note updated), a new one is opened, and an open problem the inspection found OK is marked fixed.
 * Open problems for things no longer on the lab (a PC removed) are left alone.
 */
export function reconcile<F extends { id: string; station: string; item: string; status: FaultStatus; note: string | null }>(
  lab: { pcCount: number; pcItems: string[]; roomItems: string[] }, open: F[], findings: Finding[],
) {
  const onLab = new Set(cellsOf(lab).map((c) => cellKey(c.station, c.item)));
  const found = new Map(findings.map((f) => [cellKey(f.station, f.item), f]));
  const openBy = new Map(open.map((f) => [cellKey(f.station, f.item), f]));
  const create = findings.filter((f) => !openBy.has(cellKey(f.station, f.item)));
  const update = open.flatMap((f) => {
    const now = found.get(cellKey(f.station, f.item));
    return now && (now.status !== f.status || (now.note || null) !== (f.note || null)) ? [{ id: f.id, status: now.status, note: now.note }] : [];
  });
  const fixed = open.filter((f) => onLab.has(cellKey(f.station, f.item)) && !found.has(cellKey(f.station, f.item)));
  return { create, update, fixed };
}

/** An inspection is due when there has been none, or the last was more than a month ago. */
export function inspectionDue(lastDay: string | null, today: string) {
  if (!lastDay) return true;
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / 86_400_000;
  return days > 31;
}

/** A free-text note (problem, fix): one line, at most 200 characters. */
export function cleanNote(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 200);
}

// Class groups (a school's own, e.g. Morning Boys / Evening Girls) and Hostel / Day scholar.
// Pure and tested in group-core.test.ts.

export const GROUP_NAME_MAX = 40;
export const GROUPS_MAX = 30;

/** Why a group name can't be used (plain words), or null when it is fine. Names are unique in a school, any case. */
export function groupNameProblem(name: string, others: string[]) {
  const n = name.trim();
  if (n.length < 2 || n.length > GROUP_NAME_MAX) return `Type a group name of 2 to ${GROUP_NAME_MAX} characters, e.g. "Morning Boys".`;
  if (others.some((o) => o.trim().toLowerCase() === n.toLowerCase())) return `There is already a group called "${n}".`;
  return null;
}

export type Residence = "HOSTEL" | "DAY";
export const RESIDENCE_WORDS: Record<Residence, string> = { HOSTEL: "Hostel", DAY: "Day scholar" };

/** Which students a list shows: everyone, hostel students or day scholars ("?show=" in the address). */
export type Show = "all" | "hostel" | "day";
export function parseShow(v: string | null | undefined): Show {
  return v === "hostel" || v === "day" ? v : "all";
}
export const SHOW_WORDS: Record<Show, string> = { all: "All students", hostel: "Hostel", day: "Day scholars" };
export function matchesShow(show: Show, residence: Residence | null) {
  return show === "all" || (show === "hostel" ? residence === "HOSTEL" : residence === "DAY");
}

/** A group from the address: a group of this school, "none" (classes without a group), or null (all). */
export function parseGroup(v: string | null | undefined, groupIds: string[]) {
  if (v === "none") return "none" as const;
  return v && groupIds.includes(v) ? v : null;
}
export function inGroup(filter: string | null, groupId: string | null) {
  return filter === null || (filter === "none" ? groupId === null : groupId === filter);
}

export type ClassToday = { groupId: string | null; present: number; marked: number; taken: boolean };

/**
 * Today's attendance added up per class group, in the school's order of groups; classes without a group
 * come last as "No group" (only when there are any).
 */
export function groupTotals(classes: ClassToday[], groups: { id: string; name: string }[]) {
  const rows = [...groups.map((g) => ({ id: g.id as string | null, name: g.name })), { id: null, name: "No group" }].map((g) => {
    const mine = classes.filter((c) => c.groupId === g.id);
    return {
      ...g,
      classes: mine.length,
      present: mine.reduce((a, c) => a + c.present, 0),
      marked: mine.reduce((a, c) => a + c.marked, 0),
      notTaken: mine.filter((c) => !c.taken).length,
    };
  });
  return rows.filter((r) => r.classes > 0);
}

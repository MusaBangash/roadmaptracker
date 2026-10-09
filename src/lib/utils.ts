export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  // A date with no time ("2026-10-14") is a calendar day: format it in UTC so a server in
  // another time zone never shows the day before.
  const dayOnly = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(dayOnly ? { timeZone: "UTC" } : {}) });
}

export function daysAgo(d: Date | null | undefined) {
  if (!d) return "never";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** Monday of the current week as YYYY-MM-DD. */
export function thisMonday(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function initials(name?: string | null, email?: string | null) {
  const s = (name || email || "?").trim();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

export function randomCode(len = 10) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function safeUrl(u?: string | null) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "1 student", "3 students" */
export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

/** A moment as Pakistan time, e.g. "10 Oct 2026, 14:05" (the server may run in another zone). */
export function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

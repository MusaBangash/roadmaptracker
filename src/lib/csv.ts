// CSV files for Excel: safe cells and the UTF-8 byte-order mark. Pure (used on server and in the browser).

/** A spreadsheet cell, safe against formula injection, quoted. */
export function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A CSV file Excel opens correctly (UTF-8 byte-order mark, CRLF lines). */
export function csvFile(rows: unknown[][]) {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** The template for adding students from a file. Kept here (not in import-core) so the browser doesn't load the checks. */
export const STUDENTS_TEMPLATE_CSV = csvFile([["Name", "Email"], ["Ayesha Khan", "ayesha.khan@example.com"], ["محمد علی", "m.ali@example.com"]]);

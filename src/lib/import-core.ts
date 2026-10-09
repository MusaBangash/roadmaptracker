// Adding many students from a file (Step 5, feature 1), pure and tested in import-core.test.ts:
// read a CSV saved from Excel, check each row in plain English, and sort rows into new accounts,
// existing accounts to add, already in the cohort, and problems.
import { z } from "zod";

export const IMPORT_LIMIT = { rows: 500, fileBytes: 1_000_000, linkDays: 14 } as const;

/** Splits CSV text into rows of cells: quotes, doubled quotes, commas/semicolons/tabs inside
 *  quotes, CRLF or LF, and the byte-order mark Excel adds. The separator is taken from the first line. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const firstLine = s.slice(0, s.search(/\r?\n|$/));
  const sep = [",", ";", "\t"].map((c) => [c, firstLine.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type StudentRow = { row: number; name: string; email: string };
export type RowProblem = { row: number; reason: string };

const emailSchema = z.string().email();

/** One student from a name and email, or the reason it can't be used. */
export function checkStudent(nameRaw: string, emailRaw: string): { name: string; email: string } | { reason: string } {
  const name = nameRaw.replace(/\s+/g, " ").trim();
  const email = emailRaw.trim().toLowerCase();
  if (!email) return { reason: "email is missing" };
  if (!emailSchema.safeParse(email).success) return { reason: `“${email.slice(0, 60)}” is not a valid email` };
  if (name.length < 2) return { reason: "name is missing" };
  if (name.length > 80) return { reason: "name is longer than 80 characters" };
  return { name, email };
}

/** Reads the file's rows: finds the Name and Email columns in the first row, checks every row,
 *  and flags the same email twice. Row numbers are as Excel shows them (header = row 1). */
export function readStudentFile(text: string): { students: StudentRow[]; problems: RowProblem[]; fileError?: string } {
  const rows = parseCsv(text);
  if (!rows.length) return { students: [], problems: [], fileError: "The file is empty." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameCol = header.findIndex((h) => /^(full )?name$|^student( name)?$/.test(h));
  const emailCol = header.findIndex((h) => /^e-?mail( address)?$/.test(h));
  if (nameCol < 0 || emailCol < 0) {
    return { students: [], problems: [], fileError: "The first row must have the column titles Name and Email. Download the template to see the format." };
  }
  if (rows.length - 1 > IMPORT_LIMIT.rows) {
    return { students: [], problems: [], fileError: `The file has ${rows.length - 1} students. Add at most ${IMPORT_LIMIT.rows} at a time.` };
  }
  const students: StudentRow[] = [];
  const problems: RowProblem[] = [];
  const seen = new Map<string, number>();
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const c = checkStudent(r[nameCol] ?? "", r[emailCol] ?? "");
    if ("reason" in c) return problems.push({ row, reason: c.reason });
    const first = seen.get(c.email);
    if (first) return problems.push({ row, reason: `same email as row ${first}` });
    seen.set(c.email, row);
    students.push({ row, ...c });
  });
  if (!students.length && !problems.length) return { students, problems, fileError: "The file has no students under the title row." };
  return { students, problems };
}

export type Existing = { userId: string; inCohort: boolean };

/** Sorts checked students by what adding them will do. */
export function planImport(students: StudentRow[], existing: Map<string, Existing>) {
  const create: StudentRow[] = [], add: (StudentRow & { userId: string })[] = [], skip: StudentRow[] = [];
  for (const s of students) {
    const e = existing.get(s.email);
    if (!e) create.push(s);
    else if (e.inCohort) skip.push(s);
    else add.push({ ...s, userId: e.userId });
  }
  return { create, add, skip };
}

export { STUDENTS_TEMPLATE_CSV as TEMPLATE_CSV } from "./csv";

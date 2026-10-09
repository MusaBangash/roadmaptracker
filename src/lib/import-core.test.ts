import { describe, expect, it } from "vitest";
import { parseCsv, planImport, readStudentFile, TEMPLATE_CSV } from "./import-core";
import { csvCell, csvFile } from "./csv";

describe("parseCsv", () => {
  it("reads quotes, commas and line breaks inside quotes, CRLF and Excel's byte-order mark", () => {
    expect(parseCsv('\uFEFFName,Email\r\n"Khan, Ayesha",a@x.com\r\n"Say ""hi""",b@x.com\r\n')).toEqual([
      ["Name", "Email"], ["Khan, Ayesha", "a@x.com"], ['Say "hi"', "b@x.com"],
    ]);
  });
  it("takes semicolons or tabs as the separator when Excel saved it that way", () => {
    expect(parseCsv("Name;Email\nAli;ali@x.com")).toEqual([["Name", "Email"], ["Ali", "ali@x.com"]]);
    expect(parseCsv("Name\tEmail\nAli\tali@x.com")).toEqual([["Name", "Email"], ["Ali", "ali@x.com"]]);
  });
  it("drops empty lines", () => expect(parseCsv("Name,Email\n\n,\nAli,a@x.com\n\n")).toEqual([["Name", "Email"], ["Ali", "a@x.com"]]));
});

describe("readStudentFile", () => {
  it("reads the template, Urdu names included", () => {
    const r = readStudentFile(TEMPLATE_CSV);
    expect(r.problems).toEqual([]);
    expect(r.students.map((s) => s.name)).toEqual(["Ayesha Khan", "محمد علی"]);
  });
  it("finds the columns in any order and case, and cleans values", () => {
    const r = readStudentFile("Roll no,E-mail,Full name\n1,  ALI@X.COM ,  Ali   Raza \n");
    expect(r.students).toEqual([{ row: 2, name: "Ali Raza", email: "ali@x.com" }]);
  });
  it("says what is wrong with each row, with the row number Excel shows", () => {
    const r = readStudentFile("Name,Email\nAli,ali@x.com\nSara,not-an-email\n,b@x.com\nZain,\nAli Two,ALI@x.com\n");
    expect(r.students.map((s) => s.row)).toEqual([2]);
    expect(r.problems).toEqual([
      { row: 3, reason: "“not-an-email” is not a valid email" },
      { row: 4, reason: "name is missing" },
      { row: 5, reason: "email is missing" },
      { row: 6, reason: "same email as row 2" },
    ]);
  });
  it("refuses a file without Name and Email titles, an empty file, or too many rows", () => {
    expect(readStudentFile("Ali,ali@x.com").fileError).toMatch(/column titles Name and Email/);
    expect(readStudentFile("").fileError).toBe("The file is empty.");
    expect(readStudentFile("Name,Email\n").fileError).toMatch(/no students/);
    const big = "Name,Email\n" + Array.from({ length: 501 }, (_, i) => `S${i},s${i}@x.com`).join("\n");
    expect(readStudentFile(big).fileError).toMatch(/at most 500/);
  });
});

describe("planImport", () => {
  it("sorts students into new, add to cohort, and already in the cohort", () => {
    const students = [{ row: 2, name: "A", email: "a@x.com" }, { row: 3, name: "B", email: "b@x.com" }, { row: 4, name: "C", email: "c@x.com" }];
    const p = planImport(students, new Map([["b@x.com", { userId: "ub", inCohort: false }], ["c@x.com", { userId: "uc", inCohort: true }]]));
    expect(p.create.map((s) => s.email)).toEqual(["a@x.com"]);
    expect(p.add).toEqual([{ row: 3, name: "B", email: "b@x.com", userId: "ub" }]);
    expect(p.skip.map((s) => s.email)).toEqual(["c@x.com"]);
  });
});

describe("csv", () => {
  it("guards against spreadsheet formulas and quotes cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('a "b"')).toBe(`"a ""b"""`);
    expect(csvFile([["a", 1], ["b", null]])).toBe('\uFEFF"a","1"\r\n"b",""');
  });
});

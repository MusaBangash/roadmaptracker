import { describe, expect, it } from "vitest";
import {
  askedFields, boxOf, checkCertExtras, courseWeeks, DEFAULT_LAYOUT, designProblem, durationText, formatCertDate,
  imageInfo, nextRegNo, pakistanDay, parseLayout, sessionText, type CertLayout,
} from "./certificate-design-core";

function pngHeader(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}
function jpegHeader(width: number, height: number) {
  // SOI, an APP0 segment (length 16), then SOF0 with the size.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 0, 0, 0]);
}

describe("imageInfo", () => {
  it("reads a PNG's size from its bytes", () => {
    expect(imageInfo(pngHeader(3508, 2480))).toEqual({ mime: "image/png", width: 3508, height: 2480 });
  });
  it("reads a JPEG's size, skipping the segments before the frame", () => {
    expect(imageInfo(jpegHeader(3508, 2480))).toEqual({ mime: "image/jpeg", width: 3508, height: 2480 });
  });
  it("refuses anything else (an SVG, a PDF, a renamed text file)", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    expect(imageInfo(text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(imageInfo(text("%PDF-1.7 ..."))).toBeNull();
    expect(imageInfo(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("designProblem", () => {
  const info = (width: number, height: number) => ({ mime: "image/png" as const, width, height });
  it("accepts A4 landscape at print quality", () => {
    expect(designProblem(info(3508, 2480), 3_000_000)).toBeNull();
    expect(designProblem(info(2000, 1414), 900_000)).toBeNull();
  });
  it("explains each problem in plain words", () => {
    expect(designProblem(info(3508, 2480), 0)).toMatch(/Choose/);
    expect(designProblem(info(3508, 2480), 9 * 1024 * 1024)).toMatch(/under 8 MB/);
    expect(designProblem(null, 1000)).toMatch(/isn't a PNG or JPG/);
    expect(designProblem(info(2480, 3508), 1000)).toMatch(/portrait/);
    expect(designProblem(info(1920, 1080), 1000)).toMatch(/shape of an A4/);
    expect(designProblem(info(1400, 990), 1000)).toMatch(/blurry/);
  });
});

describe("parseLayout", () => {
  it("accepts the default layout, as an object or as the editor's JSON text", () => {
    expect(parseLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout(JSON.stringify(DEFAULT_LAYOUT))).toEqual(DEFAULT_LAYOUT);
  });
  it("refuses anything off the picture, unknown keys, odd colours or broken JSON", () => {
    const withName = (over: object) => ({ ...DEFAULT_LAYOUT, fields: { ...DEFAULT_LAYOUT.fields, name: { ...DEFAULT_LAYOUT.fields.name, ...over } } });
    expect(parseLayout(withName({ x: 1.5 }))).toBeNull();
    expect(parseLayout(withName({ size: 40 }))).toBeNull();
    expect(parseLayout(withName({ color: "red; background:url(x)" }))).toBeNull();
    expect(parseLayout(withName({ onclick: "x" }))).toBeNull();
    expect(parseLayout({ ...DEFAULT_LAYOUT, extra: 1 })).toBeNull();
    expect(parseLayout("{not json")).toBeNull();
    expect(parseLayout(null)).toBeNull();
  });
});

describe("boxOf", () => {
  const f = DEFAULT_LAYOUT.fields.name;
  it("left text starts at x, centred text is centred on x, right text ends at x", () => {
    expect(boxOf({ ...f, align: "left", x: 0.2, w: 0.3 })).toEqual({ left: 0.2, width: 0.3 });
    expect(boxOf({ ...f, align: "center", x: 0.5, w: 0.4 }).left).toBeCloseTo(0.3);
    expect(boxOf({ ...f, align: "right", x: 0.9, w: 0.2 }).left).toBeCloseTo(0.7);
  });
});

describe("formatCertDate", () => {
  it("prints the day the way the design wants", () => {
    expect(formatCertDate("2026-09-01", "DD-MMM-YYYY")).toBe("01-SEP-2026");
    expect(formatCertDate("2026-09-01", "D MMMM YYYY")).toBe("1 September 2026");
    expect(formatCertDate("2026-12-25", "DD/MM/YYYY")).toBe("25/12/2026");
  });
  it("uses the day in Pakistan, not the server's zone", () => {
    expect(pakistanDay(new Date("2026-08-31T20:30:00Z"))).toBe("2026-09-01"); // 01:30 in Wazirabad
    expect(pakistanDay(new Date("2026-09-01T10:00:00Z"))).toBe("2026-09-01");
  });
});

describe("nextRegNo", () => {
  it("counts on from the newest, keeping the zeros", () => {
    expect(nextRegNo(["B5-AI-010", "B5-AI-009"], new Set())).toBe("B5-AI-011");
    expect(nextRegNo(["ST-099"], new Set())).toBe("ST-100");
    expect(nextRegNo(["7"], new Set())).toBe("8");
  });
  it("skips numbers already on a certificate in the school (any letter case)", () => {
    expect(nextRegNo(["B5-AI-010"], new Set(["B5-AI-011", "B5-AI-012"]))).toBe("B5-AI-013");
  });
  it("is empty with nothing to go on, so the teacher types the first one", () => {
    expect(nextRegNo([], new Set())).toBe("");
    expect(nextRegNo(["ABC"], new Set())).toBe("");
  });
});

describe("course length and session", () => {
  const s = (weeks: number, optional = false, choiceGroup: string | null = null) => ({ weeks, optional, choiceGroup });
  it("counts required stages and one stage per pick-one group, not optional extras", () => {
    expect(courseWeeks([s(4), s(6), s(2, true, "lane"), s(3, true, "lane"), s(5, true)])).toBe(13);
    expect(durationText(12)).toBe("12 Weeks");
    expect(durationText(1)).toBe("1 Week");
    expect(durationText(0)).toBe("");
  });
  it("runs from the cohort's start to its planned end", () => {
    expect(sessionText(new Date("2026-06-01T00:00:00Z"), 12)).toBe("Jun 2026 – Aug 2026");
    expect(sessionText(new Date("2026-06-01T00:00:00Z"), 2)).toBe("Jun 2026");
    expect(sessionText(new Date("2026-11-02T00:00:00Z"), 12)).toBe("Nov 2026 – Jan 2027");
  });
});

describe("checkCertExtras", () => {
  const form = (v: Record<string, string>) => (k: string) => v[k] ?? "";
  const all = { regNo: " B5-AI-011 ", courseTitle: "Artificial  Intelligence", duration: "12 Weeks", session: "Jun 2026 – Aug 2026", level: "Foundation" };
  it("tidies and keeps every value the design shows", () => {
    expect(checkCertExtras(DEFAULT_LAYOUT, form(all))).toEqual({ ...all, regNo: "B5-AI-011", courseTitle: "Artificial Intelligence" });
  });
  it("asks for a shown value that is missing, and limits length", () => {
    expect(checkCertExtras(DEFAULT_LAYOUT, form({ ...all, level: "  " }))).toEqual({ error: "Fill in Level: the certificate design shows it." });
    expect(checkCertExtras(DEFAULT_LAYOUT, form({ ...all, regNo: "X".repeat(31) }))).toEqual({ error: "Keep Reg No under 30 characters." });
  });
  it("doesn't ask for values the design hides", () => {
    const noLevel: CertLayout = { ...DEFAULT_LAYOUT, fields: { ...DEFAULT_LAYOUT.fields, level: { ...DEFAULT_LAYOUT.fields.level, hidden: true } } };
    expect(checkCertExtras(noLevel, form({ ...all, level: "" }))).toMatchObject({ level: null, regNo: "B5-AI-011" });
    expect(askedFields(noLevel)).toEqual(["regNo", "courseTitle", "duration", "session"]);
  });
});

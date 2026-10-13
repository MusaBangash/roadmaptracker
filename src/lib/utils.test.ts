import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fmtDate, schoolToday } from "./utils";

describe("fmtDate", () => {
  // A server west of UTC (like a US region) is where a calendar day used to slip back by one.
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = "America/New_York"; });
  afterAll(() => { process.env.TZ = original; });

  it("shows a calendar day as that same day, even on a server west of UTC", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York"); // the test really runs there
    expect(fmtDate("2026-10-14")).toBe("14 Oct 2026");
    expect(fmtDate("2026-01-01")).toBe("1 Jan 2026");
  });

  it("shows a dash for nothing", () => expect(fmtDate(null)).toBe("—"));
});

describe("schoolToday", () => {
  it("is the day in Pakistan, even when the server's UTC day is still the day before", () => {
    expect(schoolToday(new Date("2026-10-12T20:30:00Z"))).toBe("2026-10-13"); // 01:30 in Pakistan
    expect(schoolToday(new Date("2026-10-13T18:59:00Z"))).toBe("2026-10-13"); // 23:59 in Pakistan
  });
});

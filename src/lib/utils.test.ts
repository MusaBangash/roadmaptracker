import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fmtDate } from "./utils";

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

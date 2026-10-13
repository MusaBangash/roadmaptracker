import { describe, expect, it } from "vitest";
import { absentListMessage, hostelListMessage, certificateMessage, inviteMessage, resetMessage, welcomeMessage, whatsappUrl } from "./whatsapp";

describe("whatsapp", () => {
  it("puts the whole message, safely encoded, into a wa.me link", () => {
    const url = whatsappUrl("Join: https://x.test/join/ab?c=1&d=2 #now");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("Join: https://x.test/join/ab?c=1&d=2 #now");
    expect(url).not.toMatch(/[ #&]/); // nothing that would cut the message short
  });
  it("invite: school, role in words, cohort and expiry", () => {
    expect(inviteMessage({ school: "Aisha Cahn College", role: "STUDENT", cohort: "Web Designing – Batch 1", link: "L", until: "15 Nov 2026" }))
      .toBe("Assalam-o-Alaikum! Join Aisha Cahn College on NoorAI Tracks as a student in Web Designing – Batch 1. Open this link and create your account: L (valid until 15 Nov 2026)");
    expect(inviteMessage({ school: "S", role: "INSTRUCTOR", link: "L" })).toBe("Assalam-o-Alaikum! Join S on NoorAI Tracks as a teacher. Open this link and create your account: L");
  });
  it("reset, welcome and certificate messages", () => {
    expect(resetMessage("L")).toBe("Your NoorAI Tracks password reset link. It works once, for 1 hour: L");
    expect(welcomeMessage({ name: "Ayesha", cohort: "Batch 1", link: "L", days: 14 })).toContain("Welcome to Batch 1");
    expect(certificateMessage({ name: "Ayesha Khan", course: "Web Designing", school: "ACC", link: "L" }))
      .toBe("Ayesha Khan completed Web Designing at ACC. Check it is genuine: L");
  });
});

describe("absentListMessage", () => {
  it("lists absent, late and on-leave students", () => {
    expect(absentListMessage({ cohort: "Web Design A", day: "Tue 13 Oct 2026", present: 3, total: 5, absent: ["Ahmed Khan", "Sara Ali"], late: ["Bilal"], leave: [] }))
      .toBe("Attendance, Web Design A, Tue 13 Oct 2026: 3 of 5 present.\nAbsent (2): Ahmed Khan, Sara Ali\nLate (1): Bilal");
  });
  it("says so when everyone came", () => {
    expect(absentListMessage({ cohort: "A", day: "Mon 12 Oct 2026", present: 4, total: 4, absent: [], late: [], leave: [] }))
      .toBe("Attendance, A, Mon 12 Oct 2026: 4 of 4 present. Everyone was present.");
  });
});

describe("hostelListMessage", () => {
  it("lists hostel students absent or on leave with their class, and classes not taken yet", () => {
    expect(hostelListMessage({ school: "Aisha Cahn College", day: "Wed 14 Oct 2026", absent: [{ name: "Ali", cohort: "Web A" }], leave: [{ name: "Sara", cohort: "Web B" }], notTaken: ["AI Evening"] }))
      .toBe("Hostel students, Aisha Cahn College, Wed 14 Oct 2026.\nAbsent (1):\n- Ali (Web A)\nOn leave (1):\n- Sara (Web B)\nAttendance not taken yet: AI Evening.");
    expect(hostelListMessage({ school: "S", day: "D", absent: [], leave: [], notTaken: [] })).toBe("Hostel students, S, D. No hostel student was absent or on leave.");
  });
});

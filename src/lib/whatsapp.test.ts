import { describe, expect, it } from "vitest";
import { certificateMessage, inviteMessage, resetMessage, welcomeMessage, whatsappUrl } from "./whatsapp";

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

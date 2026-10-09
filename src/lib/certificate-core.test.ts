import { describe, expect, it } from "vitest";
import { certificateReady, checkCertificateName, CODE_ALPHABET, makeCertificateCode, normalizeCode, type CertStage } from "./certificate-core";

const stage = (id: string, over: Partial<CertStage> = {}): CertStage => ({ id, title: id.toUpperCase(), optional: false, choiceGroup: null, ...over });
const pass = (stageId: string, day: string) => ({ stageId, passed: true, signedAt: new Date(`${day}T10:00:00Z`) });

// s1, s2 required · lanes A/B (pick one, optional like Edition 4) · x an optional extra
const roadmap = [stage("s1"), stage("s2"), stage("a", { optional: true, choiceGroup: "lane", title: "Lane A" }),
  stage("b", { optional: true, choiceGroup: "lane", title: "Lane B" }), stage("x", { optional: true })];

describe("certificateReady", () => {
  it("is ready when every required stage and one stage of each pick-one group passed", () => {
    expect(certificateReady(roadmap, [pass("s1", "2026-03-01"), pass("s2", "2026-05-01"), pass("b", "2026-06-15")]))
      .toEqual({ ready: true, missing: [], completedOn: "2026-06-15" });
  });
  it("says what is missing, in roadmap order", () => {
    expect(certificateReady(roadmap, [pass("s2", "2026-05-01")]).missing).toEqual(["S1", "One of: Lane A, Lane B"]);
  });
  it("doesn't count 'Not yet' sign-offs, and never needs optional extras", () => {
    const r = certificateReady(roadmap, [pass("s1", "2026-03-01"), { stageId: "s2", passed: false, signedAt: new Date() }, pass("a", "2026-04-01")]);
    expect(r).toMatchObject({ ready: false, missing: ["S2"] });
  });
  it("takes the completion date from the last pass that counted, not from an extra", () => {
    const r = certificateReady(roadmap, [pass("s1", "2026-03-01"), pass("s2", "2026-05-01"), pass("a", "2026-04-01"), pass("b", "2026-08-01"), pass("x", "2026-09-01")]);
    expect(r.completedOn).toBe("2026-05-01");
  });
  it("is never ready for an empty roadmap", () => expect(certificateReady([], []).ready).toBe(false));
});

describe("codes", () => {
  const bytes = (n: number, f: (i: number) => number) => Uint8Array.from({ length: n }, (_, i) => f(i));
  it("makes a 5-5 code from the safe alphabet", () => {
    const c = makeCertificateCode(bytes(16, (i) => i * 7))!;
    expect(c).toMatch(/^[23456789ABCDEFGHJKMNPQRSTWXYZ]{5}-[23456789ABCDEFGHJKMNPQRSTWXYZ]{5}$/);
  });
  it("skips bytes that would make some letters more likely", () => {
    const limit = 256 - (256 % CODE_ALPHABET.length);
    expect(makeCertificateCode(bytes(10, () => limit))).toBeNull();
  });
  it("reads a code typed in lower case, with spaces or without the dash", () => {
    expect(normalizeCode(" 7k3mq 9txwa ")).toBe("7K3MQ-9TXWA");
    expect(normalizeCode("7K3MQ9TXWA")).toBe("7K3MQ-9TXWA");
    expect(normalizeCode("7K3MQ-9TXW")).toBeNull();
    expect(normalizeCode("OOOOO-11111")).toBeNull();
  });
});

describe("checkCertificateName", () => {
  it("tidies spaces, keeps Urdu, refuses empty or very long names", () => {
    expect(checkCertificateName("  Ayesha   Khan ")).toEqual({ name: "Ayesha Khan" });
    expect(checkCertificateName("عائشہ خان")).toEqual({ name: "عائشہ خان" });
    expect(checkCertificateName(" ")).toHaveProperty("error");
    expect(checkCertificateName("x".repeat(81))).toHaveProperty("error");
  });
});

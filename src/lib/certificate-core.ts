// Certificates (Step 5, feature 2), pure and tested in certificate-core.test.ts: who is ready for one,
// and the public check codes.

export type CertStage = { id: string; title: string; optional: boolean; choiceGroup: string | null };
export type CertSignoff = { stageId: string; passed: boolean; signedAt: Date };

/**
 * Ready for a certificate when every required stage is signed off as passed, and one stage of each
 * pick-one group (choiceGroup, e.g. "Lane A / B / C") is passed. Optional stages outside a group are
 * extras and never needed. `missing` says what is left, in roadmap order. `completedOn` is the day of
 * the last pass that counted (YYYY-MM-DD, UTC).
 */
export function certificateReady(stages: CertStage[], signoffs: CertSignoff[]) {
  const passed = new Map(signoffs.filter((s) => s.passed).map((s) => [s.stageId, s.signedAt]));
  // What a certificate needs, in roadmap order: each required stage, and each pick-one group once.
  const needs: ({ stage: CertStage } | { group: CertStage[] })[] = [];
  const groups = new Map<string, CertStage[]>();
  for (const s of stages) {
    if (s.choiceGroup) {
      if (!groups.has(s.choiceGroup)) needs.push({ group: groups.set(s.choiceGroup, []).get(s.choiceGroup)! });
      groups.get(s.choiceGroup)!.push(s);
    } else if (!s.optional) needs.push({ stage: s });
  }
  const missing: string[] = [];
  const counted: Date[] = [];
  for (const n of needs) {
    const options = "stage" in n ? [n.stage] : n.group;
    const first = options.map((o) => passed.get(o.id)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
    if (first) counted.push(first);
    else missing.push("stage" in n ? n.stage.title : `One of: ${n.group.map((o) => o.title).join(", ")}`);
  }
  const last = counted.sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    ready: missing.length === 0 && counted.length > 0,
    missing,
    completedOn: last ? last.toISOString().slice(0, 10) : null,
  };
}

// ---------- Check codes ----------

/** No 0/O, 1/I/L or U/V, so a code read aloud or copied by hand can't be mistyped into another one. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";
const CODE_LENGTH = 10;

/** A code like "7K3MQ-9TXWA" from random bytes (29^10 ≈ 4 × 10^14 possibilities). */
export function makeCertificateCode(randomBytes: Uint8Array) {
  if (randomBytes.length < CODE_LENGTH) throw new Error("need 10 random bytes");
  let s = "";
  // Rejection sampling keeps every letter equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  for (const b of randomBytes) {
    if (b >= limit) continue;
    s += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (s.length === CODE_LENGTH) break;
  }
  if (s.length < CODE_LENGTH) return null; // caller tries again with fresh bytes
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

/** What someone typed or scanned → the stored form, or null if it can't be a code. */
export function normalizeCode(input: string) {
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== CODE_LENGTH || [...s].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

/** The name as it will be printed. */
export function checkCertificateName(raw: string): { name: string } | { error: string } {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { error: "Enter the student's full name as it should be printed." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };
  return { name };
}

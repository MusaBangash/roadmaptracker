// Story 9: every server action and every download route checks who is asking (school, role, cohort)
// BEFORE it reads or writes any data. The rules themselves are tested in access-core / security-core
// tests; this test makes sure no action or route forgets to call them, now or in future changes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const GUARD = /\b(requireUser|requireRole|requireTeachableCohort|requireTeachableEnrollment|requireOwnEnrollment|requireEditableTrack|requireVisibleTrack|changeDraft|requireCommentAccess)\(/;
const DATA = /\b(db|tx)\s*[.]/;

/** Actions anyone may call: they sign in or out, or check a one-time secret themselves. */
const PUBLIC_ACTIONS = new Set(["loginAction", "googleAction", "registerAction", "logoutAction", "switchOrgAction", "resetPasswordAction", "setLocaleAction"]);
/** Routes open to everyone, with no school data in them. */
const PUBLIC_ROUTES = new Set(["src/app/api/health/route.ts"]);

/** Each `export async function name(...) { body }` in a file, with its body. */
function exportedFunctions(src: string) {
  const out: { name: string; body: string }[] = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  for (let m; (m = re.exec(src)); ) {
    const start = bodyStart(src, m.index);
    let depth = 0, j = start;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    out.push({ name: m[1], body: src.slice(start, j + 1) });
  }
  return out;
}

/** The "{" that opens a function body: the first "{" after the parameter list's closing ")" at depth 0
 *  that is followed by a newline (return types like Promise<{ a: string }> stay on one line). */
function bodyStart(src: string, from: number) {
  let depth = 0;
  let i = src.indexOf("(", from);
  for (; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) break;
  }
  const open = /\{\s*\n/g;
  open.lastIndex = i;
  return open.exec(src)!.index;
}

function filesUnder(dir: string, name: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p, name) : name.test(f) ? [p] : [];
  });
}

function guardedBeforeData(body: string) {
  const g = body.search(GUARD);
  const d = body.search(DATA);
  return g >= 0 && (d < 0 || g < d);
}

describe("every server action checks access before touching data", () => {
  const dir = path.join(ROOT, "src", "app", "actions");
  const actions = readdirSync(dir).filter((f) => f.endsWith(".ts")).flatMap((f) => {
    const src = readFileSync(path.join(dir, f), "utf8");
    expect(src.trimStart().startsWith('"use server"'), `${f} is a server-actions file`).toBe(true);
    return exportedFunctions(src).map((fn) => ({ file: f, ...fn }));
  });

  it("finds the actions", () => expect(actions.length).toBeGreaterThan(25));
  for (const a of actions) {
    if (PUBLIC_ACTIONS.has(a.name)) continue;
    it(`${a.file}: ${a.name}`, () => expect(guardedBeforeData(a.body), `${a.name} must call a require…() check before using the database`).toBe(true));
  }
  it("exports nothing from server-action files except async functions and types", () => {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(path.join(dir, f), "utf8");
      const bad = [...src.matchAll(/^export\s+(?!async function|type\b|interface\b)(\w+\s+\w+)/gm)].map((m) => m[1]);
      expect(bad, `${f} exports something a browser could call or that breaks "use server"`).toEqual([]);
    }
  });
});

describe("every download route checks access before touching data", () => {
  const routes = filesUnder(path.join(ROOT, "src", "app"), /^route\.ts$/)
    .map((p) => path.relative(ROOT, p).split(path.sep).join("/"))
    .filter((p) => !p.startsWith("src/app/api/auth/"));
  it("finds the routes", () => expect(routes.length).toBeGreaterThanOrEqual(4));
  for (const r of routes) {
    if (PUBLIC_ROUTES.has(r)) continue;
    it(r, () => {
      const get = exportedFunctions(readFileSync(path.join(ROOT, r), "utf8")).find((f) => f.name === "GET");
      expect(get, `${r} has a GET`).toBeTruthy();
      expect(guardedBeforeData(get!.body), `${r} must call a require…() check before using the database`).toBe(true);
    });
  }
});

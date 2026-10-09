import { describe, expect, it } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en, type MessageKey } from "./en";
import { ur } from "./ur";
import { dirOf, fill, isLocale, message, placeholders, translator } from "./core";

const keys = Object.keys(en) as MessageKey[];

describe("the Urdu file", () => {
  it("translates every English sentence (a new English sentence needs its Urdu too)", () => {
    expect(keys.filter((k) => !ur[k]?.trim())).toEqual([]);
  });
  it("has no keys the English doesn't have", () => {
    expect(Object.keys(ur).filter((k) => !(k in en))).toEqual([]);
  });
  it("keeps every {word} and <tag> of the English", () => {
    const wrong = keys.filter((k) => ur[k] && JSON.stringify(placeholders(ur[k]!)) !== JSON.stringify(placeholders(en[k])));
    expect(wrong).toEqual([]);
  });
  it("closes every <tag> it opens", () => {
    const open = (s: string) => [...s.matchAll(/<(\w+)>/g)].length === [...s.matchAll(/<\/(\w+)>/g)].length;
    expect(keys.filter((k) => !open(en[k]) || (ur[k] && !open(ur[k]!)))).toEqual([]);
  });
  it("singular and plural come in pairs", () => {
    const ones = keys.filter((k) => k.endsWith(".one"));
    expect(ones.filter((k) => !keys.includes(k.replace(/\.one$/, ".other") as MessageKey))).toEqual([]);
  });
});

describe("translator", () => {
  const t = translator("ur");
  it("Urdu sentence with its {words} filled in, each kept in its own direction", () => {
    expect(t("dash.hello", { name: "Ayesha" })).toBe("السلام علیکم، \u2068Ayesha\u2069");
    expect(translator("en")("dash.hello", { name: "Ayesha" })).toBe("Assalam-o-Alaikum, Ayesha");
  });
  it("English when a sentence is missing, never blank", () => {
    expect(message("ur", "nav.dashboard")).toBe("ڈیش بورڈ");
    expect(fill("Hi {name}, {x}", { name: "A" })).toBe("Hi A, {x}");
  });
  it("singular and plural", () => {
    expect(translator("en").plural("common.week", 1)).toBe("1 week");
    expect(translator("en").plural("common.week", 3)).toBe("3 weeks");
    expect(t.plural("common.week", 3)).toBe("\u20683\u2069 ہفتے");
  });
  it("turns <b> and <link> into elements", () => {
    const node = translator("en").rich("cert.help", { b: (s) => createElement("b", null, s), link: (s) => createElement("a", { href: "/verify/X" }, s) });
    expect(isValidElement(node)).toBe(true);
    expect(renderToStaticMarkup(node as ReactElement)).toBe('<b>Download PDF</b> opens the print window: choose <b>Save as PDF</b>. Anyone can check it is genuine by scanning the QR code or opening <a href="/verify/X">the check page</a>.');
  });
  it("dates: Urdu month names with digits 0–9; calendar days never shift", () => {
    expect(t.date("2026-10-14")).toBe("14 اکتوبر، 2026");
    expect(translator("en").date("2026-10-14")).toBe("14 Oct 2026");
    expect(t.dateTime(new Date("2026-10-10T07:05:00Z"))).toMatch(/^10 .+ 2026.* 12:05$/);
  });
  it("language and direction", () => {
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(dirOf("ur")).toBe("rtl");
    expect(t.dir).toBe("rtl");
  });
});

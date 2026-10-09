// The app in English or Urdu (feature 5): picks a sentence, fills in {words}, turns <b>/<link> into
// elements, and formats dates. Pure and tested (core.test.ts). No library: two small dictionaries.
import { Fragment, createElement, type ReactNode } from "react";
import { en, type MessageKey } from "./en";
import { ur } from "./ur";
import { fmtDate } from "@/lib/utils";

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];
export const LANG_COOKIE = "noorai-lang";
export const isLocale = (v: unknown): v is Locale => v === "en" || v === "ur";
export const dirOf = (l: Locale) => (l === "ur" ? "rtl" : "ltr");

export const DICTIONARIES: Record<Locale, Partial<Record<MessageKey, string>>> = { en, ur };
export type Vars = Record<string, string | number>;
/** Keys that have a singular and a plural: "learn.itemsVerified" for learn.itemsVerified.one / .other. */
export type PluralKey = { [K in MessageKey]: K extends `${infer B}.one` ? B : never }[MessageKey];

/** The sentence in this language, else the English one: never blank. */
export function message(locale: Locale, key: MessageKey) {
  return DICTIONARIES[locale][key] || en[key];
}

const FSI = String.fromCharCode(0x2068); // first-strong isolate
const PDI = String.fromCharCode(0x2069); // pop directional isolate

export function fill(s: string, vars?: Vars, isolate = false) {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (vars && k in vars ? (isolate ? `${FSI}${vars[k]}${PDI}` : String(vars[k])) : m));
}

/** In Urdu, each filled-in word (a name, a number, an English title) is a bidi isolate (U+2068 … U+2069),
 *  so "مرحلہ 3 · Prompt engineering" keeps its order instead of the browser regrouping the pieces. */
const ISOLATE: Record<Locale, boolean> = { en: false, ur: true };

/** The {words} and <tags> in a sentence, for checking a translation against the English. */
export function placeholders(s: string) {
  const words = [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const tags = [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
  return { words, tags };
}

const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", ur: "ur-PK-u-nu-latn" }; // Urdu month names, digits 0–9

export function translator(locale: Locale) {
  const t = (key: MessageKey, vars?: Vars) => fill(message(locale, key), vars, ISOLATE[locale]);
  return Object.assign(t, {
    locale,
    dir: dirOf(locale),
    /** Singular or plural; {n} is the number. */
    plural: (key: PluralKey, n: number, vars?: Vars) =>
      fill(message(locale, `${key}.${n === 1 ? "one" : "other"}` as MessageKey), { n, ...vars }, ISOLATE[locale]),
    /** A sentence with <b>bold</b> or <link>…</link> parts: each tag becomes what `tags` makes of its text. */
    rich: (key: MessageKey, tags: Record<string, (text: string) => ReactNode>, vars?: Vars): ReactNode => {
      const s = t(key, vars);
      const out: ReactNode[] = [];
      const re = /<(\w+)>(.*?)<\/\1>/g;
      let last = 0;
      for (let m; (m = re.exec(s)); ) {
        if (m.index > last) out.push(s.slice(last, m.index));
        const make = tags[m[1]];
        out.push(make ? createElement(Fragment, { key: out.length }, make(m[2])) : m[2]);
        last = m.index + m[0].length;
      }
      if (last < s.length) out.push(s.slice(last));
      return createElement(Fragment, null, ...out);
    },
    /** "10 Oct 2026" / "10 اکتوبر، 2026". A day with no time ("2026-10-14") is a calendar day (UTC). */
    date: (d: Date | string | null | undefined) => {
      if (locale === "en" || !d) return fmtDate(d);
      const dayOnly = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
      return new Date(d).toLocaleDateString(DATE_LOCALE.ur, { day: "numeric", month: "long", year: "numeric", ...(dayOnly ? { timeZone: "UTC" } : {}) });
    },
    /** A moment in Pakistan time, 24-hour clock. */
    dateTime: (d: Date) => new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(d),
  });
}

export type T = ReturnType<typeof translator>;

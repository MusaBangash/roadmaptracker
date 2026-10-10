import "server-only";
import { cache } from "react";
import { translator, type Locale, type T } from "./core";
import { en, type MessageKey } from "./en";

/**
 * The interface language. Urdu was switched off on 2026-10-10 (Musa: not needed), so this is always
 * English; ur.ts, user.locale and the cookie are kept unused in case it is ever wanted again.
 */
export const getLocale = cache(async (): Promise<Locale> => "en");

/** A form check's message (zod schemas use dictionary keys as messages) in the person's language. */
export function issueText(t: T, message: string | undefined): string {
  return message && message in en ? t(message as MessageKey) : t("err.checkForm");
}

/** `t("key")` for server pages and actions. */
export async function getT() {
  return translator(await getLocale());
}

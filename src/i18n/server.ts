import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getUser } from "@/lib/access";
import { LANG_COOKIE, isLocale, translator, type Locale, type T } from "./core";
import { en, type MessageKey } from "./en";

/** The person's language: their saved choice when signed in (every device), else this browser's, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const user = await getUser();
  if (user && isLocale(user.locale)) return user.locale;
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(saved) ? saved : "en";
});

/** A form check's message (zod schemas use dictionary keys as messages) in the person's language. */
export function issueText(t: T, message: string | undefined): string {
  return message && message in en ? t(message as MessageKey) : t("err.checkForm");
}

/** `t("key")` for server pages and actions. */
export async function getT() {
  return translator(await getLocale());
}

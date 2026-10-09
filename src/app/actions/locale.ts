"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser } from "@/lib/access";
import { LANG_COOKIE, isLocale } from "@/i18n/core";

/** Story 1: switch the interface language. Anyone may (the sign-in page has the switch too);
 *  a signed-in person's choice is also saved on their account, so every device follows it. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  const user = await getUser();
  if (user) await db.update(schema.users).set({ locale }).where(eq(schema.users.id, user.id));
}

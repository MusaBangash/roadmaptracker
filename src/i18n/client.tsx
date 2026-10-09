"use client";

import { createContext, useContext, useMemo } from "react";
import { translator, type Locale } from "./core";

const LocaleContext = createContext<Locale>("en");

/** Set once in the root layout: every client component below can call useT(). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** `t("key")` for client components. */
export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(() => translator(locale), [locale]);
}

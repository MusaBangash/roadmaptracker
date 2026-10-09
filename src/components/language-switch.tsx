"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/app/actions/locale";
import { useT } from "@/i18n/client";
import type { Locale } from "@/i18n/core";
import styles from "./switch.module.css";

// Each language is written in itself, so anyone can find their own.
const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
];

/** Story 1: English | اردو. The page redraws in the chosen language at once. */
export function LanguageSwitch() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={styles.group} role="group" aria-label={t("lang.label")} aria-busy={pending}>
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" lang={o.value} dir={o.value === "ur" ? "rtl" : "ltr"} className={styles.option}
          aria-pressed={t.locale === o.value} disabled={pending}
          onClick={() => start(async () => { await setLocaleAction(o.value); router.refresh(); })}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useT } from "@/i18n/client";

/** Story 8: any page that breaks shows this instead of a blank or technical screen. The reference
 *  is the same one written in the server log, so we can find what went wrong. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card p-6 sm:p-8" role="alert">
        <p className="mb-2 flex items-center gap-2 font-semibold text-danger"><Icon name="error" size={20} />{t("error.wrong")}</p>
        <h1 className="h2 mb-2">{t("error.title")}</h1>
        <p className="mb-4 text-sm text-ink-muted">
          {t("error.sub")}
        </p>
        {error.digest && <p className="mb-4 rounded-md bg-surface-sunken px-3 py-2 font-mono text-sm">{t("error.reference", { ref: error.digest })}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => reset()}><Icon name="restore" size={18} />{t("common.tryAgain")}</button>
          <Link href="/dashboard" className="btn-ghost"><Icon name="home" size={18} />{t("common.goDashboard")}</Link>
        </div>
      </div>
    </main>
  );
}

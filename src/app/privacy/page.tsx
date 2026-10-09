import Link from "next/link";
import { Logo } from "@/components/logo";
import { LanguageSwitch } from "@/components/language-switch";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/en";

export const metadata = { title: "Privacy notice" };

/** Story 7: what NoorAI Tracks stores, why, who sees it, and how to get it deleted. Public page, English or Urdu. */
export default async function PrivacyPage() {
  const t = await getT();
  const b = (s: string) => <b>{s}</b>;
  const list = (keys: MessageKey[]) => (
    <ul className="list-disc space-y-1 ps-5">{keys.map((k) => <li key={k}>{t.rich(k, { b })}</li>)}</ul>
  );
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-block"><Logo size={36} product="Tracks" /></Link>
        <LanguageSwitch />
      </div>
      <h1 className="h1 mb-2">{t("privacy.title")}</h1>
      <p className="mb-8 text-ink-muted">{t("privacy.intro")}</p>

      <div className="space-y-6 text-[0.95rem] leading-relaxed">
        <section>
          <h2 className="h2 mb-2">{t("privacy.keepTitle")}</h2>
          {list(["privacy.keep1", "privacy.keep2", "privacy.keep3", "privacy.keep4", "privacy.keep5"])}
          <p className="mt-2">{t("privacy.noSell")}</p>
        </section>
        <section>
          <h2 className="h2 mb-2">{t("privacy.whoTitle")}</h2>
          {list(["privacy.who1", "privacy.who2", "privacy.who3", "privacy.who4"])}
        </section>
        <section>
          <h2 className="h2 mb-2">{t("privacy.whereTitle")}</h2>
          <p>{t("privacy.where")}</p>
        </section>
        <section>
          <h2 className="h2 mb-2">{t("privacy.howLongTitle")}</h2>
          {list(["privacy.long1", "privacy.long2", "privacy.long3"])}
        </section>
      </div>
      <p className="mt-10 text-sm text-ink-muted"><Link href="/login" className="text-secondary underline">{t("privacy.back")}</Link></p>
    </main>
  );
}

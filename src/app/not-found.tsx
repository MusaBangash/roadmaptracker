import Link from "next/link";
import { Icon } from "@/components/icon";
import { getT } from "@/i18n/server";

/** Story 8: a missing page, or one you are not allowed to see (we never say which). */
export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card p-6 sm:p-8">
        <h1 className="h2 mb-2">{t("notFound.title")}</h1>
        <p className="mb-4 text-sm text-ink-muted">{t("notFound.sub")}</p>
        <Link href="/dashboard" className="btn-primary"><Icon name="home" size={18} />{t("common.goDashboard")}</Link>
      </div>
    </main>
  );
}

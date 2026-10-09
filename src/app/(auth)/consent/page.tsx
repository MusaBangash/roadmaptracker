import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { ConsentForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Privacy notice" };

/** Story 7: shown once to anyone who hasn't agreed to the Privacy notice yet. */
export default async function ConsentPage() {
  const user = await requireUser();
  if (user.consentAt) redirect("/dashboard");
  const t = await getT();
  return (
    <>
      <h1 className="h2 mb-1">{t("consent.title")}</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {t("consent.sub")}
      </p>
      <ConsentForm />
    </>
  );
}

import { requireUser } from "@/lib/access";
import { JoinForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Join a school" };

export default async function JoinPage() {
  await requireUser();
  const t = await getT();
  return (
    <>
      <h1 className="h2 mb-1">{t("join.title")}</h1>
      <p className="mb-6 text-sm text-ink-muted">{t("join.sub")}</p>
      <JoinForm />
    </>
  );
}

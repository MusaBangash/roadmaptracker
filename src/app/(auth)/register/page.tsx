import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { googleEnabled } from "@/auth";
import { RegisterForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/dashboard" } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  const t = await getT();
  return (
    <>
      <h1 className="h2 mb-1">{t("register.title")}</h1>
      <p className="mb-6 text-sm text-ink-muted">{t("register.sub")}</p>
      <RegisterForm next={next} google={googleEnabled} />
    </>
  );
}

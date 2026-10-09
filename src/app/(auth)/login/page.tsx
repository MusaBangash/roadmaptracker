import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { googleEnabled } from "@/auth";
import { LoginForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const { next = "/dashboard", error, reset } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  const t = await getT();
  return (
    <>
      <h1 className="h2 mb-1">{t("login.title")}</h1>
      <p className="mb-6 text-sm text-ink-muted">{t("login.sub")}</p>
      {reset && <p role="status" className="mb-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success">{t("login.resetDone")}</p>}
      {error && <p className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t("login.error")}</p>}
      <LoginForm next={next} google={googleEnabled} />
    </>
  );
}

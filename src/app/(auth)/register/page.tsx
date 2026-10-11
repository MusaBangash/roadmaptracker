import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { googleEnabled } from "@/auth";
import { RegisterForm } from "@/components/auth-forms";
import { signupInvite } from "@/lib/invites";
import { getT } from "@/i18n/server";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/dashboard" } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  const t = await getT();
  // Sign-up is by invite only: the form shows only on the way back to a usable invite link.
  if (!(await signupInvite(next))) {
    return (
      <>
        <h1 className="h2 mb-1">{t("register.inviteOnlyTitle")}</h1>
        <p className="mb-6 text-sm text-ink-muted">{t("err.inviteOnly")}</p>
        <Link href="/login" className="btn-primary w-full">{t("auth.signIn")}</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="h2 mb-1">{t("register.title")}</h1>
      <p className="mb-6 text-sm text-ink-muted">{t("register.sub")}</p>
      <RegisterForm next={next} google={googleEnabled} />
    </>
  );
}

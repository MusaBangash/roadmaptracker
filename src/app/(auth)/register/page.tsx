import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { googleEnabled } from "@/auth";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/dashboard" } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  return (
    <>
      <h1 className="h2 mb-1">Create your account</h1>
      <p className="mb-6 text-sm text-ink-muted">If your instructor gave you an invite link, open it after signing up — or it will bring you back here.</p>
      <RegisterForm next={next} google={googleEnabled} />
    </>
  );
}

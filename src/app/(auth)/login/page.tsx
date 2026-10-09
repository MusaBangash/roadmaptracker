import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { googleEnabled } from "@/auth";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const { next = "/dashboard", error, reset } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  return (
    <>
      <h1 className="h2 mb-1">Sign in</h1>
      <p className="mb-6 text-sm text-ink-muted">Track your roadmap, your projects and your sign-offs.</p>
      {reset && <p role="status" className="mb-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success">Your password is changed. Sign in with your new password.</p>}
      {error && <p className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">Sign-in didn&apos;t complete. Please try again.</p>}
      <LoginForm next={next} google={googleEnabled} />
    </>
  );
}

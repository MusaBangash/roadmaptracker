import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { Logo } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { savedTheme } from "@/lib/theme-server";

export default async function Home() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Logo size={40} product="Tracks" />
        <Link href="/login" className="btn-ghost">Sign in</Link>
      </header>
      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="label text-highlight-text">Roadmaps · progress · sign-offs</p>
        <h1 className="mt-2 max-w-2xl text-ink [font:var(--text-heading-1)] sm:[font:var(--text-display)]">
          Every student&apos;s roadmap, in one place — not on paper.
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-muted">
          Students tick what they&apos;ve learned and attach proof. Instructors verify projects, sign off stages and score defenses.
          Schools see every cohort at a glance — and who needs help.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn-primary">Sign in</Link>
          <span className="text-sm text-ink-muted">New here? Open the invite link your school sent you.</span>
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">NoorAI — learning for everyone.<ThemeSwitch initial={await savedTheme()} /></footer>
    </main>
  );
}

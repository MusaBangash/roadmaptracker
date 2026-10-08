import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { Logo } from "@/components/ui";

export default async function Home() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/login" className="btn-ghost">Sign in</Link>
      </header>
      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="label text-saffron-ink">Roadmaps · progress · sign-offs</p>
        <h1 className="mt-2 max-w-2xl font-serif text-4xl font-medium leading-tight text-text sm:text-5xl">
          Every student&apos;s roadmap, in one place — not on paper.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Students tick what they&apos;ve learned and attach proof. Instructors verify projects, sign off stages and score defenses.
          Schools see every cohort at a glance — and who needs help.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary">Create an account</Link>
          <Link href="/login" className="btn-ghost">Sign in</Link>
        </div>
      </section>
      <footer className="text-xs text-muted">NoorAI — learning for everyone.</footer>
    </main>
  );
}

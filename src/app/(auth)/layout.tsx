import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { savedTheme } from "@/lib/theme-server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 self-center"><Logo size={40} product="Tracks" /></Link>
      <div className="card p-6 sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-ink-muted">Part of NoorAI — learning for everyone.</p>
      <div className="mt-4 self-center"><ThemeSwitch initial={await savedTheme()} /></div>
    </main>
  );
}

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { savedTheme } from "@/lib/theme-server";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 self-center"><Logo size={40} product="Tracks" /></Link>
      <div className="card p-6 sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-ink-muted">{t("footer.partOf")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2"><ThemeSwitch initial={await savedTheme()} /></div>
    </main>
  );
}

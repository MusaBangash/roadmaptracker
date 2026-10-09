import Link from "next/link";
import { Icon } from "@/components/icon";

/** Story 8: a missing page, or one you are not allowed to see (we never say which). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card p-6 sm:p-8">
        <h1 className="h2 mb-2">Page not found</h1>
        <p className="mb-4 text-sm text-ink-muted">This page doesn&apos;t exist, or it belongs to a school or class you are not part of. Check the link, or go back to your dashboard.</p>
        <Link href="/dashboard" className="btn-primary"><Icon name="home" size={18} />Go to dashboard</Link>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

/** Story 8: any page that breaks shows this instead of a blank or technical screen. The reference
 *  is the same one written in the server log, so we can find what went wrong. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card p-6 sm:p-8" role="alert">
        <p className="mb-2 flex items-center gap-2 font-semibold text-danger"><Icon name="error" size={20} />Something went wrong</p>
        <h1 className="h2 mb-2">This page didn&apos;t load</h1>
        <p className="mb-4 text-sm text-ink-muted">
          Nothing you saved before this was lost. Try again in a moment. If it keeps happening, send this reference to your school admin or NoorAI support.
        </p>
        {error.digest && <p className="mb-4 rounded-md bg-surface-sunken px-3 py-2 font-mono text-sm">Reference: {error.digest}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => reset()}><Icon name="restore" size={18} />Try again</button>
          <Link href="/dashboard" className="btn-ghost"><Icon name="home" size={18} />Go to dashboard</Link>
        </div>
      </div>
    </main>
  );
}

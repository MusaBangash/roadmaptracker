"use client";

import "./globals.css";

/** Story 8: the last safety net, when even the main layout fails. It replaces the whole page, so it can't
 *  know the language: it says the main words in English and in Urdu. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
          <div className="card p-6 sm:p-8" role="alert">
            <h1 className="h2 mb-2">Something went wrong</h1>
            <p lang="ur" dir="rtl" className="mb-2">کچھ غلط ہو گیا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔</p>
            <p className="mb-4 text-sm text-ink-muted">NoorAI Tracks couldn&apos;t load. Try again in a moment. If it keeps happening, send this reference to NoorAI support.</p>
            {error.digest && <p className="mb-4 rounded-md bg-surface-sunken px-3 py-2 font-mono text-sm">Reference: {error.digest}</p>}
            <button type="button" className="btn-primary" onClick={() => reset()}>Try again · دوبارہ کوشش کریں</button>
          </div>
        </main>
      </body>
    </html>
  );
}

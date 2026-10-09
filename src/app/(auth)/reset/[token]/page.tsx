import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/reset";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Choose a new password" };

/** Story 2: the page behind a one-time reset link made by a school admin. */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db.select({ email: schema.users.email, hasPassword: schema.users.passwordHash }).from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(and(eq(schema.passwordResets.tokenHash, hashToken(token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    return (
      <>
        <h1 className="h2 mb-1">This link doesn&apos;t work any more</h1>
        <p className="mb-6 text-sm text-ink-muted">These links work only once, and only for a limited time. Ask your teacher or school admin for a new one.</p>
        <Link href="/login" className="btn-primary w-full">Go to sign in</Link>
      </>
    );
  }
  return (
    <>
      {/* A student added from a file has no password yet: this is their first sign-in. */}
      <h1 className="h2 mb-1">{row.hasPassword ? "Choose a new password" : "Welcome! Set your password"}</h1>
      <p className="mb-6 text-sm text-ink-muted">
        For <b className="text-ink">{row.email}</b>. {row.hasPassword ? "After this, you are signed out everywhere else." : "You will use it with this email to sign in to NoorAI Tracks."}
      </p>
      <ResetPasswordForm token={token} />
    </>
  );
}

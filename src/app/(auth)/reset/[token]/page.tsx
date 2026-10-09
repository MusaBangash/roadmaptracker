import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/reset";
import { ResetPasswordForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Choose a new password" };

/** Story 2: the page behind a one-time reset link made by a school admin. */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getT();
  const [row] = await db.select({ email: schema.users.email, hasPassword: schema.users.passwordHash }).from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(and(eq(schema.passwordResets.tokenHash, hashToken(token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    return (
      <>
        <h1 className="h2 mb-1">{t("reset.dead")}</h1>
        <p className="mb-6 text-sm text-ink-muted">{t("reset.deadSub")}</p>
        <Link href="/login" className="btn-primary w-full">{t("reset.goSignIn")}</Link>
      </>
    );
  }
  return (
    <>
      {/* A student added from a file has no password yet: this is their first sign-in. */}
      <h1 className="h2 mb-1">{row.hasPassword ? t("reset.title") : t("reset.welcome")}</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {t.rich("reset.forEmail", { b: (s) => <b className="text-ink" lang="en">{s}</b> }, { email: row.email ?? "" })} {row.hasPassword ? t("reset.signedOutElsewhere") : t("reset.firstTime")}
      </p>
      <ResetPasswordForm token={token} />
    </>
  );
}

import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser } from "@/lib/access";
import { JoinForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Join" };


export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await db.query.invites.findFirst({ where: eq(schema.invites.code, code.toLowerCase()) });
  const t = await getT();
  const b = (s: string) => <b className="text-ink">{s}</b>;
  if (!invite) {
    return (<><h1 className="h2 mb-2">{t("invite.notFound")}</h1><p className="text-sm text-ink-muted">{t.rich("invite.notFoundSub", { link: (s) => <Link href="/join" className="text-primary">{s}</Link> })}</p></>);
  }
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, invite.orgId) });
  const cohort = invite.cohortId ? await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, invite.cohortId) }) : null;
  const user = await getUser();
  const next = `/join/${code}`;
  return (
    <>
      <p className="label">{t("invite.label")}</p>
      <h1 className="h2 mb-2">{t("invite.joinSchool", { school: org?.name ?? "" })}</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {cohort ? t.rich(`invite.asIn.${invite.role}`, { b }, { cohort: cohort.name }) : t(`invite.as.${invite.role}`)}
      </p>
      {user ? (
        <>
          <p className="mb-3 text-sm">{t.rich("invite.signedInAs", { b: (s) => <b lang="en">{s}</b> }, { email: user.email ?? "" })}</p>
          <JoinForm code={code} />
        </>
      ) : (
        <div className="grid gap-2">
          <Link className="btn-primary" href={`/register?next=${encodeURIComponent(next)}`}>{t("auth.createAccount")}</Link>
          <Link className="btn-ghost" href={`/login?next=${encodeURIComponent(next)}`}>{t("invite.haveAccount")}</Link>
        </div>
      )}
    </>
  );
}

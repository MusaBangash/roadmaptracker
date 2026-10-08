import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser } from "@/lib/access";
import { JoinForm } from "@/components/auth-forms";

export const metadata = { title: "Join" };

const ROLE_LABEL = { ADMIN: "an admin", INSTRUCTOR: "an instructor", STUDENT: "a student" } as const;

export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await db.query.invites.findFirst({ where: eq(schema.invites.code, code.toLowerCase()) });
  if (!invite) {
    return (<><h1 className="h2 mb-2">Invite not found</h1><p className="text-sm text-muted">Check the link with your instructor, or <Link href="/join" className="text-forest">enter a code</Link>.</p></>);
  }
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, invite.orgId) });
  const cohort = invite.cohortId ? await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, invite.cohortId) }) : null;
  const user = await getUser();
  const next = `/join/${code}`;
  return (
    <>
      <p className="label">Invitation</p>
      <h1 className="h2 mb-2">Join {org?.name}</h1>
      <p className="mb-6 text-sm text-muted">
        You&apos;re invited as {ROLE_LABEL[invite.role]}{cohort ? <> in <b className="text-text">{cohort.name}</b></> : null}.
      </p>
      {user ? (
        <>
          <p className="mb-3 text-sm">Signed in as <b>{user.email}</b>.</p>
          <JoinForm code={code} />
        </>
      ) : (
        <div className="grid gap-2">
          <Link className="btn-primary" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
          <Link className="btn-ghost" href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
        </div>
      )}
    </>
  );
}

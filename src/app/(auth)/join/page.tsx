import { requireUser } from "@/lib/access";
import { JoinForm } from "@/components/auth-forms";

export const metadata = { title: "Join a school" };

export default async function JoinPage() {
  await requireUser();
  return (
    <>
      <h1 className="h2 mb-1">Join with an invite code</h1>
      <p className="mb-6 text-sm text-ink-muted">Your instructor or school admin can give you a code or a link.</p>
      <JoinForm />
    </>
  );
}

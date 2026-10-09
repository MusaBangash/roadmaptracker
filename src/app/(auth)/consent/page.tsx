import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { ConsentForm } from "@/components/auth-forms";

export const metadata = { title: "Privacy notice" };

/** Story 7: shown once to anyone who hasn't agreed to the Privacy notice yet. */
export default async function ConsentPage() {
  const user = await requireUser();
  if (user.consentAt) redirect("/dashboard");
  return (
    <>
      <h1 className="h2 mb-1">Before you continue</h1>
      <p className="mb-6 text-sm text-ink-muted">
        NoorAI Tracks keeps your name, email and learning progress so your school can follow it. Please read the Privacy notice and agree.
      </p>
      <ConsentForm />
    </>
  );
}

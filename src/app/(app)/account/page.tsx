import { requireUser } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { MyNameForm, MyPasswordForm } from "@/components/account-forms";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const { saved } = await searchParams;
  return (
    <>
      <PageHeader title="My account" sub={<span lang="en" dir="ltr">{user.email}</span>} />
      {saved === "password" && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Icon name="check" size={18} />Your password is changed. Every other phone or computer is now signed out.
        </p>
      )}
      <div className="grid max-w-2xl gap-6">
        <MyNameForm name={user.name ?? ""} />
        <MyPasswordForm hasPassword={!!user.passwordHash} />
        <p className="text-sm text-ink-muted">Your email is how you sign in, so it can&apos;t be changed here. If it needs to change, ask your school&apos;s admin.</p>
      </div>
    </>
  );
}

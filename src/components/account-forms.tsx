"use client";

import { useActionState } from "react";
import { changeMyPasswordAction, updateMyNameAction } from "@/app/actions/account";
import { FormError } from "@/components/ui";

function Saved({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{message}</p>;
}

export function MyNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateMyNameAction, undefined);
  return (
    <form action={action} className="card grid gap-3 p-5">
      <h2 className="h2">Your name</h2>
      <p className="text-sm text-ink-muted">Shown to your teachers and classmates. Certificates already issued keep the name printed on them.</p>
      <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" required defaultValue={name} dir="auto" autoComplete="name" className="input" /></div>
      <FormError message={state?.error} />
      <Saved message={state?.ok} />
      <div><button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save name"}</button></div>
    </form>
  );
}

export function MyPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changeMyPasswordAction, undefined);
  return (
    <form action={action} className="card grid gap-3 p-5">
      <h2 className="h2">{hasPassword ? "Change password" : "Set a password"}</h2>
      <p className="text-sm text-ink-muted">
        {hasPassword ? "After the change, you stay signed in here and every other phone or computer is signed out." : "Then you can also sign in with your email and this password."}
      </p>
      {hasPassword && (
        <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" dir="ltr" className="input" /></div>
      )}
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="input" />
        <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
      </div>
      <div><label className="label" htmlFor="confirm">Type the new password again</label><input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="input" /></div>
      <FormError message={state?.error} />
      <Saved message={state?.ok} />
      <div><button className="btn-primary" disabled={pending}>{pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button></div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { createResetLinkAction, deletePersonAction } from "@/app/actions/admin";
import { CopyButton } from "@/components/copy-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { resetMessage } from "@/lib/whatsapp";
import { FormError } from "@/components/ui";
import { Icon } from "@/components/icon";

/** Story 2: make a one-time reset link and show it once, to send by WhatsApp. */
export function ResetLinkForm({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(createResetLinkAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-ink-muted">A link that lets {name} choose a new password. It works once, for 1 hour, and signs them out everywhere else.</p>
      {state?.ok ? (
        <div className="grid gap-2 rounded-md bg-success-soft p-3 text-sm">
          <span className="font-semibold text-success">Send this link to {name} (for example on WhatsApp). It is shown only now.</span>
          <code className="break-all font-mono text-xs">{state.ok}</code>
          <div className="flex flex-wrap gap-2"><CopyButton text={state.ok} /><WhatsAppButton text={resetMessage(state.ok)} /></div>
        </div>
      ) : (
        <div><button className="btn-ghost" disabled={pending}><Icon name="key" size={18} />{pending ? "Making link…" : "Make reset link"}</button></div>
      )}
      <FormError message={state?.error} />
    </form>
  );
}

/** Story 7: permanently delete a person's data. The admin types the email to confirm. */
export function DeletePersonForm({ userId, email, name }: { userId: string; email: string; name: string }) {
  const [state, action, pending] = useActionState(deletePersonAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-ink-muted">
        Deletes {name}&apos;s place in this school and all their work here (ticks, evidence, logs, attendance, sign-offs, assessments).
        If this is their only school, their whole account is deleted. This can&apos;t be undone.
      </p>
      <label className="label" htmlFor={`confirm-${userId}`}>Type <b>{email}</b> to confirm</label>
      <input id={`confirm-${userId}`} name="confirmEmail" autoComplete="off" className="input" required />
      <FormError message={state?.error} />
      <div><button className="btn-danger" disabled={pending}><Icon name="trash" size={18} />{pending ? "Deleting…" : "Delete permanently"}</button></div>
    </form>
  );
}

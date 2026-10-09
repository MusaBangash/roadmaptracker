"use client";

import { useActionState } from "react";
import { issueCertificateAction, revokeCertificateAction } from "@/app/actions/certificate";
import { FormError } from "@/components/ui";
import { Icon } from "@/components/icon";

/** "Download PDF": the browser's own Save as PDF, which draws Urdu names correctly. */
export function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      <Icon name="download" size={18} />Download PDF
    </button>
  );
}

/** Story 2: check the printed name, then issue. */
export function IssueCertificateForm({ enrollmentId, defaultName }: { enrollmentId: string; defaultName: string }) {
  const [state, action, pending] = useActionState(issueCertificateAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div>
        <label className="label" htmlFor="cert-name">Name as it will be printed</label>
        <input id="cert-name" name="name" required maxLength={80} defaultValue={defaultName} dir="auto" className="input" />
        <p className="mt-1 text-xs text-ink-muted">Check the spelling with the student. It can&apos;t be changed after the certificate is issued.</p>
      </div>
      <FormError message={state?.error} />
      <div><button className="btn-primary" disabled={pending}><Icon name="star" size={18} />{pending ? "Issuing…" : "Issue certificate"}</button></div>
    </form>
  );
}

/** Story 6: an admin revokes a certificate issued by mistake. */
export function RevokeCertificateForm({ certificateId }: { certificateId: string }) {
  const [state, action, pending] = useActionState(revokeCertificateAction, undefined);
  if (state?.ok) return <p role="status" className="text-sm text-success">{state.ok}</p>;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="certificateId" value={certificateId} />
      <label className="label" htmlFor="revoke-reason">Reason</label>
      <input id="revoke-reason" name="reason" required minLength={3} maxLength={300} className="input" placeholder="Issued to the wrong student" />
      <FormError message={state?.error} />
      <div>
        <button className="btn-danger" disabled={pending}
          onClick={(e) => { if (!window.confirm("Revoke this certificate? Anyone who checks it will see it was revoked.")) e.preventDefault(); }}>
          <Icon name="x" size={18} />{pending ? "Revoking…" : "Revoke certificate"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { createOrgAction } from "@/app/actions/admin";
import { FormError } from "@/components/ui";

export function OrgForm() {
  const [state, action, pending] = useActionState(createOrgAction, undefined);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div><label className="label" htmlFor="name">School name</label><input id="name" name="name" required className="input" placeholder="Aisha Cahn College" /></div>
      <div><label className="label" htmlFor="adminEmail">Admin email (optional)</label><input id="adminEmail" name="adminEmail" type="email" className="input" placeholder="principal@school.pk" /></div>
      <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create school"}</button>
      <div className="sm:col-span-3"><FormError message={state?.error} />{state?.ok && <p className="text-sm text-primary">{state.ok}</p>}</div>
    </form>
  );
}

"use client";

import { switchOrgAction } from "@/app/actions/auth";

export function OrgSwitcher({ orgs, current }: { orgs: { id: string; name: string }[]; current?: string }) {
  return (
    <form action={switchOrgAction}>
      <select
        name="orgId"
        defaultValue={current}
        aria-label="Switch school"
        className="input py-1.5 text-xs"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}

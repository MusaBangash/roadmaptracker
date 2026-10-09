"use client";

import { switchOrgAction } from "@/app/actions/auth";
import { useT } from "@/i18n/client";

export function OrgSwitcher({ orgs, current }: { orgs: { id: string; name: string }[]; current?: string }) {
  const t = useT();
  return (
    <form action={switchOrgAction}>
      <select
        name="orgId"
        defaultValue={current}
        aria-label={t("org.switch")}
        className="input py-1.5 text-xs"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}

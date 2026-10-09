"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useT } from "@/i18n/client";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost px-3 py-1.5 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt(t("common.copyPrompt"), text);
        }
      }}
    >
      {copied ? <><Icon name="check" size={16} />{t("common.copied")}</> : label ?? t("common.copyLink")}
    </button>
  );
}

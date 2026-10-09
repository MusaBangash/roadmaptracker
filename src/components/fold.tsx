"use client";

import { useState } from "react";

/**
 * A <details> that is open at first when `defaultOpen`, then remembers what the person did.
 * (A plain `open={…}` from the server would snap it shut whenever the page refreshes after an action.)
 */
export function Fold({ defaultOpen, className, children }: { defaultOpen: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>{children}</details>;
}

"use client";

import { useFormStatus } from "react-dom";

/** A submit button that asks "are you sure?" first, and can't be pressed twice while sending. */
export function ConfirmButton({ message, className, children }: { message: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

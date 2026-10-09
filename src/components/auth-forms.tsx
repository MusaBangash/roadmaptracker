"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, registerAction, googleAction, acceptInviteAction, resetPasswordAction, consentAction } from "@/app/actions/auth";
import { FormError } from "@/components/ui";

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={googleAction}>
      <input type="hidden" name="next" value={next} />
      <button className="btn-ghost w-full" type="submit">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}

function Divider() {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-ink-muted">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LoginForm({ next, google }: { next: string; google: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div>
      {google && (<><GoogleButton next={next} /><Divider /></>)}
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
        <FormError message={state?.error} />
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-muted">
        New here? <Link className="font-semibold text-primary" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </div>
  );
}

export function RegisterForm({ next, google }: { next: string; google: boolean }) {
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <div>
      {google && (<><GoogleButton next={next} /><Divider /></>)}
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" required autoComplete="name" className="input" /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /><p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p></div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span>I agree to the <Link href="/privacy" target="_blank" className="font-semibold text-secondary underline">Privacy notice</Link>. If I am under 18, my parent or guardian agrees too.</span>
        </label>
        <FormError message={state?.error} />
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Already have an account? <Link className="font-semibold text-primary" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </div>
  );
}

export function JoinForm({ code }: { code?: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {code ? <input type="hidden" name="code" value={code} /> : (
        <div><label className="label" htmlFor="code">Invite code</label><input id="code" name="code" required className="input font-mono" placeholder="e.g. k7mx2pq9ta" /></div>
      )}
      <FormError message={state?.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Joining…" : "Join"}</button>
    </form>
  );
}

/** Story 2: the new-password form behind a reset link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /><p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p></div>
      <div><label className="label" htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
      <FormError message={state?.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}

/** Story 7: people who joined before the Privacy notice (or with Google) agree once. */
export function ConsentForm() {
  const [state, action, pending] = useActionState(consentAction, undefined);
  return (
    <form action={action} className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span>I agree to the <Link href="/privacy" target="_blank" className="font-semibold text-secondary underline">Privacy notice</Link>. If I am under 18, my parent or guardian agrees too.</span>
        </label>
      <FormError message={state?.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}

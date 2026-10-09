"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, registerAction, googleAction, acceptInviteAction, resetPasswordAction, consentAction } from "@/app/actions/auth";
import { FormError } from "@/components/ui";
import { useT } from "@/i18n/client";

function GoogleButton({ next }: { next: string }) {
  const t = useT();
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
        {t("auth.google")}
      </button>
    </form>
  );
}

function Divider() {
  const t = useT();
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-ink-muted">
      <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LoginForm({ next, google }: { next: string; google: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div>
      {google && (<><GoogleButton next={next} /><Divider /></>)}
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="input" /></div>
        <div><label className="label" htmlFor="password">{t("auth.password")}</label><input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" className="input" /></div>
        <FormError message={state?.error} />
        <button className="btn-primary w-full" disabled={pending}>{pending ? t("auth.signingIn") : t("auth.signIn")}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-muted">
        {t("auth.newHere")} <Link className="font-semibold text-primary" href={`/register?next=${encodeURIComponent(next)}`}>{t("auth.createAccount")}</Link>
      </p>
    </div>
  );
}

export function RegisterForm({ next, google }: { next: string; google: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <div>
      {google && (<><GoogleButton next={next} /><Divider /></>)}
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="name">{t("auth.fullName")}</label><input id="name" name="name" required autoComplete="name" dir="auto" className="input" /></div>
        <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="input" /></div>
        <div><label className="label" htmlFor="password">{t("auth.password")}</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="input" /><p className="mt-1 text-xs text-ink-muted">{t("auth.min8")}</p></div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span>{t.rich("auth.agree", { link: (s) => <Link href="/privacy" target="_blank" className="font-semibold text-secondary underline">{s}</Link> })}</span>
        </label>
        <FormError message={state?.error} />
        <button className="btn-primary w-full" disabled={pending}>{pending ? t("auth.creating") : t("auth.create")}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-muted">
        {t("auth.haveAccount")} <Link className="font-semibold text-primary" href={`/login?next=${encodeURIComponent(next)}`}>{t("auth.signIn")}</Link>
      </p>
    </div>
  );
}

export function JoinForm({ code }: { code?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {code ? <input type="hidden" name="code" value={code} /> : (
        <div><label className="label" htmlFor="code">{t("auth.inviteCode")}</label><input id="code" name="code" required dir="ltr" className="input font-mono" placeholder={t("auth.inviteCodeExample")} /></div>
      )}
      <FormError message={state?.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? t("auth.joining") : t("auth.join")}</button>
    </form>
  );
}

/** Story 2: the new-password form behind a reset link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="password">{t("auth.newPassword")}</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="input" /><p className="mt-1 text-xs text-ink-muted">{t("auth.min8")}</p></div>
      <div><label className="label" htmlFor="confirm">{t("auth.typeAgain")}</label><input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className="input" /></div>
      <FormError message={state?.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? t("common.saving") : t("auth.saveNewPassword")}</button>
    </form>
  );
}

/** Story 7: people who joined before the Privacy notice (or with Google) agree once. */
export function ConsentForm() {
  const t = useT();
  const [state, action, pending] = useActionState(consentAction, undefined);
  return (
    <form action={action} className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span>{t.rich("auth.agree", { link: (s) => <Link href="/privacy" target="_blank" className="font-semibold text-secondary underline">{s}</Link> })}</span>
        </label>
      <FormError message={state?.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? t("common.saving") : t("common.continue")}</button>
    </form>
  );
}

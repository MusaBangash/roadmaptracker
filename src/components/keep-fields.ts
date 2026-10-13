import { startTransition } from "react";

/**
 * Submit a form to a useActionState action without React 19's automatic form reset: a refused save
 * keeps what the person picked and typed. The pressed button's name/value is kept.
 */
export function keepFields(dispatch: (form: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(form));
  };
}

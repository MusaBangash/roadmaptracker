"use client";

import { useActionState, useState } from "react";
import { importStudentsAction, previewImportAction, type ImportPreview, type ImportResult } from "@/app/actions/import";
import { csvFile, STUDENTS_TEMPLATE_CSV as TEMPLATE_CSV } from "@/lib/csv";
import { CopyButton } from "@/components/copy-button";
import { Badge, FormError } from "@/components/ui";
import { Icon } from "@/components/icon";
import { plural } from "@/lib/utils";

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function List({ rows, more = 8 }: { rows: { row: number; name: string; email: string }[]; more?: number }) {
  if (!rows.length) return null;
  const head = rows.slice(0, more);
  return (
    <ul className="mt-2 space-y-0.5 text-sm">
      {head.map((r) => <li key={r.row} className="truncate"><span className="text-ink-muted">Row {r.row}:</span> {r.name} · {r.email}</li>)}
      {rows.length > more && <li className="text-ink-muted">…and {rows.length - more} more</li>}
    </ul>
  );
}

/** Add many students to a cohort from a CSV file: template → upload → preview → add → sign-in links. */
export function ImportStudents({ cohortId, cohortName }: { cohortId: string; cohortName: string }) {
  const [preview, check, checking] = useActionState<ImportPreview | undefined, FormData>(previewImportAction, undefined);
  const [result, run, adding] = useActionState<ImportResult | undefined, FormData>(importStudentsAction, undefined);
  const [round, setRound] = useState(0); // "Start again" remounts the forms

  if (result?.done) {
    const { created, added, skipped, links } = result.done;
    const slug = cohortName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return (
      <div className="grid gap-4">
        <p role="status" className="flex items-start gap-2 rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          <Icon name="check" size={20} />
          <span><b>Done.</b> {plural(created, "new student")} with a new account, {plural(added, "student")} who already had an account added, {skipped} already in the cohort.</span>
        </p>
        {links.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="h2 mb-1">Send each new student their sign-in link</h2>
            <p className="mb-3 text-sm text-ink-muted">
              Each link lets one student set their password. It works once, for {14} days. <b className="text-ink">The links are shown only now</b>, so download them before you leave this page.
            </p>
            <button type="button" className="btn-primary mb-4" onClick={() => saveFile(`${slug}-sign-in-links.csv`, csvFile([["Name", "Email", "Sign-in link"], ...links.map((l) => [l.name, l.email, l.link])]))}>
              <Icon name="download" size={18} />Download links as a file
            </button>
            <ul className="divide-y divide-border rounded-md border border-border">
              {links.map((l) => (
                <li key={l.email} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="min-w-0 flex-1"><b>{l.name}</b> <span className="text-ink-muted">· {l.email}</span></span>
                  <CopyButton text={`Assalam o Alaikum ${l.name}! Set your NoorAI Tracks password here (works once, for 14 days): ${l.link}`} label="Copy message" />
                </li>
              ))}
            </ul>
          </section>
        )}
        <div><button type="button" className="btn-ghost" onClick={() => location.reload()}>Add more students</button></div>
      </div>
    );
  }

  const toAdd = [...(preview?.create ?? []), ...(preview?.add ?? [])];
  return (
    <div className="grid gap-4" key={round}>
      <section className="card p-4 sm:p-5" aria-labelledby="step1">
        <h2 id="step1" className="h2 mb-1">1. Fill in the template</h2>
        <p className="mb-3 text-sm text-ink-muted">
          One student per row, with their <b className="text-ink">Name</b> and <b className="text-ink">Email</b>. In Excel, save it with
          <b className="text-ink"> File → Save As → CSV UTF-8</b>, so Urdu names stay correct.
        </p>
        <button type="button" className="btn-ghost" onClick={() => saveFile("students-template.csv", TEMPLATE_CSV)}><Icon name="download" size={18} />Download template</button>
      </section>

      <section className="card p-4 sm:p-5" aria-labelledby="step2">
        <h2 id="step2" className="h2 mb-1">2. Upload it and check</h2>
        <p className="mb-3 text-sm text-ink-muted">Nothing is saved until you press Add in the next step.</p>
        <form action={check} className="grid gap-3">
          <input type="hidden" name="cohortId" value={cohortId} />
          <div>
            <label className="label" htmlFor="students-file">Student file (.csv)</label>
            <input id="students-file" name="file" type="file" accept=".csv,text/csv" required className="input py-2" />
          </div>
          <div><button className="btn-primary" disabled={checking}><Icon name="upload" size={18} />{checking ? "Checking…" : "Check the file"}</button></div>
          <FormError message={preview?.error} />
        </form>
      </section>

      {preview && !preview.error && (
        <section className="card p-4 sm:p-5" aria-labelledby="step3" aria-live="polite">
          <h2 id="step3" className="h2 mb-3">3. Check and add</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Badge tone="success" icon="plus">{plural(preview.create!.length, "new student")}</Badge><p className="mt-1 text-xs text-ink-muted">Will get an account and a sign-in link.</p><List rows={preview.create!} /></div>
            <div><Badge tone="info" icon="addPerson">{plural(preview.add!.length, "existing account")}</Badge><p className="mt-1 text-xs text-ink-muted">Already have an account: just added to {cohortName}.</p><List rows={preview.add!} /></div>
            {preview.skip!.length > 0 && <div><Badge tone="neutral" icon="minus">{plural(preview.skip!.length, "already in this cohort", "already in this cohort")}</Badge><p className="mt-1 text-xs text-ink-muted">Skipped.</p><List rows={preview.skip!} /></div>}
            {preview.problems!.length > 0 && (
              <div>
                <Badge tone="danger" icon="error">{plural(preview.problems!.length, "row has a problem", "rows have a problem")}</Badge>
                <p className="mt-1 text-xs text-ink-muted">Skipped. Fix them in the file and upload it again, or add them later.</p>
                <ul className="mt-2 space-y-0.5 text-sm text-danger">{preview.problems!.slice(0, 20).map((p) => <li key={p.row}>Row {p.row}: {p.reason}</li>)}</ul>
              </div>
            )}
          </div>
          {toAdd.length > 0 ? (
            <form action={run} className="mt-5 grid gap-2">
              <input type="hidden" name="cohortId" value={cohortId} />
              {/* Every checked row; the server sorts them again (it never trusts this page). */}
              <input type="hidden" name="rows" value={JSON.stringify([...toAdd, ...(preview.skip ?? [])])} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={adding}><Icon name="addPerson" size={18} />{adding ? "Adding…" : `Add ${plural(toAdd.length, "student")} to ${cohortName}`}</button>
                <button type="button" className="btn-ghost" onClick={() => setRound((r) => r + 1)}>Start again</button>
              </div>
              <FormError message={result?.error} />
            </form>
          ) : <p className="mt-4 text-sm text-ink-muted">There is nobody new to add from this file.</p>}
        </section>
      )}
    </div>
  );
}

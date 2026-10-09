"use client";

import { useState, useTransition } from "react";
import { addCommentAction, deleteCommentAction, editCommentAction, hideCommentAction, markThreadSeenAction } from "@/app/actions/comment";
import { COMMENT_MAX, hasUrdu, linkify, type Side } from "@/lib/comment-core";
import type { CommentView } from "@/lib/comments";
import { Badge, Tag } from "@/components/ui";
import { Icon } from "@/components/icon";
import { useT } from "@/i18n/client";

type Props = {
  enrollmentId: string;
  itemId: string;
  comments: CommentView[];
  side: Side;
  admin: boolean;
  unread: number;
  /** False until the work is submitted (comments open then). */
  canWrite: boolean;
  /** The review queue shows the thread open by default. */
  startOpen?: boolean;
};

/** Comments on one piece of work (feature 3): the student and the cohort's teachers talk about it. */
export function CommentThread({ enrollmentId, itemId, comments, side, admin, unread, canWrite, startOpen = false }: Props) {
  const t = useT();
  const [open, setOpen] = useState(startOpen);
  const [fresh, setFresh] = useState(unread);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const said = comments.filter((c) => c.kind === "COMMENT").length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && fresh > 0) {
      setFresh(0);
      void markThreadSeenAction(enrollmentId, itemId);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await addCommentAction(enrollmentId, itemId, text);
      setMsg(r);
      if (r?.ok) setText("");
    });
  }

  if (!canWrite && comments.length === 0) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Icon name="comment" size={16} />
        {open ? t("cmt.hide") : said ? t("cmt.count", { n: said }) : comments.length ? t("cmt.history") : t("cmt.write")}
        {fresh > 0 && <Badge tone="info" icon="info">{t("cmt.new", { n: fresh })}</Badge>}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-surface p-3">
          {comments.length === 0 && <p className="text-sm text-ink-muted">{t("cmt.empty")}</p>}
          <ol className="space-y-3">
            {comments.map((c) => <CommentItem key={c.id} c={c} admin={admin} />)}
          </ol>
          {canWrite && (
            <form onSubmit={send} className="mt-3 grid gap-2">
              <label className="sr-only" htmlFor={`c-${enrollmentId}-${itemId}`}>{t("cmt.yours")}</label>
              <textarea id={`c-${enrollmentId}-${itemId}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={COMMENT_MAX}
                dir="auto" placeholder={side === "STUDENT" ? t("cmt.placeholderStudent") : t("cmt.placeholderTeacher")}
                className={`input ${hasUrdu(text) ? "leading-[2.2] [font-family:var(--font-urdu)]" : ""}`} />
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primary" disabled={pending || !text.trim()}>{pending ? t("cmt.sending") : t("cmt.send")}</button>
                <span className="text-xs text-ink-muted">{text.length > COMMENT_MAX - 200 ? t("cmt.left", { n: COMMENT_MAX - text.length }) : t("cmt.private")}</span>
                {msg?.error && <p role="alert" className="w-full text-sm text-danger">{msg.error}</p>}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Body({ text }: { text: string }) {
  const urdu = hasUrdu(text);
  return (
    <p dir="auto" lang={urdu ? "ur" : undefined} className={`mt-1 whitespace-pre-wrap break-words text-sm ${urdu ? "leading-[2.2] [font-family:var(--font-urdu)]" : ""}`}>
      {linkify(text).map((p, i) => p.href
        ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all text-secondary underline">{p.text}</a>
        : <span key={i}>{p.text}</span>)}
    </p>
  );
}

function CommentItem({ c, admin }: { c: CommentView; admin: boolean }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body ?? "");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string; ok?: string } | undefined>) => start(async () => {
    const r = await fn();
    setMsg(r?.error ? r : undefined);
    if (r?.ok) setEditing(false);
  });

  if (c.kind === "RESUBMIT") {
    return <li className="flex items-center gap-2 text-xs text-ink-muted"><Icon name="upload" size={16} /><span>{t.rich("cmt.resubmitted", { b: (s) => <b className="text-ink" dir="auto">{s}</b> }, { name: c.author, when: c.when })}</span></li>;
  }
  return (
    <li className={`border-s-4 ps-3 ${c.side === "TEACHER" ? "border-primary" : "border-border-strong"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <b className="text-sm text-ink" dir="auto">{c.author}</b>
        <Tag>{c.side === "TEACHER" ? t("cmt.teacher") : t("cmt.student")}</Tag>
        {c.kind === "VERIFIED" && <Badge tone="success" icon="check">{t("status.verified")}</Badge>}
        {c.kind === "NEEDS_WORK" && <Badge tone="danger" icon="x">{t("status.needsWork")}</Badge>}
        <span>{c.when}{c.edited ? t("cmt.edited") : ""}</span>
      </div>
      {c.hidden ? (
        <>
          <p className="mt-1 text-sm italic text-ink-muted">{t("cmt.hidden")}</p>
          {admin && c.hiddenText && <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-xs text-ink-muted line-through">{c.hiddenText}</p>}
        </>
      ) : editing ? (
        <div className="mt-1 grid gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={COMMENT_MAX} dir="auto" aria-label={t("cmt.editLabel")}
            className={`input ${hasUrdu(text) ? "leading-[2.2] [font-family:var(--font-urdu)]" : ""}`} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={pending || !text.trim()} onClick={() => run(() => editCommentAction(c.id, text))}>{t("common.save")}</button>
            <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setText(c.body ?? ""); }}>{t("common.cancel")}</button>
          </div>
        </div>
      ) : c.body && <Body text={c.body} />}
      {!editing && (c.canChange || admin) && (
        <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
          {c.canChange && !c.hidden && <>
            <button type="button" className="text-primary" onClick={() => setEditing(true)}>{t("common.edit")}</button>
            <button type="button" className="text-danger" disabled={pending}
              onClick={() => { if (confirm(t("cmt.deleteConfirm"))) run(() => deleteCommentAction(c.id)); }}>{t("common.delete")}</button>
          </>}
          {admin && (c.body || c.hidden) && (c.hidden
            ? <button type="button" className="inline-flex items-center gap-1 text-ink-muted" disabled={pending} onClick={() => run(() => hideCommentAction(c.id, false))}><Icon name="eye" size={14} />{t("cmt.showAgain")}</button>
            : <button type="button" className="inline-flex items-center gap-1 text-ink-muted" disabled={pending}
                onClick={() => { if (confirm(t("cmt.hideConfirm"))) run(() => hideCommentAction(c.id, true)); }}><Icon name="eye-off" size={14} />{t("cmt.hideOne")}</button>)}
        </div>
      )}
      {msg?.error && <p role="alert" className="mt-1 text-sm text-danger">{msg.error}</p>}
    </li>
  );
}

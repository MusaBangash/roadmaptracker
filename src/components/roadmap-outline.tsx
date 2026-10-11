"use client";

import { useRef } from "react";
import { Icon, type IconName } from "./icon";
import { LevelPill, Tag } from "./ui";
import { plural } from "@/lib/utils";

// The roadmap page's "What is in this roadmap" (admins, teachers, anyone who can see the track):
// the stages as a timeline with their weeks, what each holds, and every item with its kind.

type OutlineItem = { id: string; title: string; detail: string | null; kind: string; optional: boolean };
export type OutlineStage = {
  id: string; title: string; level: string; weeks: number; optional: boolean; choiceGroup: string | null;
  benchmark: string | null; doneWhen: string | null; items: OutlineItem[];
  /** Week the stage starts in the plan, counted from 0 (stageWindows). */
  start: number;
};

const KINDS: { kind: string; icon: IconName; one: string; many: string }[] = [
  { kind: "LESSON", icon: "book", one: "lesson", many: "lessons" },
  { kind: "PROJECT", icon: "tool", one: "project", many: "projects" },
  { kind: "DELIVERABLE", icon: "file", one: "deliverable", many: "deliverables" },
  { kind: "MILESTONE", icon: "flag", one: "milestone", many: "milestones" },
];
const kindOf = (kind: string) => KINDS.find((k) => k.kind === kind) ?? KINDS[0];

/** "10 lessons · 1 project" */
function kindCounts(items: { kind: string }[]) {
  return KINDS.map((k) => ({ k, n: items.filter((i) => i.kind === k.kind).length }))
    .filter((x) => x.n > 0).map(({ k, n }) => plural(n, k.one, k.many)).join(" · ");
}

function weekRange(start: number, weeks: number) {
  if (!weeks) return null;
  return weeks === 1 ? `Week ${start + 1}` : `Week ${start + 1}–${start + weeks}`;
}

export function RoadmapOutline({ stages }: { stages: OutlineStage[] }) {
  const list = useRef<HTMLOListElement>(null);
  const setAll = (open: boolean) => list.current?.querySelectorAll("details").forEach((d) => { d.open = open; });

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost py-1.5" onClick={() => setAll(true)}><Icon name="down" size={16} />Open all</button>
        <button type="button" className="btn-ghost py-1.5" onClick={() => setAll(false)}><Icon name="up" size={16} />Close all</button>
      </div>
      <ol ref={list} className="relative space-y-3 before:absolute before:start-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
        {stages.map((s, i) => {
          const weeks = weekRange(s.start, s.weeks);
          return (
            <li key={s.id} className="relative ps-11 sm:ps-12">
              <span className="absolute start-0 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">{i + 1}</span>
              <details className="card group">
                <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.title}</span>
                      <LevelPill level={s.level} />
                      {s.optional && <Tag>Optional</Tag>}
                      {s.choiceGroup && <Tag>Pick one</Tag>}
                    </div>
                    <div className="mt-1 text-sm text-ink-muted">{kindCounts(s.items) || "No items yet"}</div>
                  </div>
                  {weeks && <span className="shrink-0 pt-0.5 text-sm font-semibold whitespace-nowrap text-ink-muted">{weeks}</span>}
                  <span className="shrink-0 pt-0.5 text-ink-muted transition-transform group-open:rotate-180"><Icon name="chevron" size={20} /></span>
                </summary>
                <div className="border-t border-border p-4 text-sm">
                  {(s.benchmark || s.doneWhen) && (
                    <div className="mb-3 space-y-1 rounded-md bg-surface-sunken p-3">
                      {s.benchmark && <p><b className="text-ink-muted">Benchmark:</b> {s.benchmark}</p>}
                      {s.doneWhen && <p><b className="text-highlight-text">Done when:</b> {s.doneWhen}</p>}
                    </div>
                  )}
                  <ul className="divide-y divide-border">
                    {s.items.map((it) => {
                      const k = kindOf(it.kind);
                      return (
                        <li key={it.id} className="flex gap-3 py-2.5">
                          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${it.kind === "LESSON" ? "bg-surface-sunken text-ink-muted" : "bg-primary-soft text-ink"}`}>
                            <Icon name={k.icon} size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{it.title}</span>
                              {it.kind !== "LESSON" && <Tag strong={it.kind === "MILESTONE"}>{k.one.charAt(0).toUpperCase() + k.one.slice(1)}</Tag>}
                              {it.optional && <Tag>Optional</Tag>}
                            </div>
                            {it.detail && <div className="mt-0.5 text-ink-muted">{it.detail}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}

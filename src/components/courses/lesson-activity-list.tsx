"use client";

import Link from "next/link";
import { BookOpen, Check, ChevronRight, Mic, Phone } from "lucide-react";
import type { ActivityDescriptor } from "@/lib/courses/lesson-activities";
import { cn } from "@/lib/utils";

const KIND_STYLE = {
  speaking: { icon: Mic, tile: "bg-secondary/15 text-secondary-edge" },
  vocabulary: { icon: BookOpen, tile: "bg-accent/20 text-accent-edge" },
  call: { icon: Phone, tile: "bg-primary/15 text-primary-edge" },
} as const;

/**
 * The seven activities of a lesson as a tappable list: kind icon, title, one-line detail,
 * a check and strike-through once done, and a highlight on the current one. Rows are links
 * (from the course map) or buttons (inside the lesson).
 */
export function LessonActivityList({ descriptors, doneActivities, current, hrefFor, onSelect }: {
  descriptors: ActivityDescriptor[];
  doneActivities: ReadonlySet<number>;
  current?: number;
  hrefFor?: (activity: number) => string;
  onSelect?: (activity: number) => void;
}) {
  return (
    <ol className="space-y-1.5">
      {descriptors.map((entry) => {
        const done = doneActivities.has(entry.activity);
        const active = entry.activity === current;
        const { icon: Icon, tile } = KIND_STYLE[entry.kind];
        const body = (
          <>
            <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-2xl", done ? "bg-primary text-primary-foreground" : tile)}>
              {done ? <Check aria-hidden="true" className="size-5 stroke-[3]" /> : <Icon aria-hidden="true" className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block font-extrabold", done && "text-muted-foreground line-through decoration-2")}>
                {entry.titleVi}
              </span>
              <span lang={entry.kind === "vocabulary" ? undefined : "en"} className="text-muted-foreground block truncate text-sm">
                {entry.subtitle}
              </span>
            </span>
            {active ? (
              <span className="bg-primary/15 text-primary-edge shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold">Đang học</span>
            ) : (
              <ChevronRight aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
            )}
          </>
        );
        const rowClass = cn(
          "flex w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-colors",
          active ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-muted",
        );
        return (
          <li key={entry.activity}>
            {hrefFor ? (
              <Link href={hrefFor(entry.activity)} className={rowClass} aria-current={active ? "step" : undefined}>{body}</Link>
            ) : (
              <button type="button" onClick={() => onSelect?.(entry.activity)} className={rowClass} aria-current={active ? "step" : undefined}>
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

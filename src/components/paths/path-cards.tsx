import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export type PathSummary = { id: string; slug: string; title: string; description: string | null; level: string; tags: string[]; setCount: number; wordCount: number };
export type RecentSet = { id: string; title: string; cardCount: number; masteredPercent: number; lastStudiedAt: string };

const TAG_LABELS: Record<string, string> = { ielts: "IELTS", toeic: "TOEIC", thpt: "THPT", communication: "Giao tiếp", work: "Công việc" };
const TONES = ["bg-primary/15 text-primary", "bg-secondary/15 text-secondary", "bg-brand-orange/15 text-brand-orange", "bg-brand-grape/15 text-brand-grape"];

export function tagLabel(tag: string) {
  return TAG_LABELS[tag] ?? tag;
}

/** A learning path tile: icon, title, description and its size. */
export function PathCard({ path, index = 0 }: { path: PathSummary; index?: number }) {
  return (
    <Link
      href={`/paths/${path.slug}`}
      className="group bg-card flex h-full flex-col gap-3 rounded-3xl border-2 p-5 shadow-[0_5px_0_var(--border)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("grid size-11 place-items-center rounded-2xl", TONES[index % TONES.length])}>
          <Map className="size-5" aria-hidden="true" />
        </span>
        <span className="flex gap-1.5">
          {path.tags.slice(0, 1).map((tag) => <span key={tag} className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-extrabold">{tagLabel(tag)}</span>)}
          <span className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-extrabold">{path.level}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-snug font-black">{path.title}</h3>
        {path.description ? <p className="text-muted-foreground mt-1 line-clamp-2 text-sm font-semibold">{path.description}</p> : null}
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-sm font-extrabold">
        <span className="flex items-center gap-1.5"><Layers className="size-4" aria-hidden="true" />{path.setCount} bộ · {path.wordCount} từ</span>
        <ArrowRight className="text-primary size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </div>
    </Link>
  );
}

/** A recently studied set with its mastery bar. */
export function RecentSetCard({ set }: { set: RecentSet }) {
  return (
    <Link
      href={`/sets/${set.id}`}
      className="bg-card flex items-center gap-4 rounded-3xl border-2 p-4 shadow-[0_4px_0_var(--border)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
    >
      <span className="bg-secondary/15 text-secondary grid size-12 shrink-0 place-items-center rounded-2xl">
        <BookOpen className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black">{set.title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${set.masteredPercent}%` }} />
          </div>
          <span className="text-muted-foreground text-xs font-extrabold tabular-nums">{set.masteredPercent}%</span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs font-bold">{set.cardCount} thẻ</p>
      </div>
    </Link>
  );
}

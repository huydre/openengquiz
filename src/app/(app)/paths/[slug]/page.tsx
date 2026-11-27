import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPath } from "@/lib/paths/path-data";
import { LogoLoader } from "@/components/layout/logo-loader";
import { tagLabel } from "@/components/paths/path-cards";
import { cn } from "@/lib/utils";

export default function PathPage({ params }: PageProps<"/paths/[slug]">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải lộ trình..." />}>
      <PathContent params={params} />
    </Suspense>
  );
}

async function PathContent({ params }: { params: PageProps<"/paths/[slug]">["params"] }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const path = await getPath(supabase, slug, user!.id);
  if (!path) notFound();

  const percent = Math.round(path.progress * 100);
  // The first set that is not fully mastered is where the learner continues.
  const nextIndex = path.sets.findIndex((set) => set.cardCount === 0 || set.mastered < set.cardCount);
  const next = path.sets[nextIndex === -1 ? 0 : nextIndex];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <Link href="/paths" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-extrabold">
        <ArrowLeft className="size-4" aria-hidden="true" /> Lộ trình
      </Link>

      <section className="bg-card from-primary/10 to-card rounded-[2rem] border-2 bg-gradient-to-b p-6 shadow-[0_6px_0_var(--border)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative size-28 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
              <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-primary"
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - path.progress)} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <p className="text-2xl font-black tabular-nums">{percent}%</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {path.tags.map((tag) => <span key={tag} className="bg-card rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold">{tagLabel(tag)}</span>)}
              <span className="bg-card rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold">{path.level}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-balance">{path.title}</h1>
            {path.description ? <p className="text-muted-foreground mt-1 font-semibold">{path.description}</p> : null}
            <p className="text-muted-foreground mt-2 text-sm font-extrabold">
              {path.sets.length} bộ · {path.cardCount} từ · đã thuộc {path.mastered} · đang học {path.learning}
            </p>
          </div>
        </div>
        {next ? (
          <Link
            href={`/study/${next.id}/vocab`}
            className="bg-primary text-primary-foreground mt-6 flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none"
          >
            <Play className="size-5" aria-hidden="true" /> {percent ? "Học tiếp" : "Bắt đầu"}: {next.title}
          </Link>
        ) : null}
      </section>

      <ol className="relative space-y-3">
        <span aria-hidden="true" className="bg-border absolute top-6 bottom-6 left-7 w-1 rounded-full" />
        {path.sets.map((set, index) => {
          const done = set.cardCount > 0 && set.mastered >= set.cardCount;
          const current = set.id === next?.id && !done;
          const setPercent = set.cardCount ? Math.round((set.mastered / set.cardCount) * 100) : 0;
          return (
            <li key={set.id} className="relative flex items-center gap-4">
              <span className={cn(
                "relative grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-black",
                done ? "bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-edge)]"
                  : current ? "bg-secondary text-secondary-foreground shadow-[0_4px_0_var(--secondary-edge)]"
                    : "bg-card border-2 shadow-[0_4px_0_var(--border)]",
              )}>
                {done ? <Check className="size-6" aria-hidden="true" /> : index + 1}
              </span>
              <Link
                href={`/sets/${set.id}`}
                className={cn("bg-card hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-4 rounded-2xl border-2 px-5 py-3.5 transition-colors", current && "border-secondary")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold">{set.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${setPercent}%` }} />
                    </div>
                    <span className="text-muted-foreground w-20 text-right text-xs font-extrabold tabular-nums">{set.mastered}/{set.cardCount} từ</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

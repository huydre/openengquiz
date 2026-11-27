import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LogoLoader } from "@/components/layout/logo-loader";
import { buttonVariants } from "@/components/ui/button";
import { summarizeProgress, type PathProgress } from "@/lib/paths/path-data";
import { createClient } from "@/lib/supabase/server";
import { PathPending } from "./path-pending";

export default function PathPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<LogoLoader />}><PathDetail params={params} /></Suspense>;
}

async function PathDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const { data: path, error } = await db.from("learning_paths")
    .select("title,description,tags,level,status,error,updated_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Không thể tải lộ trình.");
  if (!path) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/paths" className="text-primary font-bold underline">Về lộ trình</Link>
      <header className="space-y-2">
        <p className="text-primary text-sm font-bold">{[path.level, ...path.tags].join(" · ")}</p>
        <h1 className="text-3xl font-black">{path.title}</h1>
        {path.description && <p className="text-muted-foreground">{path.description}</p>}
      </header>
      {path.status === "ready" ? <PathSets db={db} id={id} /> : path.status === "generating" ?
        <PathPending key={path.updated_at} updatedAt={path.updated_at} /> : (
        <div className="space-y-3">
          <p role="alert" className="text-destructive">{path.error ?? "Quá trình tạo bị gián đoạn. Bạn có thể tạo lại."}</p>
          <Link href="/paths/ai" className={buttonVariants()}>Tạo lại bằng AI</Link>
        </div>
      )}
    </div>
  );
}

async function PathSets({ db, id }: { db: Awaited<ReturnType<typeof createClient>>; id: string }) {
  const [progress, items] = await Promise.all([
    db.rpc("path_progress", { p_path_id: id }),
    db.from("path_items").select("set_id,study_sets!inner(title)").eq("path_id", id),
  ]);
  if (progress.error || items.error) return <p role="alert" className="text-destructive">Không tải được tiến độ.</p>;
  const titles = new Map(items.data.map(({ set_id, study_sets }) => [set_id, (Array.isArray(study_sets) ? study_sets[0] : study_sets)?.title]));
  const rows = (progress.data as PathProgress[]).filter((row) => titles.has(row.set_id));
  const { total, mastered, percent, next } = summarizeProgress(rows);
  return (
    <>
      <section className="space-y-3 rounded-3xl border-2 p-5">
        <h2 className="text-xl font-extrabold">Đã thuộc {percent}%</h2>
        <progress className="w-full accent-primary" aria-label="Tỷ lệ từ đã thuộc" value={percent} max={100} />
        <p className="text-muted-foreground">{mastered}/{total} từ đã thuộc</p>
        <div className="flex flex-wrap gap-3">
          {next && <Link href={`/study/${next}/learn`} className={buttonVariants()}>Học tiếp</Link>}
          {total > 0 && <Link href={`/review?path=${id}`} className={buttonVariants({ variant: "outline" })}>Ôn cả lộ trình</Link>}
        </div>
      </section>
      {rows.length ? <ol className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.set_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 p-4">
            <Link href={`/sets/${row.set_id}`} className="text-primary font-bold underline">{index + 1}. {titles.get(row.set_id)}</Link>
            <span className="text-muted-foreground text-sm">{row.mastered}/{row.total} từ</span>
          </li>
        ))}
      </ol> : <p>Chưa có bộ từ bạn có thể học.</p>}
    </>
  );
}

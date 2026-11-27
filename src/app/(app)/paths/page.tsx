import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoLoader } from "@/components/layout/logo-loader";
import { PathList } from "@/components/paths/path-list";
import { buttonVariants } from "@/components/ui/button";
import { recommendPaths, type PathCard } from "@/lib/paths/path-data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lộ trình học" };

export default function PathsPage() {
  return <Suspense fallback={<LogoLoader />}><Paths /></Suspense>;
}

async function Paths() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/paths");
  const [{ data: profile }, { data, error }] = await Promise.all([
    db.from("profiles").select("goal,level").eq("id", user.id).maybeSingle(),
    db.from("learning_paths").select("id,title,description,tags,level,visibility,owner_id,status")
      .order("created_at", { ascending: false }).order("id"),
  ]);
  const publicPaths = (data ?? []).filter((row) => row.visibility === "public" && row.status === "ready") as PathCard[];
  const mine = (data ?? []).filter((row) => row.owner_id === user.id) as PathCard[];
  const suggested = recommendPaths(publicPaths, profile?.goal, profile?.level);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-black">Lộ trình học</h1>
        <p className="text-muted-foreground">Học theo từng bộ từ, đúng thứ tự và mục tiêu của bạn.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/paths/new" className={buttonVariants()}>Tự tạo lộ trình</Link>
          <Link href="/paths/ai" className={buttonVariants({ variant: "outline" })}>Tạo bằng AI</Link>
        </div>
      </header>
      {error ? <p role="alert" className="text-destructive">Chưa tải được lộ trình. Vui lòng thử lại.</p> : (
        <>
          {suggested.length > 0 && <section className="space-y-3"><h2 className="text-xl font-extrabold">Gợi ý cho bạn</h2><PathList paths={suggested} /></section>}
          <section className="space-y-3"><h2 className="text-xl font-extrabold">Lộ trình công khai</h2>{publicPaths.length ? <PathList paths={publicPaths} /> : <p>Chưa có lộ trình công khai.</p>}</section>
          <section className="space-y-3"><h2 className="text-xl font-extrabold">Lộ trình của tôi</h2>{mine.length ? <PathList paths={mine} /> : <p>Bạn chưa tạo lộ trình nào.</p>}</section>
        </>
      )}
    </div>
  );
}

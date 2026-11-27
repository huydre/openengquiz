import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentStreak } from "@/lib/srs/activity";
import { LogoLoader } from "@/components/layout/logo-loader";
import { PathList } from "@/components/paths/path-list";
import { recommendPaths, type PathCard } from "@/lib/paths/path-data";

export const metadata = { title: "Trang chủ" };

export default function HomePage() {
  return (
    <Suspense fallback={<LogoLoader />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/home");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, goal, level")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Không thể tải hồ sơ của bạn.");
  if (!profile?.goal && user.user_metadata?.onboarding_skipped !== true) {
    redirect("/onboarding");
  }

  const [{ count: due }, { data: activity }, { data: paths }] = await Promise.all([
    supabase.from("review_states")
      .select("card_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("due_at", new Date().toISOString()),
    supabase.from("user_daily_activity")
      .select("day, reviews, studied")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(1000),
    supabase.from("learning_paths").select("id,title,description,tags,level")
      .eq("visibility", "public").eq("status", "ready").order("created_at", { ascending: false }),
  ]);
  const streak = currentStreak(
    (activity ?? []).filter((day) => day.reviews + day.studied > 0).map((day) => day.day),
    new Date(),
  );
  const suggested = recommendPaths((paths ?? []) as PathCard[], profile?.goal, profile?.level);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-bold">
        Xin chào{profile?.display_name ? `, ${profile.display_name}` : ""} 👋
      </h1>
      <p className="text-muted-foreground">Bắt đầu với bộ từ của bạn, rồi học từng thẻ nhé.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
          <p className="text-muted-foreground text-sm font-bold">Thẻ đến hạn</p>
          <p className="text-3xl font-black">{due ?? 0}</p>
        </div>
        <div className="rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
          <p className="text-muted-foreground text-sm font-bold">Chuỗi ngày học</p>
          <p className="text-3xl font-black">{streak} ngày</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/review" className="bg-primary text-primary-foreground w-fit rounded-2xl px-5 py-3 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)]">Ôn ngay</Link>
        <Link href="/sets" className="rounded-2xl border-2 px-5 py-3 font-extrabold uppercase">Xem bộ từ</Link>
        <Link href="/stats" className="rounded-2xl border-2 px-5 py-3 font-extrabold uppercase">Xem thống kê</Link>
      </div>
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Lộ trình gợi ý</h2>
        {suggested.length > 0 && <PathList paths={suggested} />}
        <Link href="/paths" className="text-primary font-bold underline">Khám phá lộ trình</Link>
      </section>
    </div>
  );
}

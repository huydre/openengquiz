import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentStreak } from "@/lib/srs/activity";
import { LogoLoader } from "@/components/layout/logo-loader";
import { courseMap, getCourse } from "@/lib/courses/course-data";

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

  const [{ count: due }, { data: activity }] = await Promise.all([
    supabase.from("review_states")
      .select("card_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("due_at", new Date().toISOString()),
    supabase.from("user_daily_activity")
      .select("day, reviews, studied")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(1000),
  ]);
  const streak = currentStreak(
    (activity ?? []).filter((day) => day.reviews + day.studied > 0).map((day) => day.day),
    new Date(),
  );

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
      <Suspense fallback={<LogoLoader size="sm" label="Đang tải khoá học" />}>
        <ContinueCourse db={supabase} goal={profile?.goal} level={profile?.level} />
      </Suspense>
    </div>
  );
}

async function ContinueCourse({ db, goal, level }: { db: Awaited<ReturnType<typeof createClient>>; goal?: string | null; level?: string | null }) {
  let slug: string | null = null;
  let selected: Awaited<ReturnType<typeof getCourse>> = null;
  let next: string | undefined;
  try {
    const { data: choice, error } = await db.from("course_choices").select("course_id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const active = choice ? await db.from("courses").select("slug").eq("id", choice.course_id).single() : null;
    if (active?.error) throw active.error;
    slug = active?.data?.slug ?? (goal === "ielts" ? "ielts" : null);
    selected = slug ? await getCourse(db, slug, level) : null;
    next = selected?.level ? (await courseMap(db, selected.level.id)).next : undefined;
  } catch (error) {
    console.error("Course continuation unavailable", error);
    return <p role="status" className="text-muted-foreground">Chưa tải được khoá học. Bạn vẫn có thể học bộ từ và ôn tập.</p>;
  }
  return <section className="space-y-3">
    <h2 className="text-xl font-extrabold">{next ? "Học tiếp" : "Khoá học"}</h2>
    {selected?.level && <p>{selected.course.title} · {selected.level.title}</p>}
    <Link href={next ? `/courses/${slug}/lessons/${next}` : "/courses"} className="font-bold text-primary underline">{next ? "Mở bài học" : "Khám phá khoá học"}</Link>
  </section>;
}

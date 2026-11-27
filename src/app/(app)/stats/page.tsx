import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { vietnamDay } from "@/lib/srs/activity";
import { getStreakStatus } from "@/lib/srs/streak-status";
import { addDays, dayStartUtc } from "@/components/review/vietnam-day";
import { ActivityCharts } from "./activity-charts";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Thống kê học tập" };

export default function StatsPage() {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải thống kê..." />}>
      <StatsContent />
    </Suspense>
  );
}

async function StatsContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/stats");

  const today = vietnamDay(new Date());
  const tomorrow = addDays(today, 1);
  const firstHeatDay = addDays(today, -83);
  const forecastDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const [due, mastered, allLogs, remembered, activityResult, streakResult, ...forecastResults] = await Promise.all([
    supabase.from("review_states").select("card_id", { count: "exact", head: true })
      .eq("user_id", user.id).lt("due_at", dayStartUtc(tomorrow)),
    supabase.from("review_states").select("card_id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("state", "review").gte("reps", 3),
    supabase.from("review_logs").select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("review_logs").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("rating", 2),
    supabase.from("user_daily_activity").select("day,reviews,studied")
      .eq("user_id", user.id).gte("day", firstHeatDay).order("day", { ascending: true }),
    getStreakStatus(supabase),
    ...forecastDays.map((day, index) => {
      let query = supabase.from("review_states").select("card_id", { count: "exact", head: true })
        .eq("user_id", user.id).lt("due_at", dayStartUtc(addDays(day, 1)));
      if (index > 0) query = query.gte("due_at", dayStartUtc(day));
      return query;
    }),
  ]);

  const errors = [due, mastered, allLogs, remembered, activityResult, ...forecastResults]
    .some((result) => result.error);
  if (errors) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <h1 className="text-3xl font-black">Thống kê</h1>
        <p role="alert" className="text-destructive">Không tải được thống kê. Vui lòng thử lại.</p>
        <Link href="/stats" className="font-bold text-primary underline">Tải lại</Link>
      </div>
    );
  }

  const activity = activityResult.data ?? [];
  // Same streak as the home page, counting days covered by a streak freeze.
  const streak = streakResult.streak;
  const retention = allLogs.count ? Math.round((remembered.count ?? 0) / allLogs.count * 100) : null;
  const forecast = forecastDays.map((day, index) => ({ day, count: forecastResults[index].count ?? 0 }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Thống kê học tập</h1>
          <p className="text-muted-foreground mt-1">Mỗi ngày một chút, bạn sẽ nhớ lâu hơn.</p>
        </div>
        <Link href="/review" className="bg-primary text-primary-foreground rounded-2xl px-5 py-3 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)]">Ôn ngay</Link>
      </header>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Đến hạn hôm nay" value={String(due.count ?? 0)} detail="Gồm thẻ quá hạn" />
        <Stat label="Đã thuộc" value={String(mastered.count ?? 0)} detail="Ôn thành thạo ít nhất 3 lần" />
        <Stat label="Tỷ lệ nhớ" value={retention === null ? "Chưa có" : `${retention}%`} detail="Khó, Tốt hoặc Dễ trong lượt ôn" />
        <Stat label="Chuỗi ngày học" value={`${streak} ngày`} detail="Theo giờ Việt Nam" />
      </dl>
      <ActivityCharts today={today} activity={activity} forecast={forecast} />
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
      <dt className="text-muted-foreground text-sm font-bold">{label}</dt>
      <dd className="mt-2 text-3xl font-black">{value}</dd>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </div>
  );
}

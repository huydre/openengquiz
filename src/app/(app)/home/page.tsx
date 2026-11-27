import { createElement, Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Check, Flame, GraduationCap, Map as MapIcon, RotateCcw, Search, Snowflake, Sparkles, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRecentSets, getSuggestedPaths } from "@/lib/paths/path-data";
import { getStreakStatus } from "@/lib/srs/streak-status";
import { PathCard, RecentSetCard } from "@/components/paths/path-cards";
import { vietnamDay } from "@/lib/srs/activity";
import { LogoLoader } from "@/components/layout/logo-loader";
import { lessonIcon } from "@/components/courses/lesson-icons";
import { buttonVariants } from "@/components/ui/button";
import { courseMap, getCourse } from "@/lib/courses/course-data";
import { cn } from "@/lib/utils";

export const metadata = { title: "Trang chủ" };

type Db = Awaited<ReturnType<typeof createClient>>;

export default function HomePage() {
  return (
    <Suspense fallback={<LogoLoader />}>
      <HomeContent />
    </Suspense>
  );
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** The last 7 Vietnam calendar days, oldest first, with whether the learner studied on each. */
function lastWeek(activeDays: Set<string>, frozenDays: Set<string>, now: Date) {
  const today = new Date(`${vietnamDay(now)}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    return { key, label: WEEKDAYS[day.getUTCDay()], active: activeDays.has(key), frozen: frozenDays.has(key), today: index === 6 };
  });
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

  const now = new Date();
  const [{ count: due }, { count: learned }, streakStatus] = await Promise.all([
    supabase.from("review_states")
      .select("card_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("due_at", now.toISOString()),
    supabase.from("review_states")
      .select("card_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    getStreakStatus(supabase),
  ]);
  // Streak freezes cover missed days; sync_streak (inside getStreakStatus) applies and awards them.
  const { streak, freezes } = streakStatus;
  const week = lastWeek(new Set(streakStatus.activeDays), new Set(streakStatus.frozenDays), now);
  const dueCount = due ?? 0;
  const name = profile?.display_name;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-black">Xin chào{name ? `, ${name}` : ""} 👋</h1>
        <p className="text-muted-foreground font-semibold">
          {dueCount > 0 ? `Hôm nay bạn có ${dueCount} thẻ cần ôn. Ôn xong rồi học bài mới nhé!` : "Hôm nay chưa có thẻ đến hạn. Học tiếp bài mới nào!"}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<div className="bg-card grid min-h-64 place-items-center rounded-3xl border-2"><LogoLoader size="sm" label="Đang tải khoá học" /></div>}>
          <ContinueCourse db={supabase} goal={profile?.goal} level={profile?.level} />
        </Suspense>

        <section aria-label="Chuỗi ngày học" className="bg-card flex flex-col justify-between gap-4 rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
          <div className="flex items-center gap-3">
            <span className={cn("grid size-14 place-items-center rounded-2xl", streak > 0 ? "bg-brand-orange/15 text-brand-orange" : "bg-muted text-muted-foreground")}>
              <Flame aria-hidden="true" className="size-8" />
            </span>
            <div>
              <p className="text-3xl leading-none font-black tabular-nums">{streak}</p>
              <p className="text-muted-foreground text-sm font-bold">ngày học liên tiếp</p>
            </div>
            <span
              title="Lượt đóng băng tự giữ chuỗi khi bạn lỡ một ngày. Cứ 7 ngày liên tiếp được thêm 1, giữ tối đa 2."
              className={cn("ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black", freezes ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground")}
            >
              <Snowflake aria-hidden="true" className="size-4" /> {freezes}/2
              <span className="sr-only">lượt đóng băng chuỗi</span>
            </span>
          </div>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="7 ngày gần nhất">
            {week.map((day) => (
              <li key={day.key} className="flex flex-col items-center gap-1">
                <span
                  aria-label={`${day.label}: ${day.active ? "có học" : day.frozen ? "đã đóng băng" : "chưa học"}`}
                  className={cn(
                    "grid size-8 place-items-center rounded-full border-2",
                    day.active ? "border-brand-orange bg-brand-orange text-white"
                      : day.frozen ? "border-secondary bg-secondary/15 text-secondary"
                        : "bg-muted/50 border-transparent",
                    day.today && !day.active && "border-brand-orange/50 border-dashed",
                  )}
                >
                  {day.active ? <Check aria-hidden="true" className="size-4 stroke-[3]" /> : day.frozen ? <Snowflake aria-hidden="true" className="size-4" /> : null}
                </span>
                <span className={cn("text-xs font-bold", day.today ? "text-foreground" : "text-muted-foreground")}>{day.label}</span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm font-semibold">
            {week[6].active ? "Hôm nay bạn đã học rồi, giữ vững nhé!" : "Học một chút hôm nay để giữ chuỗi."}
          </p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          href="/review"
          icon={RotateCcw}
          tone="text-brand-orange bg-brand-orange/15"
          value={dueCount}
          label="Thẻ đến hạn"
          action={dueCount > 0 ? "Ôn ngay" : "Xem lịch ôn"}
          highlight={dueCount > 0}
        />
        <StatCard href="/stats" icon={BookOpen} tone="text-secondary bg-secondary/15" value={learned ?? 0} label="Từ đã học" action="Xem thống kê" />
      </div>

      <Suspense fallback={null}>
        <RecentSets db={supabase} userId={user.id} />
      </Suspense>

      <Suspense fallback={null}>
        <SuggestedPaths db={supabase} goal={profile?.goal ?? null} />
      </Suspense>

      <section aria-labelledby="practice-title" className="space-y-3">
        <h2 id="practice-title" className="text-xl font-black">Luyện tập nhanh</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PracticeTile href="/review" icon={RotateCcw} tone="text-brand-orange bg-brand-orange/15" title="Ôn tập" subtitle="Lật thẻ theo lịch" />
          <PracticeTile href="/courses" icon={MapIcon} tone="text-brand-grape bg-brand-grape/15" title="Khoá học" subtitle="Nói, học từ, gọi điện AI" />
          <PracticeTile href="/sets" icon={BookOpen} tone="text-secondary bg-secondary/15" title="Bộ từ" subtitle="Học và gọi điện AI" />
          <PracticeTile href="/lookup" icon={Search} tone="text-secondary bg-secondary/15" title="Tra từ" subtitle="Nghĩa, ví dụ, phát âm" />
        </div>
      </section>
    </div>
  );
}

/** Sets the learner studied most recently, to jump back in. Hidden until there are some. */
async function RecentSets({ db, userId }: { db: Db; userId: string }) {
  const sets = await getRecentSets(db, userId, 4).catch(() => []);
  if (!sets.length) return null;
  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="text-xl font-black">Bộ từ đang học</h2>
        <Link href="/sets" className="text-primary-edge text-sm font-extrabold">Xem tất cả</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sets.map((set) => <RecentSetCard key={set.id} set={set} />)}
      </div>
    </section>
  );
}

/** Curated learning paths, the learner's goal first. */
async function SuggestedPaths({ db, goal }: { db: Db; goal: string | null }) {
  const paths = await getSuggestedPaths(db, goal, 3).catch(() => []);
  if (!paths.length) return null;
  return (
    <section aria-labelledby="paths-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="paths-title" className="text-xl font-black">Lộ trình gợi ý</h2>
        <Link href="/paths" className="text-primary-edge text-sm font-extrabold">Xem tất cả</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {paths.map((path, index) => <PathCard key={path.id} path={path} index={index} />)}
      </div>
    </section>
  );
}

function StatCard({ href, icon: Icon, tone, value, label, action, highlight }: {
  href: string;
  icon: LucideIcon;
  tone: string;
  value: number;
  label: string;
  action: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "bg-card group flex items-center gap-4 rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)] transition-transform hover:-translate-y-0.5",
        highlight && "border-brand-orange/40",
      )}
    >
      <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", tone)}>
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-3xl leading-none font-black tabular-nums">{value}</span>
        <span className="text-muted-foreground block text-sm font-bold">{label}</span>
      </span>
      <span className="text-primary-edge inline-flex items-center gap-1 text-sm font-extrabold group-hover:underline">
        {action} <ArrowRight aria-hidden="true" className="size-4" />
      </span>
    </Link>
  );
}

function PracticeTile({ href, icon: Icon, tone, title, subtitle }: {
  href: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card flex flex-col gap-3 rounded-3xl border-2 p-4 shadow-[0_4px_0_var(--border)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
    >
      <span className={cn("grid size-12 place-items-center rounded-2xl", tone)}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span>
        <span className="block font-black">{title}</span>
        <span className="text-muted-foreground block text-xs font-semibold">{subtitle}</span>
      </span>
    </Link>
  );
}

/** "Continue learning" hero: the next lesson of the learner's course with its activity progress. */
async function ContinueCourse({ db, goal, level }: { db: Db; goal?: string | null; level?: string | null }) {
  let slug: string | null = null;
  let selected: Awaited<ReturnType<typeof getCourse>> = null;
  let map: Awaited<ReturnType<typeof courseMap>> | null = null;
  try {
    const { data: choice, error } = await db.from("course_choices").select("course_id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const active = choice ? await db.from("courses").select("slug").eq("id", choice.course_id).single() : null;
    if (active?.error) throw active.error;
    slug = active?.data?.slug ?? (goal === "ielts" ? "ielts" : null);
    selected = slug ? await getCourse(db, slug, level) : null;
    map = selected?.level ? await courseMap(db, selected.level.id) : null;
  } catch (error) {
    console.error("Course continuation unavailable", error);
  }

  const shell = "from-sidebar-accent via-card to-card relative flex flex-col gap-5 overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-br p-6 shadow-[0_4px_0_var(--primary-edge)]";

  if (!selected?.level || !map) {
    return (
      <section className={shell}>
        <span className="bg-brand-grape/15 text-brand-grape grid size-14 place-items-center rounded-2xl"><GraduationCap aria-hidden="true" className="size-8" /></span>
        <div className="space-y-1">
          <h2 className="text-2xl font-black">Chọn một khoá học</h2>
          <p className="text-muted-foreground font-semibold">Học theo lộ trình từng bài: nói, học từ, gọi điện với gia sư AI.</p>
        </div>
        <Link href="/courses" className={buttonVariants({ size: "lg", className: "w-fit" })}>Khám phá khoá học <ArrowRight aria-hidden="true" /></Link>
      </section>
    );
  }

  // Locate the next lesson to show its title, icon and part/lesson numbers.
  let lesson: { id: string; title: string; icon: string } | undefined;
  let partNumber = 0;
  let lessonNumber = 0;
  map.parts.forEach((part, partIndex) => {
    part.course_lessons.forEach((entry, lessonIndex) => {
      if (entry.id === map!.next) {
        lesson = entry;
        partNumber = partIndex + 1;
        lessonNumber = lessonIndex + 1;
      }
    });
  });
  const percent = map.total ? Math.round((map.done / map.total) * 100) : 0;
  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-primary-edge inline-flex items-center gap-1.5 text-sm font-extrabold">
        <MapIcon aria-hidden="true" className="size-4" /> {selected.course.title} · {selected.level.title}
      </span>
      <span className="text-muted-foreground text-sm font-bold tabular-nums">{map.done}/{map.total} bài</span>
    </div>
  );
  const levelBar = (
    <div className="bg-muted h-2.5 overflow-hidden rounded-full" role="progressbar" aria-label="Tiến độ cấp độ" aria-valuemin={0} aria-valuemax={map.total} aria-valuenow={map.done}>
      <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
    </div>
  );

  if (!lesson) {
    return (
      <section className={shell}>
        {header}
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-black"><Sparkles aria-hidden="true" className="text-accent-edge" /> Bạn đã xong cấp độ này!</h2>
          <p className="text-muted-foreground font-semibold">Chọn cấp độ tiếp theo trong khoá học để học tiếp.</p>
        </div>
        {levelBar}
        <Link href={`/courses/${slug}`} className={buttonVariants({ size: "lg", className: "w-fit" })}>Mở khoá học <ArrowRight aria-hidden="true" /></Link>
      </section>
    );
  }

  const done = new Set((map.activityByLesson.get(lesson.id) ?? []).filter((row) => row.completed_at).map((row) => row.activity));
  return (
    <section aria-labelledby="continue-title" className={shell}>
      {header}
      <div className="flex items-center gap-4">
        <span className="bg-primary text-primary-foreground grid size-20 shrink-0 place-items-center rounded-3xl shadow-[0_5px_0_var(--primary-edge)]">
          {createElement(lessonIcon(lesson.icon), { "aria-hidden": true, className: "size-10" })}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-extrabold tracking-wide uppercase">{done.size ? "Học tiếp" : "Bài tiếp theo"} · Phần {partNumber} • Bài {lessonNumber}</p>
          <h2 id="continue-title" lang="en" className="truncate text-2xl font-black sm:text-3xl">{lesson.title}</h2>
          <ol className="flex gap-1.5" aria-label={`${done.size}/7 hoạt động đã xong`}>
            {Array.from({ length: 7 }, (_, index) => (
              <li key={index} className={cn("h-2 w-6 rounded-full", done.has(index + 1) ? "bg-primary" : "bg-muted-foreground/20")} />
            ))}
          </ol>
        </div>
      </div>
      {levelBar}
      <Link href={`/courses/${slug}/lessons/${lesson.id}`} className={buttonVariants({ size: "lg", className: "w-full sm:w-fit" })}>
        {done.size ? "Tiếp tục bài học" : "Bắt đầu bài học"} <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

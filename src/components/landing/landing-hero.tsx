import Link from "next/link";
import { ArrowRight, BookOpen, Check, Flame, MessagesSquare, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { VocabMarquee } from "./vocab-marquee";

const PRIMARY_CTA = "bg-primary text-primary-foreground inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase shadow-[0_5px_0_var(--primary-edge)] transition-[filter] hover:brightness-105 active:translate-y-1 active:shadow-none";
const SECONDARY_CTA = "bg-card hover:bg-muted inline-flex h-14 items-center justify-center rounded-2xl border-2 px-8 text-base font-extrabold uppercase shadow-[0_5px_0_var(--border)] active:translate-y-1 active:shadow-none";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Dot grid that fades out toward the edges, with a soft brand glow at the top. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 [background-image:radial-gradient(var(--border)_1.5px,transparent_1.5px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"
      />
      <div aria-hidden="true" className="bg-primary/20 absolute -top-48 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pt-16 text-center md:px-6 lg:pt-24">
        <p className="bg-card text-primary-edge inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-extrabold shadow-[0_3px_0_var(--border)]">
          <Sparkles aria-hidden="true" className="size-4" /> Miễn phí, không quảng cáo
        </p>
        <h1 className="mx-auto mt-7 max-w-4xl text-5xl leading-[1.05] font-black tracking-tight text-balance sm:text-7xl">
          Học từ nào, <span className="text-primary relative inline-block">
            nói
            <svg aria-hidden="true" viewBox="0 0 120 16" preserveAspectRatio="none" className="text-accent absolute -bottom-2 left-0 h-3 w-full">
              <path d="M3 11c22-7 49-9 114-4" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </span> từ đó.
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
          Học từ vựng bằng thẻ, nói thành câu để AI chấm, rồi gọi điện với gia sư AI bằng chính những từ vừa học.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/login" className={PRIMARY_CTA}>Bắt đầu học miễn phí <ArrowRight aria-hidden="true" className="size-5" /></Link>
          <a href="#tinh-nang" className={SECONDARY_CTA}>Xem tính năng</a>
        </div>
        <p className="text-muted-foreground mt-5 text-sm font-bold">Lộ trình IELTS từ lấy gốc đến nâng cao · Học trên web, không cần cài đặt</p>

        <LessonMockup />
      </div>

      <div className="relative pt-24 pb-16">
        <VocabMarquee />
      </div>
    </section>
  );
}

const ACTIVITIES = [
  { label: "Nói", icon: Mic, state: "done" },
  { label: "Học từ vựng", icon: BookOpen, state: "done" },
  { label: "Nói", icon: Mic, state: "done" },
  { label: "Nói", icon: Mic, state: "current" },
  { label: "Học từ vựng", icon: BookOpen, state: "todo" },
  { label: "Nói", icon: Mic, state: "todo" },
  { label: "Hội thoại", icon: MessagesSquare, state: "todo" },
] as const;

const CRITERIA = [
  { label: "Trôi chảy", band: 6.5, width: "w-[72%]" },
  { label: "Từ vựng", band: 7, width: "w-[78%]" },
  { label: "Ngữ pháp", band: 6, width: "w-[67%]" },
];

/** A picture of a real lesson screen: the activity list, a speaking question and the AI feedback. */
function LessonMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto mt-16 max-w-5xl select-none text-left">
      <div className="bg-card overflow-hidden rounded-[2rem] border-2 shadow-[0_10px_0_var(--border),0_30px_60px_-20px_rgb(0_0_0/0.25)]">
        {/* Window bar with the lesson title and its 7-step progress. */}
        <div className="flex items-center gap-4 border-b-2 px-5 py-3.5">
          <span className="flex gap-1.5">
            <span className="bg-destructive/70 size-3 rounded-full" />
            <span className="bg-accent size-3 rounded-full" />
            <span className="bg-primary size-3 rounded-full" />
          </span>
          <span className="truncate text-sm font-extrabold">Bài 2 · A short break</span>
          <span className="ml-auto hidden gap-1 sm:flex">
            {ACTIVITIES.map((activity, index) => (
              <span key={index} className={cn("h-2 w-7 rounded-full", activity.state === "done" ? "bg-primary" : activity.state === "current" ? "bg-secondary" : "bg-muted")} />
            ))}
          </span>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[13rem_1fr_15rem] md:p-6">
          <ol className="hidden space-y-1.5 md:block">
            {ACTIVITIES.map(({ label, icon: Icon, state }, index) => (
              <li
                key={index}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-extrabold",
                  state === "current" ? "bg-secondary/12 text-secondary border-secondary/40 border-2" : "border-2 border-transparent",
                  state === "todo" && "text-muted-foreground",
                )}
              >
                <span className={cn("grid size-7 place-items-center rounded-lg", state === "done" ? "bg-primary text-primary-foreground" : state === "current" ? "bg-secondary text-secondary-foreground" : "bg-muted")}>
                  {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                {label}
              </li>
            ))}
          </ol>

          {/* Speaking question with the learner's answer. */}
          <div className="bg-muted/50 flex flex-col items-center justify-center gap-5 rounded-3xl border-2 p-6 text-center">
            <span className="bg-secondary/12 text-secondary rounded-full px-3 py-1 text-xs font-extrabold uppercase">Luyện nói</span>
            <p lang="en" className="text-2xl font-black text-balance">What do you usually do during a short break?</p>
            <span className="bg-secondary text-secondary-foreground grid size-16 place-items-center rounded-full shadow-[0_5px_0_var(--secondary-edge)]">
              <Mic className="size-8" />
            </span>
            <span className="flex h-8 items-end gap-1">
              {[3, 6, 9, 5, 8, 4, 7, 10, 6, 4, 8, 5, 3].map((height, index) => (
                <span key={index} className="bg-secondary/60 w-1.5 rounded-full" style={{ height: `${height * 3}px` }} />
              ))}
            </span>
            <p lang="en" className="bg-card rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold">
              I usually grab a coffee and <mark className="bg-primary/20 text-foreground rounded px-1">stretch my legs</mark>.
            </p>
          </div>

          {/* AI feedback panel. */}
          <div className="space-y-4 rounded-3xl border-2 p-5">
            <div>
              <p className="text-muted-foreground text-xs font-extrabold uppercase">AI chấm</p>
              <p className="text-5xl font-black">6.5</p>
              <p className="text-muted-foreground text-sm font-bold">Band ước lượng</p>
            </div>
            <ul className="space-y-3">
              {CRITERIA.map((criterion) => (
                <li key={criterion.label}>
                  <span className="flex justify-between text-sm font-extrabold">{criterion.label}<span>{criterion.band}</span></span>
                  <span className="bg-muted mt-1 block h-2 rounded-full"><span className={cn("bg-primary block h-full rounded-full", criterion.width)} /></span>
                </li>
              ))}
            </ul>
            <div className="bg-primary/10 rounded-2xl px-3 py-2">
              <p className="text-muted-foreground text-xs font-extrabold uppercase">Từ đã dùng</p>
              <p className="text-primary-edge flex items-center gap-1.5 text-sm font-extrabold"><Check className="size-4 shrink-0" /> stretch my legs</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card absolute -bottom-12 -left-3 hidden items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 shadow-[0_4px_0_var(--border)] sm:flex md:-left-10">
        <span className="bg-brand-orange/15 text-brand-orange grid size-9 place-items-center rounded-xl"><Flame className="size-5" /></span>
        <span className="leading-tight">
          <span className="block text-lg font-black">7 ngày</span>
          <span className="text-muted-foreground block text-xs font-bold">học liên tiếp</span>
        </span>
      </div>
      <div className="bg-card absolute -right-3 -bottom-12 hidden items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 shadow-[0_4px_0_var(--border)] sm:flex md:-right-10">
        <span className="bg-primary/15 text-primary grid size-9 place-items-center rounded-xl"><Mic className="size-5" /></span>
        <span className="leading-tight">
          <span className="text-muted-foreground block text-xs font-bold">Phát âm</span>
          <span className="text-lg font-black">92<span className="text-muted-foreground text-sm">/100</span></span>
        </span>
      </div>
    </div>
  );
}

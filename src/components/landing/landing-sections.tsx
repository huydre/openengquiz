import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { ArrowRight, BookOpen, CalendarClock, Check, Coffee, ImageIcon, Laptop, Mic, Phone, Plane, Search, Trophy } from "lucide-react";
import { parseCourseCatalog } from "@/lib/courses/course-catalog";
import { cn } from "@/lib/utils";

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-primary-edge text-sm font-extrabold tracking-wide uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-4xl font-black tracking-tight text-balance">{title}</h2>
      <p className="text-muted-foreground mt-3 text-lg">{description}</p>
    </div>
  );
}

const STEPS = [
  { icon: BookOpen, tone: "bg-primary/15 text-primary", title: "Học từ", text: "Thẻ có phát âm, ví dụ và GIF minh hoạ. Nhớ nghĩa, điền vào câu, nói lại từng từ." },
  { icon: Mic, tone: "bg-secondary/15 text-secondary", title: "Nói ra", text: "Trả lời câu hỏi bằng giọng nói. AI nhận xét, chấm band và gợi ý câu trả lời tốt hơn." },
  { icon: Phone, tone: "bg-brand-orange/15 text-brand-orange", title: "Dùng thật", text: "Gọi điện với gia sư AI và dùng đúng những từ vừa học trong một cuộc trò chuyện." },
];

export function LandingSteps() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <SectionTitle eyebrow="Cách học" title="Mỗi bài học, ba bước" description="Không chỉ lật thẻ. Từ mới được nói ra và dùng ngay, nên nhớ lâu hơn." />
      <ol className="mt-12 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, tone, title, text }, index) => (
          <li key={title} className="bg-card relative rounded-3xl border-2 p-6 shadow-[0_5px_0_var(--border)]">
            <span className="text-muted-foreground/40 absolute top-5 right-6 text-5xl font-black">{index + 1}</span>
            <span className={cn("grid size-14 place-items-center rounded-2xl", tone)}><Icon aria-hidden="true" className="size-7" /></span>
            <h3 className="mt-5 text-2xl font-black">{title}</h3>
            <p className="text-muted-foreground mt-2 leading-relaxed">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SET_SAMPLES = [
  { icon: Plane, word: "travel", tone: "bg-secondary/15 text-secondary" },
  { icon: Coffee, word: "coffee", tone: "bg-brand-orange/15 text-brand-orange" },
  { icon: Laptop, word: "laptop", tone: "bg-primary/15 text-primary" },
];

function FeatureCard({ icon: Icon, tone, title, text, className, children }: {
  icon: typeof Mic;
  tone: string;
  title: string;
  text: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={cn("bg-card flex flex-col gap-4 overflow-hidden rounded-3xl border-2 p-6 shadow-[0_5px_0_var(--border)]", className)}>
      <span className={cn("grid size-12 place-items-center rounded-2xl", tone)}><Icon aria-hidden="true" className="size-6" /></span>
      <div>
        <h3 className="text-xl font-black">{title}</h3>
        <p className="text-muted-foreground mt-1.5 leading-relaxed">{text}</p>
      </div>
      {children ? <div aria-hidden="true" className="mt-auto">{children}</div> : null}
    </article>
  );
}

export function LandingFeatures() {
  return (
    <section id="tinh-nang" className="bg-muted/50 scroll-mt-16 border-y-2 py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionTitle eyebrow="Tính năng" title="Đủ để học mỗi ngày" description="Mọi thứ dùng chung một kho từ của bạn, từ thẻ ghi nhớ đến luyện nói." />
        <div className="mt-12 grid gap-5 md:grid-cols-6">
          <FeatureCard icon={Phone} tone="bg-brand-orange/15 text-brand-orange" title="Gọi điện với gia sư AI" text="Nói rảnh tay: AI tự nghe khi bạn dừng nói, trả lời bằng giọng đọc tự nhiên và nhắc từ cần dùng." className="md:col-span-4">
            <div className="space-y-2">
              <p className="bg-muted w-fit max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 font-semibold" lang="en">How do you usually get to work?</p>
              <p className="bg-primary text-primary-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 font-semibold" lang="en">I <u>commute</u> by bus every morning.</p>
            </div>
          </FeatureCard>
          <FeatureCard icon={Mic} tone="bg-primary/15 text-primary" title="Chấm phát âm" text="Biết âm nào đúng, âm nào cần sửa." className="md:col-span-2">
            <p className="text-3xl font-black tracking-wide" lang="en">
              <span className="text-primary">com</span><span className="text-brand-orange">mu</span><span className="text-primary">te</span>
            </p>
          </FeatureCard>
          <FeatureCard icon={CalendarClock} tone="bg-secondary/15 text-secondary" title="Ôn đúng lúc sắp quên" text="Lịch ôn ngắt quãng tự giãn ra khi bạn nhớ tốt." className="md:col-span-2">
            <div className="flex items-end gap-2">
              {[["1 ngày", "h-6"], ["3 ngày", "h-10"], ["7 ngày", "h-14"], ["14 ngày", "h-20"]].map(([label, height]) => (
                <span key={label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className={cn("bg-secondary/70 w-full rounded-lg", height)} />
                  <span className="text-muted-foreground text-[11px] font-bold">{label}</span>
                </span>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard icon={Search} tone="bg-brand-grape/15 text-brand-grape" title="Tra từ đầy đủ" text="Mọi nghĩa, ví dụ, từ đồng nghĩa. Gõ tiếng Việt cũng ra từ tiếng Anh." className="md:col-span-2">
            <div className="bg-muted space-y-1.5 rounded-2xl p-3">
              <p className="font-extrabold">đông đúc</p>
              <p className="flex flex-wrap gap-1.5" lang="en">
                {["crowded", "busy", "packed"].map((word) => <span key={word} className="bg-card rounded-full border-2 px-2.5 py-0.5 text-sm font-bold">{word}</span>)}
              </p>
            </div>
          </FeatureCard>
          <FeatureCard icon={ImageIcon} tone="bg-brand-sky/20 text-secondary" title="Bộ từ của bạn" text="Tạo bộ từ bằng AI, gắn ảnh hoặc GIF meme, chia sẻ bằng link." className="md:col-span-2">
            <div className="grid grid-cols-3 gap-2">
              {SET_SAMPLES.map(({ icon: Icon, word, tone }) => (
                <span key={word} className="flex flex-col items-center gap-1.5">
                  <span className={cn("grid aspect-square w-full place-items-center rounded-2xl", tone)}><Icon className="size-7" /></span>
                  <span className="text-xs font-extrabold" lang="en">{word}</span>
                </span>
              ))}
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

/** Level names and lesson counts come from the course catalog, so the roadmap stays accurate. */
async function courseLevels() {
  "use cache";
  cacheLife("days");
  const source = await readFile(path.join(process.cwd(), "content/courses/ielts.yaml"), "utf8");
  return parseCourseCatalog(source).levels.map((level) => ({
    title: level.title,
    lessons: level.parts.reduce((total, part) => total + part.lessons.length, 0),
  }));
}

export async function LandingCoursePath() {
  const levels = await courseLevels();
  return (
    <section id="lo-trinh" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 md:px-6">
      <SectionTitle eyebrow="Lộ trình" title="IELTS từ lấy gốc đến nâng cao" description={`${levels.length} cấp độ, mỗi bài có 7 hoạt động xen kẽ học từ và luyện nói.`} />
      <ol className="relative mx-auto mt-12 max-w-3xl space-y-4">
        <span aria-hidden="true" className="bg-border absolute top-6 bottom-6 left-7 w-1 rounded-full" />
        {levels.map((level, index) => (
          <li key={level.title} className="relative flex items-center gap-4">
            <span className={cn(
              "relative grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-black",
              index === 0 ? "bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-edge)]" : "bg-card border-2 shadow-[0_4px_0_var(--border)]",
            )}>
              {index === 0 ? <Check aria-hidden="true" className="size-6" /> : index === levels.length - 1 ? <Trophy aria-hidden="true" className="text-accent size-6" /> : index + 1}
            </span>
            <div className="bg-card flex flex-1 items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3.5">
              <span className="text-lg font-extrabold">{level.title}</span>
              <span className="text-muted-foreground text-sm font-bold">{level.lessons} bài</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LandingFinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
      <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-[2rem] px-6 py-14 text-center shadow-[0_8px_0_var(--primary-edge)]">
        <div aria-hidden="true" className="absolute -top-16 -right-10 size-56 rounded-full bg-white/15" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/10" />
        <h2 className="relative text-4xl font-black tracking-tight text-balance">Bắt đầu với từ đầu tiên hôm nay</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-lg font-semibold opacity-90">Miễn phí, chỉ cần một tài khoản. Mỗi ngày vài phút là đủ.</p>
        <Link
          href="/login"
          className="text-primary-edge relative mt-8 inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-extrabold uppercase shadow-[0_5px_0_rgb(0_0_0/0.15)] active:translate-y-1 active:shadow-none"
        >
          Tạo tài khoản miễn phí <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, Bus, Flame, Mic, Sparkles, Volume2 } from "lucide-react";
import { Ipa } from "@/components/vocab/ipa-text";
import { FlipText } from "@/components/obsidian/flip-text";
import { VocabMarquee } from "./vocab-marquee";

const PRIMARY_CTA = "bg-primary text-primary-foreground inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase shadow-[0_5px_0_var(--primary-edge)] transition-[filter] hover:brightness-105 active:translate-y-1 active:shadow-none";
const SECONDARY_CTA = "bg-card hover:bg-muted inline-flex h-14 items-center justify-center rounded-2xl border-2 px-8 text-base font-extrabold uppercase shadow-[0_5px_0_var(--border)] active:translate-y-1 active:shadow-none";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand glow behind the hero. */}
      <div aria-hidden="true" className="bg-primary/15 absolute -top-40 -left-32 size-[32rem] rounded-full blur-3xl" />
      <div aria-hidden="true" className="bg-secondary/15 absolute top-20 -right-40 size-[28rem] rounded-full blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
        <div className="text-center lg:text-left">
          <p className="bg-primary/10 text-primary-edge inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold">
            <Sparkles aria-hidden="true" className="size-4" /> Miễn phí, không quảng cáo
          </p>
          <h1 className="mt-6 text-5xl leading-[1.05] font-black tracking-tight text-balance sm:text-6xl">
            Học từ nào, <FlipText className="text-primary" duration={3}>nói</FlipText> từ đó.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg leading-relaxed lg:mx-0">
            Mỗi bài học đưa bạn từ thẻ từ vựng đến nói thành câu và gọi điện với gia sư AI, dùng đúng những từ vừa học. Lộ trình IELTS từ lấy gốc đến nâng cao.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
            <Link href="/login" className={PRIMARY_CTA}>Bắt đầu học <ArrowRight aria-hidden="true" className="size-5" /></Link>
            <a href="#tinh-nang" className={SECONDARY_CTA}>Xem tính năng</a>
          </div>
        </div>
        <HeroVisual />
      </div>
      <div className="relative pb-16">
        <VocabMarquee />
      </div>
    </section>
  );
}

/** A flashcard like the ones in the app, with the speaking score and streak floating around it. */
function HeroVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md select-none">
      <div className="border-secondary/40 bg-secondary/10 absolute inset-0 translate-x-6 translate-y-4 rotate-6 rounded-[2rem] border-2" />
      <div className="border-brand-orange/40 bg-brand-orange/10 absolute inset-0 -translate-x-5 translate-y-3 -rotate-4 rounded-[2rem] border-2" />
      <div className="bg-card relative flex flex-col items-center gap-4 rounded-[2rem] border-2 px-8 py-10 text-center shadow-[0_8px_0_var(--border)]">
        <span className="bg-secondary/10 text-secondary rounded-full px-3 py-1 text-xs font-extrabold">verb</span>
        <span className="bg-secondary/15 text-secondary grid size-24 place-items-center rounded-3xl">
          <Bus className="size-12" />
        </span>
        <p lang="en" className="text-5xl font-black">commute</p>
        <p className="text-muted-foreground text-lg"><Ipa value="kəˈmjuːt" /></p>
        <span className="bg-secondary text-secondary-foreground grid size-14 place-items-center rounded-full shadow-[0_4px_0_var(--secondary-edge)]">
          <Volume2 className="size-7" />
        </span>
        <p className="text-muted-foreground text-sm font-bold">đi làm, đi học hằng ngày</p>
      </div>
      <div className="bg-card absolute -top-5 -right-3 flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 shadow-[0_4px_0_var(--border)] sm:-right-8">
        <span className="bg-primary/15 text-primary grid size-9 place-items-center rounded-xl"><Mic className="size-5" /></span>
        <span className="text-left leading-tight">
          <span className="text-muted-foreground block text-xs font-bold">Phát âm</span>
          <span className="text-lg font-black">92<span className="text-muted-foreground text-sm">/100</span></span>
        </span>
      </div>
      <div className="bg-card absolute -bottom-6 -left-3 flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 shadow-[0_4px_0_var(--border)] sm:-left-8">
        <span className="bg-brand-orange/15 text-brand-orange grid size-9 place-items-center rounded-xl"><Flame className="size-5" /></span>
        <span className="text-left leading-tight">
          <span className="block text-lg font-black">7 ngày</span>
          <span className="text-muted-foreground block text-xs font-bold">học liên tiếp</span>
        </span>
      </div>
    </div>
  );
}

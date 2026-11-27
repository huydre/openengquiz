"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import Container from "./container";
import Heading from "./heading";
import SubHeading from "./subheading";
import { DotGrid } from "./decor";

const ROTATING_GOALS = ["IELTS", "TOEIC", "THPT", "giao tiếp"] as const;

/** Sample cards for the collage. Words, IPA and meanings are ordinary dictionary data. */
const WORD_CARDS = [
  { term: "serendipity", ipa: "/ˌser.ənˈdɪp.ə.ti/", vi: "sự tình cờ may mắn", pos: "noun" },
  { term: "resilient", ipa: "/rɪˈzɪl.i.ənt/", vi: "kiên cường", pos: "adj" },
  { term: "thrive", ipa: "/θraɪv/", vi: "phát triển mạnh", pos: "verb" },
  { term: "meticulous", ipa: "/məˈtɪk.jə.ləs/", vi: "tỉ mỉ", pos: "adj" },
  { term: "bite the bullet", ipa: "", vi: "cắn răng chịu đựng", pos: "idiom" },
  { term: "eloquent", ipa: "/ˈel.ə.kwənt/", vi: "hùng hồn, lưu loát", pos: "adj" },
  { term: "commute", ipa: "/kəˈmjuːt/", vi: "đi làm hằng ngày", pos: "verb" },
  { term: "breakthrough", ipa: "/ˈbreɪk.θruː/", vi: "bước đột phá", pos: "noun" },
  { term: "scalable", ipa: "/ˈskeɪ.lə.bəl/", vi: "có thể mở rộng", pos: "adj" },
] as const;

const CARD_POSITIONS = [
  { top: "-6%", left: "-4%", width: "26%", rotate: "-14deg", zIndex: 1 },
  { top: "-6%", right: "-4%", width: "26%", rotate: "14deg", zIndex: 1 },
  { top: "12%", left: "6%", width: "28%", rotate: "-8deg", zIndex: 2 },
  { top: "12%", right: "6%", width: "28%", rotate: "8deg", zIndex: 2 },
  { top: "34%", left: "14%", width: "30%", rotate: "-3deg", zIndex: 3 },
  { top: "34%", right: "14%", width: "30%", rotate: "3deg", zIndex: 3 },
  { top: "2%", left: "36%", width: "28%", rotate: "0deg", zIndex: 0 },
  { top: "62%", left: "8%", width: "26%", rotate: "-5deg", zIndex: 2 },
  { top: "50%", left: "33%", width: "34%", rotate: "0deg", zIndex: 10 },
] as const;

function WordCard({ card }: { card: (typeof WORD_CARDS)[number] }) {
  return (
    <div className="bg-background flex aspect-[4/3] w-full flex-col justify-between border border-white/10 p-4 shadow-2xl sm:p-6">
      <span className="text-primary font-mono text-[10px] tracking-widest uppercase">
        {"// "}
        {card.pos}
      </span>
      <div>
        <div className="text-foreground font-sans text-lg font-extrabold sm:text-2xl">{card.term}</div>
        {card.ipa && <div className="font-mono text-xs text-white/40">{card.ipa}</div>}
      </div>
      <div className="font-mono text-xs text-white/70 sm:text-sm">{card.vi}</div>
    </div>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const [goalIndex, setGoalIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setGoalIndex((i) => (i + 1) % ROTATING_GOALS.length), 2800);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <section className="relative flex min-h-screen w-full flex-col justify-center overflow-x-hidden pt-32 pb-24 font-mono">
      <DotGrid />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent)_0%,transparent_70%)]"
      />

      <Container className="relative z-10 flex flex-1 flex-col justify-center">
        <motion.div
          className="mx-auto flex max-w-4xl flex-col items-center text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={itemVariants}
            className="text-primary mb-10 inline-flex items-center gap-2 border border-white/10 bg-white/3 px-4 py-1.5 text-xs font-bold tracking-widest uppercase backdrop-blur-sm"
          >
            Miễn phí · Không cần thẻ thanh toán
          </motion.div>

          <motion.div variants={itemVariants}>
            <Heading as="h1" variant="big" className="text-foreground mb-2 font-sans leading-[0.95]">
              Học từ nào, nói từ đó
            </Heading>
          </motion.div>

          <motion.div variants={itemVariants} aria-hidden="true">
            <Heading as="h2" variant="big" className="mb-8 font-sans leading-[0.95]">
              <span className="text-foreground">cho </span>
              <span className="relative inline-block min-w-[3ch]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={ROTATING_GOALS[goalIndex]}
                    className="text-primary inline-block"
                    initial={{ y: 12, opacity: 0, filter: "blur(4px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -12, opacity: 0, filter: "blur(4px)", transition: { duration: 0.15 } }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {ROTATING_GOALS[goalIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </Heading>
          </motion.div>

          <motion.div variants={itemVariants}>
            <SubHeading variant="big" className="mb-12 max-w-2xl text-pretty">
              Flashcard, ôn tập ngắt quãng và luyện nói với AI bằng chính những từ bạn đang học.
              Học trên web, không quảng cáo.
            </SubHeading>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group text-primary-foreground bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold uppercase transition-all active:scale-[0.97]"
            >
              Bắt đầu học
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <a
              href="#tinh-nang"
              className="text-foreground inline-flex items-center justify-center border border-white/10 px-8 py-3 text-sm font-bold uppercase transition-all hover:bg-white/5 active:scale-[0.97]"
            >
              Xem tính năng
            </a>
          </motion.div>

          <motion.ul variants={itemVariants} className="mt-16 flex flex-wrap justify-center gap-4 sm:gap-6">
            {["Flashcard", "Ôn tập ngắt quãng", "Luyện nói AI"].map((tag) => (
              <li
                key={tag}
                className="border border-white/5 bg-white/2 px-4 py-2 text-xs font-bold tracking-wider text-white/60 uppercase"
              >
                {tag}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          aria-hidden="true"
          className="pointer-events-none relative mx-auto mt-24 h-[360px] w-full max-w-6xl sm:h-[520px] md:h-[640px]"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.8 } } }}
        >
          {WORD_CARDS.map((card, i) => (
            <motion.div
              key={card.term}
              className="pointer-events-auto absolute"
              style={{ ...CARD_POSITIONS[i], transformOrigin: "center center" }}
              variants={{
                hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
                visible: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              whileHover={{ scale: 1.05, zIndex: 50, transition: { duration: 0.4 } }}
            >
              <WordCard card={card} />
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}

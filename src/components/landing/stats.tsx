"use client";

import { useEffect, useRef } from "react";
import { BadgePercent, Ear, Layers, Target } from "lucide-react";
import { animate, motion, useInView, type Variants } from "motion/react";
import Container from "./container";
import Heading from "./heading";
import { CornerAccents, GuideLines, SectionLabel } from "./decor";

// Facts about how the product is designed, not usage metrics.
const STATS = [
  { value: 100, suffix: "%", label: "Miễn phí", icon: BadgePercent },
  { value: 4, suffix: "", label: "Mục tiêu: IELTS · TOEIC · THPT · Giao tiếp", icon: Target },
  { value: 4, suffix: "", label: "Kỹ năng: nghe · nói · đọc · viết", icon: Ear },
  { value: 1, suffix: "", label: "Bộ từ cho mọi cách học", icon: Layers },
];

function CountingNumber({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView || !ref.current) return;
    const controls = animate(0, value, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = Math.round(latest).toString();
      },
    });
    return controls.stop;
  }, [isInView, value]);

  return (
    <span className="tabular-nums">
      {/* Server-render the final value so the number is correct without JavaScript. */}
      <span ref={ref}>{value}</span>
      {suffix}
    </span>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0, 0, 1] } },
};

export default function Stats() {
  return (
    <section className="relative w-full overflow-hidden bg-[#101010] py-24 font-mono md:py-32">
      <GuideLines />
      <Container className="relative z-10 mx-auto">
        <motion.div
          className="mb-16 flex flex-col items-start text-left md:items-center md:text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div variants={itemVariants} className="mb-8">
            <SectionLabel>Một nền tảng</SectionLabel>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Heading as="h2" variant="big" className="text-foreground font-sans text-balance">
              Mọi thứ để <br />
              <span className="text-primary">dùng được từ vựng</span>
            </Heading>
          </motion.div>
          <motion.p
            variants={itemVariants}
            className="mt-6 max-w-2xl text-sm tracking-widest text-pretty text-white/50 uppercase"
          >
            Không chỉ thuộc nghĩa. Nhớ lâu, nghe ra, nói được.
          </motion.p>
        </motion.div>

        <motion.ul
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {STATS.map(({ value, suffix, label, icon: Icon }) => (
            <motion.li
              key={label}
              variants={itemVariants}
              className="group relative border border-white/10 bg-neutral-950 transition-colors duration-300 hover:bg-white/2"
            >
              <CornerAccents />
              <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                <Icon className="text-primary mb-6 size-6 opacity-80 transition-transform duration-300 group-hover:scale-110" />
                <div className="text-foreground mb-3 text-4xl font-bold tracking-tight lg:text-5xl">
                  <CountingNumber value={value} suffix={suffix} />
                </div>
                <div className="text-xs font-bold tracking-widest text-white/40 uppercase">{label}</div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}

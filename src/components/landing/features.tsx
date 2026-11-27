"use client";

import { Layers, Map, Mic, RotateCcw } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import Container from "./container";
import Heading from "./heading";
import { CornerAccents, DotGrid, SectionLabel } from "./decor";
import { FlashcardVisual, PathsVisual, ReviewVisual, SpeakingVisual } from "./feature-visuals";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0, 0, 1] } },
};

function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  descriptionClassName,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  className?: string;
  descriptionClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.li variants={itemVariants} className={cn("h-full w-full", className)}>
      <div className="group relative h-full w-full border border-white/10 bg-black/40 transition-colors duration-300 hover:bg-white/2">
        <CornerAccents />
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-center overflow-hidden p-8">
          <Icon className="text-primary mb-6 size-8 opacity-80 transition-transform duration-300 group-hover:scale-110" />
          <h3 className="text-foreground mb-3 text-xl font-bold tracking-widest uppercase">{title}</h3>
          <p
            className={cn(
              "max-w-md text-sm leading-relaxed tracking-widest text-pretty text-white/50 uppercase",
              descriptionClassName,
            )}
          >
            {description}
          </p>
          {children}
        </div>
      </div>
    </motion.li>
  );
}

export default function Features() {
  return (
    <section id="tinh-nang" className="relative scroll-mt-20 overflow-hidden bg-[#101010] py-24 font-mono md:py-32">
      <DotGrid />
      <Container className="relative z-10 mx-auto">
        <motion.div
          className="mb-16 flex flex-col items-start text-left md:items-center md:text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div variants={itemVariants} className="mb-8">
            <SectionLabel>Tính năng</SectionLabel>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Heading as="h2" variant="big" className="text-foreground font-sans text-balance">
              Học thế nào với <span className="text-primary">OpenEngQuiz</span>?
            </Heading>
          </motion.div>
        </motion.div>

        <motion.ul
          className="grid auto-rows-[minmax(320px,auto)] grid-cols-1 gap-6 lg:grid-cols-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <FeatureCard
            className="lg:col-span-2"
            icon={Layers}
            title="Flashcard đủ kiểu"
            descriptionClassName="sm:max-w-[calc(100%-12rem)]"
            description="Thẻ lật, trắc nghiệm, nghe chép, gõ từ. Một bộ từ dùng cho mọi chế độ."
          >
            <FlashcardVisual />
          </FeatureCard>
          <FeatureCard
            className="lg:col-span-3"
            icon={Mic}
            title="Luyện nói với AI"
            description="Trả lời câu hỏi bằng chính từ vừa học. AI sửa ngữ pháp và chấm phát âm."
          >
            <SpeakingVisual />
          </FeatureCard>
          <FeatureCard
            className="lg:col-span-3"
            icon={RotateCcw}
            title="Ôn tập ngắt quãng"
            description="Lịch ôn tự giãn ra theo trí nhớ của bạn. Ôn đúng lúc sắp quên."
          >
            <ReviewVisual />
          </FeatureCard>
          <FeatureCard
            className="lg:col-span-2"
            icon={Map}
            title="Lộ trình có sẵn"
            description="IELTS, TOEIC, THPT, giao tiếp. Biết ngay hôm nay học gì."
          >
            <PathsVisual />
          </FeatureCard>
        </motion.ul>
      </Container>
    </section>
  );
}

"use client";

import { DraggableMarquee } from "@/components/obsidian/draggable-marquee";
import { cn } from "@/lib/utils";

const WORDS = [
  { term: "commute", meaning: "đi làm hằng ngày", tone: "bg-secondary/12 border-secondary/30" },
  { term: "resilient", meaning: "kiên cường", tone: "bg-primary/12 border-primary/30" },
  { term: "bite the bullet", meaning: "cắn răng chịu đựng", tone: "bg-brand-orange/12 border-brand-orange/30" },
  { term: "breakthrough", meaning: "bước đột phá", tone: "bg-brand-grape/12 border-brand-grape/30" },
  { term: "meticulous", meaning: "tỉ mỉ", tone: "bg-secondary/12 border-secondary/30" },
  { term: "thrive", meaning: "phát triển mạnh", tone: "bg-primary/12 border-primary/30" },
  { term: "crowded", meaning: "đông đúc", tone: "bg-brand-orange/12 border-brand-orange/30" },
  { term: "get the hang of", meaning: "dần quen với", tone: "bg-brand-grape/12 border-brand-grape/30" },
];

/** A draggable strip of sample vocabulary under the hero. */
export function VocabMarquee() {
  return (
    <DraggableMarquee
      items={WORDS.map((word) => ({ ...word, id: word.term, src: word.term }))}
      speed={0.6}
      gapClassName="gap-4"
      itemClassName=""
      label="Ví dụ từ vựng. Kéo hoặc dùng phím mũi tên trái phải."
      renderItem={(item) => {
        const word = WORDS.find((entry) => entry.term === item.src) ?? WORDS[0];
        return (
          <div className={cn("rounded-2xl border-2 px-5 py-3", word.tone)}>
            <p lang="en" className="text-lg font-black whitespace-nowrap">{word.term}</p>
            <p className="text-muted-foreground text-sm font-bold whitespace-nowrap">{word.meaning}</p>
          </div>
        );
      }}
    />
  );
}

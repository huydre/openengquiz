"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Quote, RotateCcw, Volume2 } from "lucide-react";
import { playTts, type TtsAccent } from "@/lib/speech/play-tts";
import type { LessonCard } from "./vocab-lesson";

/**
 * Two-sided vocabulary card with a 3D flip (same technique as Watermelon's flip-card:
 * two faces rotated on Y with hidden backfaces). Front: word, part of speech, IPA, audio.
 * Back: meanings, example with translation, synonyms. The word is spoken when the card appears.
 */
export function FlipFlashcard({ card, flipped, onFlip, accent = "en-US", autoPlay = true }: {
  card: LessonCard;
  flipped: boolean;
  onFlip: () => void;
  accent?: TtsAccent;
  autoPlay?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const synonyms = card.synonyms?.filter(Boolean).slice(0, 5) ?? [];

  useEffect(() => {
    if (autoPlay) void playTts(card.term, { accent });
  }, [card.term, accent, autoPlay]);

  const face = "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 p-6 text-center [backface-visibility:hidden]";
  const turn = { duration: reduceMotion ? 0 : 0.5, ease: [0.2, 0.8, 0.2, 1] as const };

  function speak(event: React.MouseEvent, text: string) {
    event.stopPropagation();
    void playTts(text, { accent });
  }

  return (
    <div className="mx-auto h-80 w-full max-w-lg [perspective:1200px]">
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? `Mặt nghĩa của ${card.term}. Bấm để lật lại` : `${card.term}. Bấm để xem nghĩa`}
        onClick={onFlip}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onFlip();
          }
        }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={turn}
        className="relative h-full w-full cursor-pointer rounded-3xl outline-none [transform-style:preserve-3d] focus-visible:ring-4 focus-visible:ring-ring/40"
      >
        {/* Front */}
        <div className={`${face} border-secondary/40 bg-card shadow-[0_6px_0_var(--border)]`}>
          {card.part_of_speech ? (
            <span className="bg-secondary/10 text-secondary rounded-full px-3 py-1 text-xs font-extrabold">{card.part_of_speech}</span>
          ) : null}
          <p lang="en" className="text-5xl font-black break-words">{card.term}</p>
          {card.ipa ? <p className="text-muted-foreground text-lg">{card.ipa}</p> : null}
          <button
            type="button"
            aria-label={`Nghe phát âm ${card.term}`}
            onClick={(event) => speak(event, card.term)}
            className="bg-secondary text-secondary-foreground grid size-14 place-items-center rounded-full shadow-[0_4px_0_var(--secondary-edge)] active:translate-y-1 active:shadow-none"
          >
            <Volume2 aria-hidden="true" className="size-7" />
          </button>
          <span className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-sm font-bold">
            <RotateCcw aria-hidden="true" className="size-4" /> Chạm hoặc Space để lật
          </span>
        </div>

        {/* Back */}
        <div className={`${face} border-primary/40 bg-sidebar-accent shadow-[0_6px_0_var(--primary-edge)] [transform:rotateY(180deg)]`}>
          <p className="text-3xl font-black">{card.definition_vi ?? card.definition_en ?? "Chưa có nghĩa"}</p>
          {card.definition_vi && card.definition_en ? (
            <p lang="en" className="text-muted-foreground text-sm">{card.definition_en}</p>
          ) : null}
          {card.example_en ? (
            <div className="bg-card w-full space-y-1 rounded-2xl p-3 text-left">
              <p className="flex items-start gap-2">
                <Quote aria-hidden="true" className="text-secondary mt-1 size-4 shrink-0" />
                <span lang="en" className="flex-1 font-semibold">{card.example_en}</span>
                <button
                  type="button"
                  aria-label="Nghe câu ví dụ"
                  onClick={(event) => speak(event, card.example_en!)}
                  className="text-secondary hover:bg-muted grid size-8 shrink-0 place-items-center rounded-full"
                >
                  <Volume2 aria-hidden="true" className="size-4" />
                </button>
              </p>
              {card.example_vi ? <p className="text-muted-foreground pl-6 text-sm">{card.example_vi}</p> : null}
            </div>
          ) : null}
          {synonyms.length ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {synonyms.map((word) => (
                <button
                  key={word}
                  type="button"
                  lang="en"
                  onClick={(event) => speak(event, word)}
                  className="bg-card rounded-full border-2 px-2.5 py-0.5 text-xs font-bold"
                >
                  {word}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

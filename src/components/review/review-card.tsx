"use client";

import { Button } from "@/components/ui/button";
import { FlipFlashcard } from "@/components/vocab/flip-flashcard";
import type { ReviewItem } from "./review-types";

export function ReviewCard({ item, flipped, onFlip }: {
  item: ReviewItem;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <section aria-label="Thẻ ôn tập" className="space-y-4">
      <FlipFlashcard
        key={item.cardId}
        card={{
          id: item.cardId,
          term: item.term,
          ipa: item.ipa,
          part_of_speech: item.partOfSpeech,
          definition_vi: item.definitionVi,
          definition_en: item.definitionEn,
          example_en: item.exampleEn,
          example_vi: item.exampleVi,
          synonyms: null,
        }}
        flipped={flipped}
        onFlip={onFlip}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm font-bold">{item.setTitle}</span>
        {item.isNew ? <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">Thẻ mới</span> : null}
      </div>
      {!flipped ? <Button onClick={onFlip} className="w-full">Hiện đáp án</Button> : null}
    </section>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "./review-types";

export function ReviewCard({ item, flipped, onFlip }: {
  item: ReviewItem;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <section aria-label="Thẻ ôn tập" className="space-y-4">
      <button
        type="button"
        aria-pressed={flipped}
        onClick={onFlip}
        className="focus-visible:ring-primary flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 bg-card p-8 text-center shadow-[0_4px_0_var(--border)] outline-none focus-visible:ring-4"
      >
        <span className="text-muted-foreground text-sm font-bold uppercase">
          {flipped ? "Mặt sau" : "Mặt trước"}
        </span>
        <span className="text-3xl font-black sm:text-4xl">
          {flipped ? item.definitionVi || item.definitionEn || "Chưa có nghĩa" : item.term}
        </span>
        {flipped && item.exampleEn ? (
          <span className="text-muted-foreground text-sm">{item.exampleEn}</span>
        ) : null}
        {flipped && item.exampleVi ? (
          <span className="text-muted-foreground text-sm">{item.exampleVi}</span>
        ) : null}
        {!flipped && item.ipa ? <span className="text-muted-foreground">{item.ipa}</span> : null}
        <span className="text-muted-foreground text-xs">Chạm hoặc nhấn Space để lật</span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm font-bold">{item.setTitle}</span>
        {item.isNew ? <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">Thẻ mới</span> : null}
      </div>
      {!flipped ? <Button onClick={onFlip} className="w-full">Hiện đáp án</Button> : null}
    </section>
  );
}

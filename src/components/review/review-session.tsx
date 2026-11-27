"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "./review-card";
import { RatingButtons } from "./rating-buttons";
import type { ReviewItem, ReviewRating } from "./review-types";

type Attempt = { cardId: string; rating: ReviewRating; clientReviewId: string };

export function ReviewSession({ items, newRemaining }: {
  items: ReviewItem[];
  newRemaining: number;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const attemptRef = useRef<Attempt | null>(null);
  const pendingRef = useRef(false);
  const item = items[index];
  const remainingNew = Math.max(0, newRemaining - items.slice(0, index).filter((entry) => entry.isNew).length);

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!item || !flipped || pendingRef.current) return;
    const attempt = attemptRef.current ?? {
      cardId: item.cardId,
      rating,
      clientReviewId: crypto.randomUUID(),
    };
    if (attempt.cardId !== item.cardId || attempt.rating !== rating) return;
    attemptRef.current = attempt;
    pendingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
      });
      if (response.status === 409 || response.status === 429) {
        window.location.reload();
        return;
      }
      if (!response.ok) throw new Error("Không lưu được lượt ôn. Vui lòng thử lại.");
      const result: { status?: string } = await response.json();
      if (result.status !== "applied" && result.status !== "duplicate") {
        throw new Error("Phản hồi không hợp lệ. Vui lòng thử lại.");
      }
      attemptRef.current = null;
      setIndex((current) => current + 1);
      setFlipped(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được lượt ôn. Vui lòng thử lại.");
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }, [flipped, item]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.code === "Space" && !target.closest("button, a, [role=button]")) {
        event.preventDefault();
        if (item) setFlipped((previous) => !previous);
      }
      if (flipped && !error && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        void rate(Number(event.key) as ReviewRating);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [error, flipped, item, rate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="font-extrabold">
          {item ? `Thẻ ${index + 1}/${items.length}` : `Đã ôn ${index} thẻ`}
        </p>
        <p className="text-muted-foreground text-sm">Có thể học thêm {remainingNew} thẻ mới hôm nay</p>
      </div>
      {item ? (
        <>
          <ReviewCard item={item} flipped={flipped} onFlip={() => setFlipped((previous) => !previous)} />
          {flipped ? (
            <RatingButtons
              intervals={item.intervals}
              disabled={submitting || !!error}
              onRate={(rating) => void rate(rating)}
            />
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              Nhớ nghĩa trước khi lật thẻ. Sau đó chọn mức độ bằng phím 1 đến 4.
            </p>
          )}
          {error ? (
            <div role="alert" className="space-y-2 rounded-2xl border-2 border-destructive p-4">
              <p>{error}</p>
              <Button variant="outline" onClick={() => void rate(attemptRef.current!.rating)}>
                Thử lại
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4 rounded-3xl border-2 p-8 text-center shadow-[0_4px_0_var(--border)]">
          <h2 className="text-2xl font-black">
            {index ? "Bạn đã xong lượt ôn này!" : "Chưa có thẻ đến hạn"}
          </h2>
          <p className="text-muted-foreground">
            {newRemaining === 0 ? "Bạn đã dùng hết lượt thẻ mới hôm nay. Thẻ đã học vẫn có thể ôn tiếp." : "Quay lại khi thẻ tiếp theo đến hạn nhé."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>Kiểm tra thẻ mới đến hạn</Button>
            {!index ? <Link href="/sets" className="rounded-2xl border-2 px-5 py-3 font-extrabold uppercase">Xem bộ từ</Link> : null}
            <Link href="/stats" className="bg-primary text-primary-foreground rounded-2xl px-5 py-3 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)]">Xem thống kê</Link>
          </div>
        </div>
      )}
    </div>
  );
}

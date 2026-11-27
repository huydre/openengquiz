"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FlipFlashcard } from "@/components/vocab/flip-flashcard";
import type { CardRecord } from "./card-record";
import { playTts } from "@/lib/speech/play-tts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MASTERY_LABELS, type CardMastery } from "@/lib/srs/card-mastery";
import { cn } from "@/lib/utils";

type CardFilter = "all" | CardMastery | "starred";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("vocab-stars", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("vocab-stars", callback); };
}

export function FlashcardViewer({ setId, userId, cards, mastery = {} }: {
  setId: string;
  userId: string;
  cards: CardRecord[];
  /** Learning status per card id; cards missing from the map count as not studied. */
  mastery?: Record<string, CardMastery>;
}) {
  const [allOrder, setOrder] = useState(() => cards.map((card) => card.id));
  const [filter, setFilter] = useState<CardFilter>("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [voice, setVoice] = useState<"en-US" | "en-GB">("en-US");
  const starsKey = `vocab-stars:${userId}:${setId}`;
  const starsRaw = useSyncExternalStore(subscribe, () => localStorage.getItem(starsKey) ?? "[]", () => "[]");
  let stars: string[] = [];
  try {
    const saved: unknown = JSON.parse(starsRaw);
    stars = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch { stars = []; }
  const statusOf = (id: string): CardMastery => mastery[id] ?? "new";
  const order = allOrder.filter((id) => filter === "all" || (filter === "starred" ? stars.includes(id) : statusOf(id) === filter));
  const counts: Record<CardFilter, number> = {
    all: allOrder.length,
    new: allOrder.filter((id) => statusOf(id) === "new").length,
    learning: allOrder.filter((id) => statusOf(id) === "learning").length,
    mastered: allOrder.filter((id) => statusOf(id) === "mastered").length,
    starred: allOrder.filter((id) => stars.includes(id)).length,
  };
  const card = cards.find((item) => item.id === order[Math.min(index, order.length - 1)]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      // Space flips from anywhere on the page; the card itself handles Space when focused.
      if (event.code === "Space" && !target.closest("button, a, [role=button]")) {
        event.preventDefault();
        setFlipped((old) => !old);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        setIndex((current) => Math.max(0, Math.min(order.length - 1, current + delta)));
        setFlipped(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [order.length]);

  function pickFilter(next: CardFilter) {
    setFilter(next);
    setIndex(0);
    setFlipped(false);
  }

  const filterBar = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc thẻ theo trạng thái">
      {(["all", "new", "learning", "mastered", "starred"] as const).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={filter === key}
          onClick={() => pickFilter(key)}
          className={cn(
            "rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors",
            filter === key ? "border-primary bg-primary/10 text-primary-edge" : "hover:bg-muted",
          )}
        >
          {key === "all" ? "Tất cả" : key === "starred" ? "Đánh dấu sao" : MASTERY_LABELS[key]} <span className="tabular-nums opacity-70">{counts[key]}</span>
        </button>
      ))}
    </div>
  );

  if (!card) {
    return (
      <section className="space-y-4" aria-label="Học flashcard">
        <h2 className="text-xl font-extrabold">Học thẻ</h2>
        {filterBar}
        <p className="text-muted-foreground rounded-2xl border-2 border-dashed p-6 text-center font-semibold">Không có thẻ nào ở mục này.</p>
      </section>
    );
  }

  function move(delta: number) {
    setIndex((current) => Math.max(0, Math.min(order.length - 1, current + delta)));
    setFlipped(false);
  }

  function shuffle() {
    // Shuffle the whole set; the active filter is applied on top.
    const all = [...allOrder];
    for (let position = all.length - 1; position > 0; position -= 1) {
      const swap = Math.floor(Math.random() * (position + 1));
      [all[position], all[swap]] = [all[swap], all[position]];
    }
    setOrder(all); setIndex(0); setFlipped(false);
  }

  function toggleStar() {
    try {
      const next = stars.includes(card!.id) ? stars.filter((id) => id !== card!.id) : [...stars, card!.id];
      localStorage.setItem(starsKey, JSON.stringify(next));
      window.dispatchEvent(new Event("vocab-stars"));
    } catch { /* Storage may be unavailable in private browser contexts. */ }
  }

  function speak() {
    void playTts(card!.term, { accent: voice });
  }

  return (
    <section className="space-y-4" aria-label="Học flashcard">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold">Học thẻ</h2><span role="status" aria-live="polite" className="font-bold">{Math.min(index, order.length - 1) + 1}/{order.length} {flipped ? "Mặt sau" : "Mặt trước"}</span></div>
      {filterBar}
      <FlipFlashcard key={card.id} card={card} flipped={flipped} onFlip={() => setFlipped((old) => !old)} accent={voice} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => move(-1)}>← Trước</Button>
        <Button variant="outline" disabled={index === order.length - 1} onClick={() => move(1)}>Tiếp →</Button>
        <Button variant="outline" onClick={shuffle}>Xáo trộn</Button>
        <Button variant="outline" aria-label={stars.includes(card.id) ? "Bỏ đánh dấu sao" : "Đánh dấu sao"} aria-pressed={stars.includes(card.id)} onClick={toggleStar}>{stars.includes(card.id) ? "★ Đã lưu" : "☆ Đánh dấu"}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2"><label htmlFor="card-voice" className="font-bold">Giọng đọc</label>
        <Select value={voice} onValueChange={(value) => setVoice(value as "en-US" | "en-GB")}>
          <SelectTrigger id="card-voice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en-US">Mỹ</SelectItem>
            <SelectItem value="en-GB">Anh</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={speak}>Nghe phát âm</Button></div>
    </section>
  );
}

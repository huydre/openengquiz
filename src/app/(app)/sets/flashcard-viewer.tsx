"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { CardRecord } from "./card-record";
import { playTts } from "@/lib/speech/play-tts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("vocab-stars", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("vocab-stars", callback); };
}

export function FlashcardViewer({ setId, userId, cards }: { setId: string; userId: string; cards: CardRecord[] }) {
  const [order, setOrder] = useState(() => cards.map((card) => card.id));
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
  const card = cards.find((item) => item.id === order[index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
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

  if (!card) return null;

  function move(delta: number) {
    setIndex((current) => Math.max(0, Math.min(order.length - 1, current + delta)));
    setFlipped(false);
  }

  function shuffle() {
    const next = [...order];
    for (let position = next.length - 1; position > 0; position -= 1) {
      const swap = Math.floor(Math.random() * (position + 1));
      [next[position], next[swap]] = [next[swap], next[position]];
    }
    setOrder(next); setIndex(0); setFlipped(false);
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
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold">Học thẻ</h2><span role="status" aria-live="polite" className="font-bold">{index + 1}/{order.length} {flipped ? "Mặt sau" : "Mặt trước"}</span></div>
      <button type="button" onClick={() => setFlipped((old) => !old)} aria-pressed={flipped} className="focus-visible:ring-primary flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 bg-card p-8 text-center shadow-[0_4px_0_var(--border)] outline-none focus-visible:ring-4 motion-safe:transition-transform motion-safe:duration-200">
        <span className="text-muted-foreground text-sm font-bold uppercase">{flipped ? "Nghĩa" : "Từ"}</span>
        <span className="text-3xl font-black">{flipped ? card.definition_vi || card.definition_en || "Chưa có nghĩa" : card.term}</span>
        {flipped && card.example_en ? <span className="text-muted-foreground text-sm">{card.example_en}</span> : null}
        <span className="text-muted-foreground text-xs">Chạm hoặc nhấn Space để lật</span>
      </button>
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

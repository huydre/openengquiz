"use client";

import { useState } from "react";
import type { GeneratedCard } from "@/lib/ai/generated-card-data";
import { Button } from "@/components/ui/button";

type CardWithSelection = GeneratedCard & { _excluded?: boolean };

interface CardPreviewListProps {
  cards: CardWithSelection[];
  onChange: (cards: CardWithSelection[]) => void;
}

export function CardPreviewList({ cards, onChange }: CardPreviewListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [synonymsDraft, setSynonymsDraft] = useState("");

  function toggleCard(index: number) {
    const updated = cards.map((card, i) =>
      i === index ? { ...card, _excluded: !card._excluded } : card,
    );
    onChange(updated);
  }

  function updateCard(index: number, field: keyof GeneratedCard, value: string | string[]) {
    const updated = [...cards];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  const includedCards = cards.filter((c) => !c._excluded);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {includedCards.length} / {cards.length} thẻ được chọn
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(cards.map((c) => ({ ...c, _excluded: false })))}
        >
          Chọn tất cả
        </Button>
      </div>

      <div className="space-y-3">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`rounded-3xl border-2 p-4 transition-colors ${
              card._excluded ? "border-muted bg-muted/50 opacity-60" : "border-border bg-card"
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={!card._excluded}
                  onChange={() => toggleCard(index)}
                  aria-label={`Chọn thẻ ${card.term}`}
                  className="h-5 w-5 rounded-2xl border-2"
                />
                <input
                  type="text"
                  value={card.term}
                  onChange={(e) => updateCard(index, "term", e.target.value)}
                  aria-label="Từ tiếng Anh"
                  className="flex-1 font-bold text-lg outline-none"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={editingIndex === index}
                onClick={() => {
                  setSynonymsDraft(card.synonyms.join(", "));
                  setEditingIndex(editingIndex === index ? null : index);
                }}
              >
                {editingIndex === index ? "Đóng" : "Sửa chi tiết"}
              </Button>
            </div>

            {editingIndex === index ? (
              <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
                <div>
                  <label htmlFor={`card-${index}-def-vi`} className="mb-1 block text-sm font-bold">Nghĩa tiếng Việt</label>
                  <textarea
                    id={`card-${index}-def-vi`}
                    value={card.definition_vi}
                    onChange={(e) => updateCard(index, "definition_vi", e.target.value)}
                    rows={2}
                    className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={`card-${index}-def-en`} className="mb-1 block text-sm font-bold">Nghĩa tiếng Anh</label>
                  <textarea
                    id={`card-${index}-def-en`}
                    value={card.definition_en ?? ""}
                    onChange={(e) => updateCard(index, "definition_en", e.target.value)}
                    rows={2}
                    className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`card-${index}-pos`} className="mb-1 block text-sm font-bold">Loại từ</label>
                    <input
                      id={`card-${index}-pos`}
                      type="text"
                      value={card.part_of_speech ?? ""}
                      onChange={(e) => updateCard(index, "part_of_speech", e.target.value)}
                      className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor={`card-${index}-ipa`} className="mb-1 block text-sm font-bold">IPA</label>
                    <input
                      id={`card-${index}-ipa`}
                      type="text"
                      value={card.ipa ?? ""}
                      onChange={(e) => updateCard(index, "ipa", e.target.value)}
                      className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`card-${index}-ex-en`} className="mb-1 block text-sm font-bold">Ví dụ tiếng Anh</label>
                  <textarea
                    id={`card-${index}-ex-en`}
                    value={card.example_en ?? ""}
                    onChange={(e) => updateCard(index, "example_en", e.target.value)}
                    rows={2}
                    className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={`card-${index}-ex-vi`} className="mb-1 block text-sm font-bold">Ví dụ tiếng Việt</label>
                  <textarea
                    id={`card-${index}-ex-vi`}
                    value={card.example_vi ?? ""}
                    onChange={(e) => updateCard(index, "example_vi", e.target.value)}
                    rows={2}
                    className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={`card-${index}-syn`} className="mb-1 block text-sm font-bold">Đồng nghĩa (ngăn cách bằng dấu phẩy)</label>
                  <input
                    id={`card-${index}-syn`}
                    type="text"
                    value={synonymsDraft}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSynonymsDraft(value);
                      updateCard(index, "synonyms", value.split(",").map((item) => item.trim()).filter(Boolean));
                    }}
                    className="w-full rounded-2xl border-2 bg-background p-2 text-sm outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{card.definition_vi}</p>
                {card.definition_en ? <p className="text-muted-foreground">{card.definition_en}</p> : null}
                {card.part_of_speech || card.ipa ? (
                  <p className="text-muted-foreground text-xs">
                    {card.part_of_speech && <span className="mr-2">{card.part_of_speech}</span>}
                    {card.ipa && <span className="italic">{card.ipa}</span>}
                  </p>
                ) : null}
                {card.example_en ? (
                  <div className="rounded-2xl bg-muted/50 p-2 italic">
                    {card.example_en}
                    {card.example_vi && <p className="mt-1 not-italic text-muted-foreground">{card.example_vi}</p>}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

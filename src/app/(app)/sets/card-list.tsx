"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardEditor } from "./card-editor";
import { deleteCard, moveCard } from "./card-actions";
import type { CardRecord } from "./card-record";

export function CardList({ setId, cards }: { setId: string; cards: CardRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(cardId: string, task: () => Promise<{ error?: string }>) {
    setPending(cardId); setError("");
    try {
      const result = await task();
      if (result.error) setError(result.error);
      else router.refresh();
    } catch { setError("Không thực hiện được. Hãy thử lại."); }
    finally { setPending(null); }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold">Danh sách thẻ ({cards.length})</h2>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {!cards.length ? <p className="text-muted-foreground">Chưa có thẻ nào. Thêm thẻ đầu tiên bên dưới nhé.</p> : null}
      <ol className="space-y-3">
        {cards.map((card, index) => (
          <li key={card.id} className="rounded-3xl border-2 bg-card p-4 shadow-[0_4px_0_var(--border)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><p className="text-lg font-extrabold">{index + 1}. {card.term} <span className="text-muted-foreground text-sm font-normal">{card.ipa}</span></p><p>{card.definition_vi || card.definition_en || "Chưa có nghĩa"}</p></div>
              <div className="flex flex-wrap gap-2">
                {card.example_en && (
                  <Link href={`/pronunciation?cardId=${card.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Luyện đọc câu
                  </Link>
                )}
                <Button type="button" size="sm" variant="outline" disabled={pending === card.id || index === 0} aria-label={`Chuyển ${card.term} lên`} onClick={() => run(card.id, () => moveCard(setId, card.id, -1))}>↑</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending === card.id || index === cards.length - 1} aria-label={`Chuyển ${card.term} xuống`} onClick={() => run(card.id, () => moveCard(setId, card.id, 1))}>↓</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(editing === card.id ? null : card.id)}>{editing === card.id ? "Đóng" : "Sửa"}</Button>
                <Button type="button" size="sm" variant="destructive" disabled={pending === card.id} onClick={() => { if (window.confirm(`Xoá thẻ ${card.term}?`)) run(card.id, () => deleteCard(setId, card.id)); }}>Xoá</Button>
              </div>
            </div>
            {editing === card.id ? <div className="mt-4"><CardEditor setId={setId} card={card} onDone={() => setEditing(null)} /></div> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

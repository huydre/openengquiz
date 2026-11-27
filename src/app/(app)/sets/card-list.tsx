"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImageIcon, Mic, Pencil, Trash2, X } from "lucide-react";
import { CardEditor } from "./card-editor";
import { CardImagePicker } from "./card-image-picker";
import { deleteCard, moveCard } from "./card-actions";
import type { CardRecord } from "./card-record";
import { Ipa } from "@/components/vocab/ipa-text";
import { cn } from "@/lib/utils";

const iconButton = "text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-xl transition-colors disabled:opacity-30";

export function CardList({ setId, cards }: { setId: string; cards: CardRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
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
    <section className="space-y-3" aria-labelledby="card-list-title">
      <h2 id="card-list-title" className="text-xl font-black">Danh sách thẻ <span className="text-muted-foreground font-bold">({cards.length})</span></h2>
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
      {!cards.length ? <p className="text-muted-foreground">Chưa có thẻ nào. Thêm thẻ đầu tiên bên dưới nhé.</p> : null}
      <ol className="bg-card divide-y-2 overflow-hidden rounded-3xl border-2 shadow-[0_4px_0_var(--border)]">
        {cards.map((card, index) => (
          <li key={card.id} className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPicking(card.id)}
                aria-label={card.image_url ? `Đổi ảnh của ${card.term}` : `Thêm ảnh cho ${card.term}`}
                className={cn(
                  "bg-muted grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl",
                  !card.image_url && "text-muted-foreground hover:text-foreground border-2 border-dashed",
                )}
              >
                {card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image_url} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <ImageIcon aria-hidden="true" className="size-5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted-foreground text-sm font-bold tabular-nums">{index + 1}.</span>
                  <span lang="en" className="text-lg font-extrabold">{card.term}</span>
                  <span className="text-muted-foreground text-sm"><Ipa value={card.ipa} /></span>
                  {card.part_of_speech ? <span className="bg-secondary/10 text-secondary-edge rounded-full px-2 py-0.5 text-xs font-bold">{card.part_of_speech}</span> : null}
                </p>
                <p className="text-muted-foreground truncate font-semibold">{card.definition_vi || card.definition_en || "Chưa có nghĩa"}</p>
              </div>
              <div className="flex shrink-0 items-center">
                {card.example_en ? (
                  <Link href={`/pronunciation?cardId=${card.id}`} aria-label={`Luyện đọc câu ví dụ của ${card.term}`} className={iconButton}>
                    <Mic aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
                <button type="button" className={cn(iconButton, "hidden sm:grid")} disabled={pending === card.id || index === 0} aria-label={`Chuyển ${card.term} lên`} onClick={() => run(card.id, () => moveCard(setId, card.id, -1))}>
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button type="button" className={cn(iconButton, "hidden sm:grid")} disabled={pending === card.id || index === cards.length - 1} aria-label={`Chuyển ${card.term} xuống`} onClick={() => run(card.id, () => moveCard(setId, card.id, 1))}>
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
                <button type="button" className={iconButton} aria-expanded={editing === card.id} aria-label={editing === card.id ? "Đóng sửa thẻ" : `Sửa ${card.term}`} onClick={() => setEditing(editing === card.id ? null : card.id)}>
                  {editing === card.id ? <X aria-hidden="true" className="size-4" /> : <Pencil aria-hidden="true" className="size-4" />}
                </button>
                <button type="button" className={cn(iconButton, "hover:text-destructive")} disabled={pending === card.id} aria-label={`Xoá ${card.term}`} onClick={() => { if (window.confirm(`Xoá thẻ ${card.term}?`)) void run(card.id, () => deleteCard(setId, card.id)); }}>
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
            {editing === card.id ? <div className="mt-4"><CardEditor setId={setId} card={card} onDone={() => setEditing(null)} /></div> : null}
            {picking === card.id ? (
              <CardImagePicker setId={setId} card={card} open onOpenChange={(open) => { if (!open) setPicking(null); }} />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

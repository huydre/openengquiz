"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { parseBulkCards } from "@/lib/vocab/parse-bulk-cards";
import { bulkImportCards } from "./card-actions";

export function BulkImport({ setId }: { setId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const parsed = parseBulkCards(text);

  async function submit() {
    setPending(true); setError("");
    try {
      const result = await bulkImportCards(setId, text);
      if (result.error) setError(result.error);
      else { setText(""); router.refresh(); }
    } catch { setError("Không nhập được thẻ. Hãy thử lại."); }
    finally { setPending(false); }
  }

  return (
    <section className="space-y-3 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]">
      <h2 className="text-xl font-extrabold">Nhập nhiều thẻ</h2>
      <p className="text-muted-foreground text-sm">Mỗi dòng: <b>từ - nghĩa</b>, tab hoặc CSV hai cột.</p>
      <label htmlFor="bulk-cards" className="sr-only">Danh sách từ cần nhập</label>
      <textarea id="bulk-cards" value={text} onChange={(event) => setText(event.target.value)} rows={6} placeholder={"apple - táo\nbook,sách"} className="focus-visible:ring-primary w-full rounded-2xl border-2 bg-background p-3 outline-none focus-visible:ring-2" />
      {parsed.cards.length ? <p role="status" className="text-sm font-bold">Sẵn sàng nhập {parsed.cards.length} thẻ. Xem trước: {parsed.cards.slice(0, 3).map((card) => `${card.term}: ${card.definition_vi}`).join("; ")}</p> : null}
      {parsed.errors.length ? <p role="alert" className="text-destructive text-sm">Dòng cần sửa: {parsed.errors.map((item) => item.line).join(", ")}</p> : null}
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <Button type="button" disabled={pending || !parsed.cards.length || !!parsed.errors.length} onClick={submit}>{pending ? "Đang nhập..." : "Nhập thẻ"}</Button>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addCard, updateCard } from "./card-actions";
import type { CardRecord } from "./card-record";
import type { CardInput } from "@/lib/vocab/card-schema";

const empty: CardInput = { term: "", definition_vi: "", definition_en: "", part_of_speech: "", ipa: "", example_en: "", example_vi: "", synonyms: [] };

export function CardEditor({ setId, card, onDone }: { setId: string; card?: CardRecord; onDone?: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState<CardInput>(card ? {
    term: card.term, definition_vi: card.definition_vi, definition_en: card.definition_en,
    part_of_speech: card.part_of_speech, ipa: card.ipa, example_en: card.example_en,
    example_vi: card.example_vi, synonyms: card.synonyms,
  } : empty);
  const termRef = useRef(card?.term ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function field(key: keyof Omit<CardInput, "synonyms">, label: string, placeholder = "") {
    return <div><label htmlFor={`${card?.id ?? "new"}-${key}`} className="mb-1 block text-sm font-bold">{label}</label><input id={`${card?.id ?? "new"}-${key}`} value={input[key] ?? ""} onChange={(event) => { if (key === "term") termRef.current = event.target.value; setInput((old) => ({ ...old, [key]: event.target.value })); }} placeholder={placeholder} className="focus-visible:ring-primary w-full rounded-2xl border-2 bg-background p-3 outline-none focus-visible:ring-2" /></div>;
  }

  async function lookup() {
    if (!input.term.trim()) { setError("Nhập từ trước khi tra."); return; }
    const requestedTerm = input.term.trim();
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/lookup?term=${encodeURIComponent(input.term)}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Không tra được từ."); return; }
      if (termRef.current.trim() !== requestedTerm) {
        setNotice("Từ đã thay đổi. Tra lại để lấy đúng gợi ý.");
        return;
      }
      const suggestion = data.data ?? data;
      setInput((old) => ({
        ...old,
        ipa: suggestion.ipa ?? old.ipa,
        part_of_speech: suggestion.part_of_speech ?? old.part_of_speech,
        definition_en: suggestion.definition_en ?? old.definition_en,
        definition_vi: suggestion.definition_vi ?? old.definition_vi,
        example_en: suggestion.example_en ?? old.example_en,
        example_vi: suggestion.example_vi ?? old.example_vi,
        synonyms: suggestion.synonyms?.length ? suggestion.synonyms : old.synonyms,
      }));
      setNotice("Đã điền gợi ý. Bạn có thể sửa trước khi lưu.");
    } catch { setError("Không tra được từ. Kiểm tra kết nối nhé."); }
    finally { setPending(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    try {
      const result = card ? await updateCard(setId, card.id, input) : await addCard(setId, input);
      if (result.error) setError(result.error);
      else {
        setNotice("Đã lưu thẻ.");
        if (!card) { termRef.current = ""; setInput(empty); }
        onDone?.();
        router.refresh();
      }
    } catch { setError("Không lưu được thẻ. Hãy thử lại."); }
    finally { setPending(false); }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">{field("term", "Từ tiếng Anh")}<Button type="button" variant="secondary" disabled={pending} onClick={lookup}>Tra từ tự điền</Button></div>
      <div className="grid gap-4 sm:grid-cols-2">{field("definition_vi", "Nghĩa tiếng Việt")}{field("definition_en", "Nghĩa tiếng Anh")}{field("ipa", "Phiên âm IPA")}{field("part_of_speech", "Loại từ")}{field("example_en", "Ví dụ tiếng Anh")}{field("example_vi", "Ví dụ tiếng Việt")}</div>
      <div><label htmlFor={`${card?.id ?? "new"}-synonyms`} className="mb-1 block text-sm font-bold">Từ đồng nghĩa (cách nhau bằng dấu phẩy)</label><input id={`${card?.id ?? "new"}-synonyms`} value={input.synonyms?.join(", ") ?? ""} onChange={(event) => setInput((old) => ({ ...old, synonyms: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} className="focus-visible:ring-primary w-full rounded-2xl border-2 bg-background p-3 outline-none focus-visible:ring-2" /></div>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      {notice ? <p role="status" className="text-sm">{notice}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Đang xử lý..." : card ? "Lưu thẻ" : "Thêm thẻ"}</Button>
    </form>
  );
}

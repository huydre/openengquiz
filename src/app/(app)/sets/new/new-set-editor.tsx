"use client";

// Create a set with its cards in one form: each card has an AI lookup inside the term field,
// optional fields, reordering, and the whole draft is kept in localStorage until it is saved.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Lightbulb, LoaderCircle, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSet, type SetInput } from "../set-actions";
import { importVocabCards } from "../card-actions";
import { cn } from "@/lib/utils";
import { VocabImportDialog } from "@/components/sets/vocab-import-dialog";
import type { CardInput } from "@/lib/vocab/card-schema";

type DraftCard = {
  key: string;
  term: string;
  definition_vi: string;
  ipa: string;
  part_of_speech: string;
  example_en: string;
  synonyms: string;
};
type Draft = { title: string; description: string; visibility: SetInput["visibility"]; cards: DraftCard[]; suggest: boolean };
type LookupState = { status: "loading" } | { status: "error"; message: string };

const DRAFT_KEY = "openengquiz:new-set-draft";
const MAX_CARDS = 500;

// Initial cards use fixed keys so server and client render the same ids; later cards are client-only.
const newCard = (key: string = crypto.randomUUID()): DraftCard => ({ key, term: "", definition_vi: "", ipa: "", part_of_speech: "", example_en: "", synonyms: "" });
const emptyDraft = (): Draft => ({ title: "", description: "", visibility: "private", cards: [newCard("first"), newCard("second"), newCard("third")], suggest: true });
const isBlank = (card: DraftCard) => !card.term.trim() && !card.definition_vi.trim();

export function NewSetEditor() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  // A set created by an earlier attempt whose cards failed to save; retry fills it instead of making another.
  const createdSetId = useRef<string | null>(null);

  // Restore the saved draft once on mount, then keep it in sync.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft({ ...emptyDraft(), ...(JSON.parse(saved) as Draft) });
    } catch {
      // A corrupt draft is ignored.
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, loaded]);

  const update = (patch: Partial<Draft>) => setDraft((old) => ({ ...old, ...patch }));
  const updateCard = (key: string, patch: Partial<DraftCard>) =>
    setDraft((old) => ({ ...old, cards: old.cards.map((card) => (card.key === key ? { ...card, ...patch } : card)) }));

  /** Imported words replace the empty placeholder cards and go after the ones already written. */
  function addImported(cards: CardInput[]) {
    setDraft((old) => {
      const kept = old.cards.filter((card) => !isBlank(card));
      const imported = cards.map((card) => ({
        ...newCard(),
        term: card.term,
        definition_vi: card.definition_vi ?? card.definition_en ?? "",
        ipa: card.ipa ?? "",
        part_of_speech: card.part_of_speech ?? "",
        example_en: card.example_en ?? "",
        synonyms: (card.synonyms ?? []).join("; "),
      }));
      return { ...old, cards: [...kept, ...imported].slice(0, MAX_CARDS) };
    });
  }

  function insertAfter(index: number) {
    setDraft((old) => {
      const cards = [...old.cards];
      cards.splice(index + 1, 0, newCard());
      return { ...old, cards };
    });
  }
  function remove(key: string) {
    setDraft((old) => ({ ...old, cards: old.cards.length > 1 ? old.cards.filter((card) => card.key !== key) : [newCard()] }));
  }
  function move(index: number, delta: -1 | 1) {
    setDraft((old) => {
      const target = index + delta;
      if (target < 0 || target >= old.cards.length) return old;
      const cards = [...old.cards];
      [cards[index], cards[target]] = [cards[target], cards[index]];
      return { ...old, cards };
    });
  }

  async function lookup(card: DraftCard, onlyEmpty = false) {
    const term = card.term.trim();
    if (!term || lookups[card.key]?.status === "loading") return;
    setLookups((old) => ({ ...old, [card.key]: { status: "loading" } }));
    try {
      const response = await fetch(`/api/lookup?term=${encodeURIComponent(term)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không tra được từ.");
      const hit = (body.data ?? body) as Partial<Record<"ipa" | "part_of_speech" | "definition_vi" | "example_en", string | null>> & { synonyms?: string[] };
      setDraft((old) => ({
        ...old,
        cards: old.cards.map((current) => {
          // The learner may have changed the term while the lookup ran.
          if (current.key !== card.key || current.term.trim() !== term) return current;
          const fill = (value: string, next?: string | null) => (onlyEmpty && value.trim() ? value : next ?? value);
          return {
            ...current,
            definition_vi: fill(current.definition_vi, hit.definition_vi),
            ipa: fill(current.ipa, hit.ipa),
            part_of_speech: fill(current.part_of_speech, hit.part_of_speech),
            example_en: fill(current.example_en, hit.example_en),
            synonyms: fill(current.synonyms, hit.synonyms?.length ? hit.synonyms.join("; ") : null),
          };
        }),
      }));
      setLookups((old) => {
        const next = { ...old };
        delete next[card.key];
        return next;
      });
    } catch (err) {
      setLookups((old) => ({ ...old, [card.key]: { status: "error", message: err instanceof Error ? err.message : "Không tra được từ." } }));
    }
  }

  function clearDraft() {
    if (!window.confirm("Xoá toàn bộ bản nháp này?")) return;
    localStorage.removeItem(DRAFT_KEY);
    createdSetId.current = null;
    setDraft(emptyDraft());
    setLookups({});
    setInvalid(new Set());
    setError("");
  }

  async function submit() {
    const cards = draft.cards.filter((card) => !isBlank(card));
    const missing = new Set(cards.filter((card) => !card.term.trim() || !card.definition_vi.trim()).map((card) => card.key));
    setInvalid(missing);
    if (!draft.title.trim()) return setError("Nhập tiêu đề cho bộ thẻ.");
    if (!cards.length) return setError("Thêm ít nhất một thẻ.");
    if (missing.size) return setError(`Còn ${missing.size} thẻ thiếu thuật ngữ hoặc định nghĩa.`);
    if (cards.length > MAX_CARDS) return setError(`Mỗi bộ tạo một lần tối đa ${MAX_CARDS} thẻ.`);

    setSaving(true);
    setError("");
    try {
      let setId = createdSetId.current;
      if (!setId) {
        const created = await createSet({ title: draft.title, description: draft.description, visibility: draft.visibility });
        if (created.error || !created.id) return setError(created.error ?? "Không tạo được bộ thẻ.");
        setId = created.id;
        createdSetId.current = setId;
      }
      const result = await importVocabCards({
        setId,
        cards: cards.map((card) => ({
          term: card.term,
          definition_vi: card.definition_vi,
          ipa: card.ipa || null,
          part_of_speech: card.part_of_speech || null,
          example_en: card.example_en || null,
          synonyms: card.synonyms.split(/[;,]/).map((item) => item.trim()).filter(Boolean),
        })),
      });
      if ("error" in result) return setError(`Đã tạo bộ nhưng chưa lưu được thẻ: ${result.error} Bấm Tạo để thử lại.`);
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/sets/${setId}`);
    } catch {
      setError("Không lưu được. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const filled = draft.cards.filter((card) => !isBlank(card)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Tạo bộ thẻ mới</h1>
        <div className="flex flex-wrap items-center gap-2">
          <VocabImportDialog onCards={addImported} />
          <Select value={draft.visibility} onValueChange={(value) => update({ visibility: value as SetInput["visibility"] })}>
            <SelectTrigger aria-label="Chế độ chia sẻ" className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Riêng tư</SelectItem>
              <SelectItem value="unlisted">Ai có link</SelectItem>
              <SelectItem value="public">Công khai</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/sets" className={buttonVariants({ variant: "ghost" })}>Huỷ</Link>
          <Button type="button" disabled={saving} onClick={submit}>
            {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Tạo
          </Button>
        </div>
      </div>

      <Link
        href="/sets/new/ai"
        className="bg-primary/10 hover:bg-primary/15 border-primary/30 flex items-center gap-3 rounded-2xl border-2 px-4 py-3 font-bold transition-colors"
      >
        <Sparkles className="text-primary-edge size-5" aria-hidden="true" />
        <span>Nhờ AI tạo cả bộ từ theo chủ đề</span>
        <span className="text-muted-foreground ml-auto hidden text-sm font-semibold sm:inline">Mở trình tạo AI</span>
      </Link>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="font-extrabold">Tiêu đề</span>
          <input
            value={draft.title}
            maxLength={200}
            onChange={(event) => update({ title: event.target.value })}
            placeholder="Ví dụ: Từ vựng IELTS chủ đề môi trường"
            className="bg-card focus-visible:ring-primary/30 h-12 w-full rounded-2xl border-2 px-4 text-lg font-bold outline-none focus-visible:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="font-extrabold">Mô tả <span className="text-muted-foreground font-semibold">(tuỳ chọn)</span></span>
          <textarea
            value={draft.description}
            maxLength={2000}
            rows={2}
            onChange={(event) => update({ description: event.target.value })}
            placeholder="Bộ thẻ này giúp bạn học gì?"
            className="bg-card focus-visible:ring-primary/30 w-full rounded-2xl border-2 p-4 outline-none focus-visible:ring-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <button
          type="button"
          aria-pressed={draft.suggest}
          onClick={() => update({ suggest: !draft.suggest })}
          title="Tự tra từ bằng AI khi bạn rời ô thuật ngữ mà chưa có định nghĩa"
          className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold transition-colors", draft.suggest ? "bg-accent/25 text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          <Lightbulb className="size-4" aria-hidden="true" /> Gợi ý AI: {draft.suggest ? "Bật" : "Tắt"}
        </button>
        <button type="button" onClick={clearDraft} className="text-muted-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold">
          <Trash2 className="size-4" aria-hidden="true" /> Xoá bản nháp
        </button>
      </div>

      <ol className="space-y-0">
        {draft.cards.map((card, index) => (
          <li key={card.key}>
            <CardRow
              card={card}
              index={index}
              total={draft.cards.length}
              lookup={lookups[card.key]}
              invalid={invalid.has(card.key)}
              onChange={(patch) => updateCard(card.key, patch)}
              onLookup={() => void lookup(card)}
              onTermBlur={() => {
                if (draft.suggest && card.term.trim() && !card.definition_vi.trim()) void lookup(card, true);
              }}
              onRemove={() => remove(card.key)}
              onMove={(delta) => move(index, delta)}
            />
            {index < draft.cards.length - 1 ? (
              <div className="flex justify-center py-1.5">
                <button
                  type="button"
                  onClick={() => insertAfter(index)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold opacity-60 transition hover:opacity-100 focus-visible:opacity-100"
                >
                  <Plus className="size-3.5" aria-hidden="true" /> Thêm thẻ
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => insertAfter(draft.cards.length - 1)}
        className="bg-card hover:bg-muted/60 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed py-5 text-lg font-black transition-colors"
      >
        <Plus className="size-5" aria-hidden="true" /> Thêm thẻ
      </button>

      <div className="bg-background/90 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3 backdrop-blur-md">
        <p className="text-muted-foreground text-sm font-bold">{filled} thẻ</p>
        {error ? <p role="alert" className="text-destructive min-w-0 flex-1 text-sm font-bold">{error}</p> : <span className="flex-1" />}
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Tạo bộ thẻ
        </Button>
      </div>
    </div>
  );
}

function CardRow({ card, index, total, lookup, invalid, onChange, onLookup, onTermBlur, onRemove, onMove }: {
  card: DraftCard;
  index: number;
  total: number;
  lookup?: LookupState;
  invalid: boolean;
  onChange: (patch: Partial<DraftCard>) => void;
  onLookup: () => void;
  onTermBlur: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const id = `card-${card.key}`;
  const loading = lookup?.status === "loading";
  const box = "bg-muted/50 focus-visible:ring-primary/30 w-full rounded-2xl border-2 border-transparent px-4 outline-none focus-visible:border-primary/40 focus-visible:ring-2";
  return (
    <section
      aria-label={`Thẻ ${index + 1}`}
      className={cn("bg-card rounded-3xl border-2 p-4 shadow-[0_4px_0_var(--border)] sm:p-5", invalid && "border-destructive/50")}
    >
      <div className="flex gap-3">
        <span className="text-muted-foreground w-6 shrink-0 pt-7 text-lg font-black tabular-nums">{index + 1}</span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor={`${id}-term`} className="text-muted-foreground mb-1 block text-xs font-extrabold uppercase">Thuật ngữ</label>
              <div className="relative">
                <textarea
                  id={`${id}-term`}
                  lang="en"
                  rows={2}
                  value={card.term}
                  onChange={(event) => onChange({ term: event.target.value })}
                  onBlur={onTermBlur}
                  placeholder="Nhập từ tiếng Anh"
                  className={cn(box, "resize-none py-3 pr-14 font-bold")}
                />
                <button
                  type="button"
                  onClick={onLookup}
                  disabled={!card.term.trim() || loading}
                  title="Tra từ bằng AI"
                  aria-label={`Tra từ bằng AI cho thẻ ${index + 1}`}
                  className="bg-primary text-primary-foreground absolute right-2.5 bottom-3 grid size-9 place-items-center rounded-xl shadow-[0_3px_0_var(--primary-edge)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40"
                >
                  {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <WandSparkles className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-def`} className="text-muted-foreground mb-1 block text-xs font-extrabold uppercase">Định nghĩa</label>
              <textarea
                id={`${id}-def`}
                rows={2}
                value={card.definition_vi}
                onChange={(event) => onChange({ definition_vi: event.target.value })}
                placeholder={loading ? "AI đang tra từ..." : "Nghĩa tiếng Việt"}
                className={cn(box, "resize-none py-3")}
              />
            </div>
          </div>
          {lookup?.status === "error" ? <p role="alert" className="text-destructive text-xs font-bold">{lookup.message}</p> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <OptionalField id={`${id}-ipa`} label="Phát âm" placeholder="VD: /ˈbɒrəʊ/" value={card.ipa} onChange={(ipa) => onChange({ ipa })} className={box} />
            <OptionalField id={`${id}-pos`} label="Loại từ" placeholder="VD: noun, verb..." value={card.part_of_speech} onChange={(part_of_speech) => onChange({ part_of_speech })} className={box} />
            <OptionalField id={`${id}-ex`} label="Ví dụ" placeholder="Câu ví dụ tiếng Anh" value={card.example_en} onChange={(example_en) => onChange({ example_en })} className={box} lang="en" />
            <OptionalField id={`${id}-syn`} label="Từ đồng nghĩa" placeholder="Cách nhau bằng dấu chấm phẩy (;)" value={card.synonyms} onChange={(synonyms) => onChange({ synonyms })} className={box} lang="en" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1 pt-5">
          <button type="button" onClick={onRemove} aria-label={`Xoá thẻ ${index + 1}`} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive grid size-9 place-items-center rounded-xl">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Đưa thẻ ${index + 1} lên`} className="text-muted-foreground hover:bg-muted grid size-9 place-items-center rounded-xl disabled:opacity-30">
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Đưa thẻ ${index + 1} xuống`} className="text-muted-foreground hover:bg-muted grid size-9 place-items-center rounded-xl disabled:opacity-30">
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

function OptionalField({ id, label, placeholder, value, onChange, className, lang }: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  lang?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-extrabold">
        {label} <span className="text-muted-foreground font-semibold">(tuỳ chọn)</span>
      </label>
      <input id={id} lang={lang} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn(className, "h-11")} />
    </div>
  );
}

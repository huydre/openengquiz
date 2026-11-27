"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CardPreviewList } from "@/components/ai/card-preview-list";
import { ImageOcr } from "@/components/ai/image-ocr";
import { cardTermKey, type GeneratedCard } from "@/lib/ai/generated-card-data";
import { cardSchema } from "@/lib/vocab/card-schema";
import { bulkAddCards } from "../../card-actions";
import { createSet } from "../../set-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AiCardGeneratorProps {
  userLevel: string;
  existingSets: { id: string; title: string }[];
  aiEnabled: boolean;
}

type SourceType = "words" | "text" | "topic" | "image";
type CardWithSelection = GeneratedCard & { _excluded?: boolean };

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const MAX_WORDS = 50;
const MAX_TEXT_LENGTH = 15000;
const MAX_TOPIC_LENGTH = 200;

export function AiCardGenerator({ userLevel, existingSets, aiEnabled }: AiCardGeneratorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetFromParams = searchParams.get("target");
  const isValidTarget = targetFromParams && existingSets.some((s) => s.id === targetFromParams);

  const [sourceType, setSourceType] = useState<SourceType>("words");
  const [words, setWords] = useState("");
  const [text, setText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState((CEFR_LEVELS as readonly string[]).includes(userLevel) ? userLevel : "B1");
  const [cards, setCards] = useState<CardWithSelection[]>([]);
  const [pending, setPending] = useState<"generate" | "save" | null>(null);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState("");
  const [targetSetId, setTargetSetId] = useState<string | null>(isValidTarget ? targetFromParams : null);
  const [newSetTitle, setNewSetTitle] = useState("");
  const [createdSetId, setCreatedSetId] = useState<string | null>(null);

  async function generate() {
    setError("");
    setPending("generate");

    try {
      let source:
        | { type: "words"; words: string[] }
        | { type: "text"; text: string; level: string }
        | { type: "topic"; topic: string; level: string };

      if (sourceType === "words") {
        const wordList = words
          .split(/[\n,;]+/)
          .map((w) => w.trim())
          .filter(Boolean);
        if (wordList.length === 0) {
          setError("Vui lòng nhập ít nhất một từ.");
          return;
        }
        if (wordList.length > MAX_WORDS) {
          setError(`Tối đa ${MAX_WORDS} từ mỗi lần.`);
          return;
        }
        source = { type: "words", words: wordList };
      } else if (sourceType === "text" || sourceType === "image") {
        const trimmed = (sourceType === "image" ? ocrText : text).trim();
        if (!trimmed) {
          setError(sourceType === "image"
            ? "Vui lòng tải ảnh hoặc nhập văn bản."
            : "Vui lòng nhập đoạn văn bản.");
          return;
        }
        if (trimmed.length > MAX_TEXT_LENGTH) {
          setError(`Đoạn văn bản tối đa ${MAX_TEXT_LENGTH} ký tự.`);
          return;
        }
        source = { type: "text", text: trimmed, level };
      } else if (sourceType === "topic") {
        const trimmed = topic.trim();
        if (!trimmed) {
          setError("Vui lòng nhập chủ đề.");
          return;
        }
        if (trimmed.length > MAX_TOPIC_LENGTH) {
          setError(`Chủ đề tối đa ${MAX_TOPIC_LENGTH} ký tự.`);
          return;
        }
        source = { type: "topic", topic: trimmed, level };
      } else {
        return;
      }

      const response = await fetch("/api/ai/generate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, targetSetId: targetSetId ?? createdSetId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Không tạo được thẻ. Hãy thử lại.");
        return;
      }

      setCards(data.cards ?? []);
      setGeneration((value) => value + 1);
      if (!data.cards?.length) {
        setError("Không tìm thấy từ nào phù hợp. Thử nguồn khác nhé.");
      }
    } catch (err) {
      setError("Lỗi kết nối. Hãy thử lại.");
      console.error(err);
    } finally {
      setPending(null);
    }
  }

  async function saveCards() {
    const cardsToSave = cards
      .filter((c) => !c._excluded)
      .map((c) => {
        const { _excluded, ...card } = c;
        void _excluded;
        return card;
      });

    if (cardsToSave.length === 0) {
      setError("Chưa chọn thẻ nào để lưu.");
      return;
    }

    const seen = new Set<string>();
    for (const card of cardsToSave) {
      const key = cardTermKey(card.term);
      if (!key) {
        setError("Mỗi thẻ cần có từ tiếng Anh.");
        return;
      }
      if (seen.has(key)) {
        setError(`Trùng từ "${card.term}". Hãy bỏ chọn một thẻ.`);
        return;
      }
      seen.add(key);
      const parsed = cardSchema.safeParse(card);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Dữ liệu thẻ không hợp lệ.");
        return;
      }
    }

    setPending("save");
    setError("");

    try {
      let setId = targetSetId ?? createdSetId;

      if (!setId) {
        if (!newSetTitle.trim()) {
          setError("Vui lòng nhập tên bộ từ mới.");
          return;
        }
        const result = await createSet({
          title: newSetTitle.trim(),
          description: "",
          visibility: "private",
        });
        if (result.error || !result.id) {
          setError(result.error ?? "Không tạo được bộ từ.");
          return;
        }
        setId = result.id;
        setCreatedSetId(result.id);
      }

      const result = await bulkAddCards(setId, cardsToSave);
      if (result.error) {
        setError(result.error);
        return;
      }

      router.push(`/sets/${setId}`);
    } catch (err) {
      setError("Lỗi khi lưu thẻ. Hãy thử lại.");
      console.error(err);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      {!aiEnabled && (
        <p role="alert" className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 font-bold text-destructive">
          Tính năng AI chưa được bật. Vui lòng liên hệ quản trị viên.
        </p>
      )}

      <fieldset disabled={pending !== null} className="min-w-0 space-y-4 rounded-3xl border-2 bg-card p-5">
        <legend className="sr-only">Tạo thẻ</legend>
        <div>
          <h2 className="mb-2 text-xl font-extrabold">Chọn nguồn dữ liệu</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Nguồn dữ liệu">
            {[
              { value: "words" as SourceType, label: "Danh sách từ" },
              { value: "text" as SourceType, label: "Đoạn văn bản" },
              { value: "topic" as SourceType, label: "Chủ đề" },
              { value: "image" as SourceType, label: "Ảnh (OCR)" },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={sourceType === type.value}
                onClick={() => setSourceType(type.value)}
                className={`rounded-2xl border-2 px-4 py-2 font-bold transition-colors ${
                  sourceType === type.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {sourceType === "words" && (
          <div>
            <label htmlFor="ai-words" className="mb-2 block font-bold">
              Danh sách từ (ngăn cách bằng dấu phẩy hoặc xuống dòng, tối đa {MAX_WORDS})
            </label>
            <textarea
              id="ai-words"
              value={words}
              onChange={(e) => setWords(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border-2 bg-background p-3 outline-none"
              placeholder="apple, banana, orange..."
            />
          </div>
        )}

        {sourceType === "text" && (
          <div>
            <label htmlFor="ai-text" className="mb-2 block font-bold">Đoạn văn bản tiếng Anh</label>
            <textarea
              id="ai-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={MAX_TEXT_LENGTH}
              className="w-full rounded-2xl border-2 bg-background p-3 outline-none"
              placeholder="Dán đoạn văn bản tiếng Anh ở đây..."
            />
          </div>
        )}

        {sourceType === "topic" && (
          <div>
            <label htmlFor="ai-topic" className="mb-2 block font-bold">Chủ đề</label>
            <input
              id="ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={MAX_TOPIC_LENGTH}
              className="w-full rounded-2xl border-2 bg-background p-3"
              placeholder="Ví dụ: phỏng vấn xin việc, du lịch, y tế..."
            />
          </div>
        )}

        {sourceType === "image" && (
          <ImageOcr text={ocrText} onTextExtracted={setOcrText} maxLength={MAX_TEXT_LENGTH} />
        )}

        {sourceType !== "words" && (
          <div>
            <label htmlFor="ai-level" className="mb-2 block font-bold">Trình độ</label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger id="ai-level" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CEFR_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label htmlFor="ai-target-set" className="mb-2 block font-bold">Bộ từ đích</label>
          <Select
            value={targetSetId ?? "new"}
            onValueChange={(value) => setTargetSetId(value === "new" ? null : value)}
          >
            <SelectTrigger id="ai-target-set" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">{createdSetId ? `Bộ đã tạo: ${newSetTitle}` : "Tạo bộ từ mới"}</SelectItem>
              {existingSets.map((set) => (
                <SelectItem key={set.id} value={set.id}>{set.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" onClick={generate} disabled={!aiEnabled || pending !== null} className="w-full">
          {pending === "generate" ? "Đang tạo thẻ..." : "Tạo thẻ"}
        </Button>
      </fieldset>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {cards.length > 0 && (
        <fieldset disabled={pending !== null} className="min-w-0 space-y-6">
          <legend className="sr-only">Chỉnh sửa và lưu thẻ</legend>
          <section className="space-y-4 rounded-3xl border-2 bg-card p-5">
            <h2 className="text-xl font-extrabold">Xem trước và chỉnh sửa thẻ</h2>
            <CardPreviewList key={generation} cards={cards} onChange={setCards} />
          </section>

          <section className="space-y-4 rounded-3xl border-2 bg-card p-5">
            <h2 className="text-xl font-extrabold">Lưu thẻ vào bộ từ</h2>
            <div className="space-y-3">
              {!targetSetId && !createdSetId && (
                <div>
                  <label htmlFor="ai-new-set-title" className="mb-2 block font-bold">Tên bộ từ mới</label>
                  <input
                    id="ai-new-set-title"
                    type="text"
                    value={newSetTitle}
                    onChange={(e) => setNewSetTitle(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-2xl border-2 bg-background p-3 outline-none"
                    placeholder="Ví dụ: Từ vựng giao tiếp"
                  />
                </div>
              )}

              <Button type="button" onClick={saveCards} disabled={pending !== null} className="w-full">
                {pending === "save" ? "Đang lưu..." : "Lưu thẻ"}
              </Button>
            </div>
          </section>
        </fieldset>
      )}
    </div>
  );
}

"use client";

// Import vocabulary from an Excel/CSV file or pasted text, preview it, then create a set or add to one.
// Files are read in the browser; only the parsed cards are sent to the server.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ClipboardPaste, Download, FileSpreadsheet, HelpCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importVocabCards } from "@/app/(app)/sets/card-actions";
import type { VocabSheetResult } from "@/lib/vocab/parse-vocab-sheet";
import type { CardInput } from "@/lib/vocab/card-schema";
import { parseVocabText } from "@/lib/vocab/parse-vocab-text";
import { cn } from "@/lib/utils";

type Source = "file" | "paste";
type TermSeparator = "tab" | "comma" | "custom";
type CardSeparator = "newline" | "semicolon";
type Parsed = VocabSheetResult & { fileName?: string };

const MAX_CARDS = 500;
const COLUMN_LABELS: Record<string, string> = {
  term: "Từ",
  part_of_speech: "Loại từ",
  ipa: "IPA",
  definition_vi: "Nghĩa Việt",
  definition_en: "Nghĩa Anh",
  example_en: "Ví dụ",
  example_vi: "Dịch ví dụ",
  synonyms: "Đồng nghĩa",
};

/**
 * `setId` adds the words to that set; without it a new set is created. `onCards` hands the parsed
 * words back instead of saving (the new-set editor fills its card list with them). `bare` drops the
 * card frame and heading when shown inside a dialog.
 */
export function VocabImport({ setId, onCards, bare = false }: {
  setId?: string;
  onCards?: (cards: CardInput[]) => void;
  bare?: boolean;
}) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("file");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  function showResult(result: Parsed, suggestedTitle: string) {
    setParsed(result);
    setTitle((current) => current || suggestedTitle);
    setNotice("");
    setError(result.cards.length ? "" : "Không đọc được từ nào. Kiểm tra lại cột từ và cột nghĩa.");
  }

  async function onFile(file: File) {
    setReading(true);
    setError("");
    try {
      const { readVocabFile } = await import("@/lib/vocab/read-vocab-file");
      const result = await readVocabFile(file);
      showResult({ ...result, fileName: file.name }, result.title ?? file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : "Không đọc được file.");
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!parsed?.cards.length) return;
    if (onCards) {
      onCards(parsed.cards.slice(0, MAX_CARDS));
      setParsed(null);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await importVocabCards({ setId, title: setId ? undefined : title, cards: parsed.cards.slice(0, MAX_CARDS) });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (!setId) {
        router.push(`/sets/${result.setId}`);
        return;
      }
      setNotice(
        `Đã thêm ${result.added} từ.` +
          (result.duplicates.length ? ` Bỏ qua ${result.duplicates.length} từ đã có: ${result.duplicates.slice(0, 5).join(", ")}${result.duplicates.length > 5 ? "..." : ""}.` : ""),
      );
      setParsed(null);
      router.refresh();
    } catch {
      setError("Không lưu được. Hãy thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("space-y-4", !bare && "bg-card rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]")} aria-label="Nhập từ vựng">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {bare ? null : <h2 className="text-xl font-black">{setId ? "Nhập nhiều từ" : "Nhập bộ từ"}</h2>}
          <p className="text-muted-foreground text-sm">Từ file Excel, CSV hoặc dán từ bảng tính, Quizlet.</p>
        </div>
        <a href="/templates/mau-bo-tu.xlsx" download className="text-primary-edge hover:bg-primary/10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold">
          <Download className="size-4" aria-hidden="true" /> Tải file mẫu
        </a>
      </div>

      <div role="tablist" aria-label="Nguồn nhập" className="bg-muted grid grid-cols-2 rounded-2xl p-1 sm:w-80">
        {(["file", "paste"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={source === value}
            onClick={() => { setSource(value); setParsed(null); setError(""); }}
            className={cn("flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold transition-colors", source === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {value === "file" ? <><FileSpreadsheet className="size-4" aria-hidden="true" /> Tải file</> : <><ClipboardPaste className="size-4" aria-hidden="true" /> Dán chữ</>}
          </button>
        ))}
      </div>

      {source === "file" ? <FileDrop reading={reading} fileName={parsed?.fileName} onFile={onFile} /> : <PasteInput onParsed={(result) => showResult(result, "")} />}

      <ImportGuide />

      {parsed?.cards.length ? (
        <Preview
          parsed={parsed}
          title={title}
          onTitle={setTitle}
          showTitle={!setId && !onCards}
          saving={saving}
          onSave={save}
          onClear={() => setParsed(null)}
          actionLabel={onCards ? "Thêm vào danh sách" : setId ? "Thêm" : "Tạo bộ từ với"}
        />
      ) : null}

      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
      {notice ? <p role="status" className="text-primary-edge text-sm font-bold">{notice}</p> : null}
    </section>
  );
}

function FileDrop({ reading, fileName, onFile }: { reading: boolean; fileName?: string; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={cn(
        "grid place-items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/10" : "border-border bg-muted/30",
      )}
    >
      <span className="bg-primary/15 text-primary-edge grid size-12 place-items-center rounded-2xl">
        <Upload className="size-6" aria-hidden="true" />
      </span>
      <p className="font-extrabold">{reading ? "Đang đọc file..." : fileName ? `Đã đọc ${fileName}` : "Kéo thả file vào đây"}</p>
      <p className="text-muted-foreground text-sm">.xlsx hoặc .csv, tối đa 2 MB. File được đọc ngay trên máy bạn.</p>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        aria-label="Chọn file từ vựng"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <Button type="button" variant="outline" disabled={reading} onClick={() => input.current?.click()}>
        {fileName ? "Chọn file khác" : "Chọn file"}
      </Button>
    </div>
  );
}

function PasteInput({ onParsed }: { onParsed: (result: VocabSheetResult) => void }) {
  const [text, setText] = useState("");
  const [termSeparator, setTermSeparator] = useState<TermSeparator>("tab");
  const [custom, setCustom] = useState("-");
  const [cardSeparator, setCardSeparator] = useState<CardSeparator>("newline");
  const [clipboardError, setClipboardError] = useState("");

  const separator = termSeparator === "custom" ? custom : termSeparator;
  const canRead = text.trim().length > 0 && separator.length > 0;

  async function pasteFromClipboard() {
    setClipboardError("");
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      setClipboardError("Trình duyệt chưa cho đọc clipboard. Bấm vào ô rồi nhấn Ctrl+V (⌘V).");
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="vocab-paste" className="sr-only">Danh sách từ</label>
        <textarea
          id="vocab-paste"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={7}
          placeholder={"borrow\tmượn\ndeadline\thạn chót\n\nCopy hai cột (Từ, Nghĩa) trong Excel rồi dán vào đây."}
          className="bg-background focus-visible:ring-primary/30 w-full rounded-2xl border-2 p-3 pb-14 font-mono text-sm outline-none focus-visible:ring-2"
        />
        <Button type="button" size="sm" variant="outline" className="absolute right-3 bottom-4" onClick={pasteFromClipboard}>
          <ClipboardPaste aria-hidden="true" /> Dán
        </Button>
      </div>
      {clipboardError ? <p className="text-muted-foreground text-xs">{clipboardError}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <SeparatorGroup
          label="Giữa từ và nghĩa"
          value={termSeparator}
          options={[["tab", "Tab"], ["comma", "Dấu phẩy"], ["custom", "Tự chọn"]]}
          onChange={(value) => setTermSeparator(value as TermSeparator)}
          extra={termSeparator === "custom" ? (
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              aria-label="Ký tự phân cách tự chọn"
              maxLength={5}
              className="bg-background h-8 w-16 rounded-lg border-2 px-2 text-center font-mono text-sm"
            />
          ) : null}
        />
        <SeparatorGroup
          label="Giữa các từ"
          value={cardSeparator}
          options={[["newline", "Xuống dòng"], ["semicolon", "Dấu chấm phẩy"]]}
          onChange={(value) => setCardSeparator(value as CardSeparator)}
        />
      </div>

      <Button type="button" disabled={!canRead} onClick={() => onParsed(parseVocabText(text, { termSeparator: separator, cardSeparator }))}>
        Đọc danh sách
      </Button>
    </div>
  );
}

function SeparatorGroup({ label, value, options, onChange, extra }: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-muted-foreground text-xs font-extrabold uppercase">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={cn("rounded-xl border-2 px-3 py-1 text-sm font-bold transition-colors", value === key ? "border-primary bg-primary/10 text-primary-edge" : "hover:bg-muted")}
          >
            {text}
          </button>
        ))}
        {extra}
      </div>
    </fieldset>
  );
}

const GUIDES = {
  excel: [
    "Cột A là từ tiếng Anh, cột B là nghĩa. Có thể thêm cột Loại từ, Phát âm, Ví dụ, Từ đồng nghĩa (xem file mẫu).",
    "Lưu thành .xlsx hoặc .csv rồi tải lên. Hoặc bôi đen các cột, sao chép và dán vào tab Dán chữ.",
    "Kiểm tra bảng xem trước rồi bấm lưu.",
  ],
  quizlet: [
    "Mở bộ thẻ trên Quizlet, bấm nút ba chấm rồi chọn Xuất.",
    "Giữ mặc định Tab giữa từ và nghĩa, Dòng mới giữa các thẻ, rồi bấm Sao chép.",
    "Quay lại đây, chọn tab Dán chữ và dán vào.",
  ],
} as const;

function ImportGuide() {
  const [tab, setTab] = useState<keyof typeof GUIDES>("excel");
  return (
    <details className="group rounded-2xl border-2">
      <summary className="hover:bg-muted/60 flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold [&::-webkit-details-marker]:hidden">
        <HelpCircle className="text-secondary size-4" aria-hidden="true" /> Hướng dẫn
        <ChevronDown className="text-muted-foreground ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t-2 px-4 py-3">
        <div className="flex gap-1.5">
          {(["excel", "quizlet"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={cn("rounded-xl border-2 px-3 py-1 text-sm font-bold", tab === key ? "border-primary bg-primary/10 text-primary-edge" : "hover:bg-muted")}
            >
              {key === "excel" ? "Excel" : "Quizlet"}
            </button>
          ))}
        </div>
        <ol className="space-y-2">
          {GUIDES[tab].map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="bg-secondary/15 text-secondary grid size-6 shrink-0 place-items-center rounded-full text-xs font-black">{index + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

function Preview({ parsed, title, onTitle, showTitle, saving, onSave, onClear, actionLabel }: {
  parsed: Parsed;
  title: string;
  onTitle: (value: string) => void;
  showTitle: boolean;
  saving: boolean;
  onSave: () => void;
  onClear: () => void;
  actionLabel: string;
}) {
  const count = Math.min(parsed.cards.length, MAX_CARDS);
  const columns = Object.entries(parsed.columns);
  return (
    <div className="space-y-3 rounded-2xl border-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-black">Đọc được {parsed.cards.length} từ</p>
        {parsed.skipped.length ? <span className="bg-accent/25 rounded-full px-2.5 py-0.5 text-xs font-extrabold">Bỏ qua {parsed.skipped.length} dòng</span> : null}
        <button type="button" onClick={onClear} aria-label="Bỏ kết quả" className="text-muted-foreground hover:bg-muted ml-auto grid size-8 place-items-center rounded-full">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="text-muted-foreground font-bold">Cột nhận ra:</span>
        {columns.length
          ? columns.map(([key, header]) => (
              <span key={key} title={header} className="bg-primary/10 text-primary-edge rounded-full px-2 py-0.5 font-extrabold">{COLUMN_LABELS[key] ?? key}</span>
            ))
          : <span className="bg-muted rounded-full px-2 py-0.5 font-extrabold">Cột A là từ, cột B là nghĩa</span>}
      </div>

      <div className="max-h-72 overflow-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 font-extrabold">Từ</th>
              <th className="px-3 py-2 font-extrabold">Nghĩa</th>
              <th className="hidden px-3 py-2 font-extrabold md:table-cell">Ví dụ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {parsed.cards.slice(0, 50).map((card, index) => (
              <tr key={`${card.term}-${index}`}>
                <td className="px-3 py-2 align-top">
                  <span lang="en" className="font-bold">{card.term}</span>
                  {card.part_of_speech || card.ipa ? (
                    <span className="text-muted-foreground block text-xs">{[card.part_of_speech, card.ipa].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top">{card.definition_vi || card.definition_en}</td>
                <td lang="en" className="text-muted-foreground hidden px-3 py-2 align-top md:table-cell">{card.example_en}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parsed.cards.length > 50 ? <p className="text-muted-foreground border-t px-3 py-2 text-xs">Và {parsed.cards.length - 50} từ nữa.</p> : null}
      </div>

      {parsed.skipped.length ? (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer font-bold">Xem dòng bị bỏ qua</summary>
          <ul className="mt-2 space-y-1">
            {parsed.skipped.slice(0, 30).map((item) => (
              <li key={`${item.row}-${item.reason}`}><b>Dòng {item.row}:</b> {item.reason}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {parsed.cards.length > MAX_CARDS ? (
        <p className="text-destructive text-sm font-bold">Mỗi lần nhập tối đa {MAX_CARDS} từ; chỉ {MAX_CARDS} từ đầu được lưu.</p>
      ) : null}

      {showTitle ? (
        <label className="block space-y-1">
          <span className="text-sm font-extrabold">Tên bộ từ</span>
          <input
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            maxLength={200}
            className="bg-background focus-visible:ring-primary/30 h-11 w-full rounded-xl border-2 px-3 outline-none focus-visible:ring-2"
          />
        </label>
      ) : null}

      <Button type="button" size="lg" className="w-full" disabled={saving || (showTitle && !title.trim())} onClick={onSave}>
        {saving ? "Đang lưu..." : `${actionLabel} ${count} từ`}
      </Button>
    </div>
  );
}

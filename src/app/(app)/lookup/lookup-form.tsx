"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, Languages, Plus, Search, Volume2 } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playTts } from "@/lib/speech/play-tts";
import { formatIpa } from "@/lib/vocab/ipa";
import { Ipa } from "@/components/vocab/ipa-text";
import { lookupResultSchema, type LookupMeaning, type LookupResult } from "@/lib/vocab/lookup-term";
import { saveLookupCard, type SaveLookupState } from "./actions";

type SetOption = { id: string; title: string };
const initialSaveState: SaveLookupState = { error: null };

/** Senses to show: AI entries carry every sense; dictionary fallbacks have one flat sense. */
function senses(result: LookupResult): LookupMeaning[] {
  if (result.meanings?.length) return result.meanings;
  if (!result.definition_vi && !result.definition_en) return [];
  return [{
    part_of_speech: result.part_of_speech ?? "",
    definition_vi: result.definition_vi ?? result.definition_en ?? "",
    definition_en: result.definition_en,
    example_en: result.example_en,
    example_vi: result.example_vi,
    synonyms: result.synonyms.slice(0, 4),
  }];
}

/** The card saved for one sense: the headword with that sense's meaning, example and synonyms. */
function cardFor(result: LookupResult, meaning: LookupMeaning): LookupResult {
  return {
    term: result.term,
    ipa: formatIpa(result.ipa),
    part_of_speech: meaning.part_of_speech || null,
    definition_vi: meaning.definition_vi,
    definition_en: meaning.definition_en,
    example_en: meaning.example_en,
    example_vi: meaning.example_vi,
    synonyms: meaning.synonyms,
  };
}

export function LookupForm({ sets }: { sets: SetOption[] }) {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setId, setSetId] = useState(sets[0]?.id ?? "");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [saveState, saveAction, saving] = useActionState(async (previous: SaveLookupState, formData: FormData) => {
    const next = await saveLookupCard(previous, formData);
    const index = Number(formData.get("meaningIndex"));
    if (!next.error) setSavedIndexes((old) => new Set(old).add(index));
    setSavingIndex(null);
    return next;
  }, initialSaveState);
  const pendingRequest = useRef<AbortController | null>(null);

  async function lookup(query: string) {
    const value = query.trim();
    if (!value) return;
    setTerm(value);
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true);
    setResult(null);
    setError("");
    setSavedIndexes(new Set());

    try {
      const response = await fetch(`/api/lookup?term=${encodeURIComponent(value)}`, { signal: controller.signal });
      const body: unknown = await response.json();
      if (!body || typeof body !== "object") throw new Error("Phản hồi không hợp lệ.");
      const payload = body as { data?: unknown; error?: unknown };
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Chưa tra được từ.");
      }
      const parsed = lookupResultSchema.safeParse(payload.data);
      if (!parsed.success) throw new Error("Phản hồi không hợp lệ.");
      setResult(parsed.data);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Chưa tra được từ.");
    } finally {
      if (pendingRequest.current === controller) setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(term);
  }

  const list = result ? senses(result) : [];
  const fromVietnamese = result?.source_lang === "vi";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="bg-secondary/15 text-secondary-edge grid size-12 place-items-center rounded-2xl">
          <Languages aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-black">Tra từ</h1>
          <p className="text-muted-foreground text-sm font-semibold">Gõ tiếng Anh để xem nghĩa, hoặc gõ tiếng Việt để tìm từ tiếng Anh.</p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="flex gap-2" role="search">
        <label htmlFor="lookup-term" className="sr-only">Từ cần tra</label>
        <input
          id="lookup-term"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Ví dụ: crowded, set up, đông đúc"
          maxLength={100}
          required
          autoComplete="off"
          className="bg-card focus-visible:border-primary h-14 min-w-0 flex-1 rounded-2xl border-2 px-5 text-lg font-semibold outline-none"
        />
        <button
          type="submit"
          aria-label="Tra từ"
          disabled={loading || !term.trim()}
          className="bg-primary grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none disabled:opacity-50"
        >
          <Search aria-hidden="true" className="size-6" />
        </button>
      </form>

      <div aria-live="polite" className="space-y-4">
        {loading ? <LogoLoader label="Đang tra từ..." /> : null}
        {error ? <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-2xl border-2 px-4 py-3 font-bold">{error}</p> : null}

        {result ? (
          <article className="bg-card space-y-6 rounded-3xl border-2 p-6 shadow-[0_4px_0_var(--border)] sm:p-8">
            {result.corrected_term ? (
              <p className="bg-accent/15 rounded-2xl px-4 py-2 text-sm font-semibold">
                Không tìm thấy &ldquo;{term}&rdquo;, đang hiển thị kết quả cho <strong lang="en">{result.corrected_term}</strong>.
              </p>
            ) : null}

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 lang="en" className="text-4xl font-black break-words">{result.term}</h2>
                  <button
                    type="button"
                    aria-label={`Nghe ${result.term}`}
                    onClick={() => void playTts(result.term)}
                    className="text-secondary hover:bg-muted grid size-10 place-items-center rounded-full"
                  >
                    <Volume2 aria-hidden="true" className="size-6" />
                  </button>
                </div>
                {result.ipa ? <p className="text-muted-foreground text-lg"><Ipa value={result.ipa} /></p> : null}
              </div>
              <span className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold">
                {fromVietnamese ? "VI" : "EN"} <ArrowRight aria-hidden="true" className="size-3" /> {fromVietnamese ? "EN" : "VI"}
              </span>
            </div>

            {sets.length > 0 ? (
              <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-2xl p-3">
                <label htmlFor="lookup-set" className="text-sm font-bold">Thêm vào bộ</label>
                <Select value={setId} onValueChange={setSetId}>
                  <SelectTrigger id="lookup-set" className="h-9 min-w-48 flex-1 sm:flex-none">
                    <SelectValue placeholder="Chọn bộ từ" />
                  </SelectTrigger>
                  <SelectContent>
                    {sets.map((set) => <SelectItem key={set.id} value={set.id}>{set.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Link href="/sets/new" className="text-primary-edge text-sm font-bold underline">Tạo bộ từ để lưu từ này</Link>
            )}

            {list.length ? (
              <ol className="divide-y-2">
                {list.map((meaning, index) => (
                  <li key={index} className="space-y-3 py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-full text-sm font-black">{index + 1}</span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-2">
                          {meaning.part_of_speech ? (
                            <span className="bg-secondary/10 text-secondary-edge rounded-full px-2.5 py-0.5 text-xs font-extrabold">{meaning.part_of_speech}</span>
                          ) : null}
                          <span className="text-lg font-black">{meaning.definition_vi}</span>
                        </p>
                        {meaning.definition_en ? <p lang="en" className="text-muted-foreground text-sm">{meaning.definition_en}</p> : null}
                      </div>
                      {sets.length > 0 ? (
                        <form action={saveAction} onSubmit={() => setSavingIndex(index)}>
                          <input type="hidden" name="setId" value={setId} />
                          <input type="hidden" name="meaningIndex" value={index} />
                          <input type="hidden" name="result" value={JSON.stringify(cardFor(result, meaning))} />
                          <Button type="submit" size="sm" variant={savedIndexes.has(index) ? "secondary" : "outline"} disabled={saving || !setId || savedIndexes.has(index)}>
                            {savedIndexes.has(index) ? <><Check aria-hidden="true" /> Đã thêm</> : savingIndex === index ? "Đang thêm..." : <><Plus aria-hidden="true" /> Thêm vào thẻ</>}
                          </Button>
                        </form>
                      ) : null}
                    </div>

                    {meaning.example_en ? (
                      <div className="ml-11 space-y-0.5">
                        <p lang="en" className="flex items-start gap-1.5 font-semibold">
                          <span>{meaning.example_en}</span>
                          <button
                            type="button"
                            aria-label="Nghe câu ví dụ"
                            onClick={() => void playTts(meaning.example_en!)}
                            className="text-secondary hover:bg-muted mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                          >
                            <Volume2 aria-hidden="true" className="size-4" />
                          </button>
                        </p>
                        {meaning.example_vi ? <p className="text-muted-foreground text-sm italic">{meaning.example_vi}</p> : null}
                      </div>
                    ) : null}

                    {meaning.synonyms.length ? (
                      <div className="ml-11 flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground mr-1 text-xs font-extrabold uppercase">Từ đồng nghĩa</span>
                        {meaning.synonyms.map((word) => <WordChip key={word} word={word} onLookup={lookup} />)}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">Chưa có nghĩa cho từ này.</p>
            )}

            {result.compound_words?.length ? (
              <div className="space-y-2 border-t-2 pt-5">
                <p className="text-muted-foreground text-xs font-extrabold uppercase">Từ ghép / liên quan</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.compound_words.map((word) => <WordChip key={word} word={word} onLookup={lookup} />)}
                </div>
              </div>
            ) : null}

            {saveState.error ? <p role="alert" className="text-destructive text-sm font-bold">{saveState.error}</p> : null}
            {saveState.savedSetId && !saveState.error ? (
              <p className="text-primary-edge text-sm font-bold">
                Đã thêm vào bộ từ. <Link href={`/sets/${saveState.savedSetId}`} className="underline">Xem bộ từ</Link>
              </p>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}

/** A related word that looks itself up when tapped. */
function WordChip({ word, onLookup }: { word: string; onLookup: (word: string) => Promise<void> }) {
  return (
    <button
      type="button"
      lang="en"
      onClick={() => void onLookup(word)}
      className="bg-muted/60 hover:bg-secondary/15 hover:text-secondary-edge rounded-full px-3 py-1 text-sm font-bold transition-colors"
    >
      {word}
    </button>
  );
}

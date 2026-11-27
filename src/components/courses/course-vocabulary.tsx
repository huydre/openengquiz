"use client";

import { ArrowLeft, ArrowRight, AudioLines, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { enrollLearnedCards } from "@/app/(app)/sets/review-actions";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { PASS_SCORE } from "@/components/vocab/pronounce-step";
import type { LessonCard } from "@/components/vocab/vocab-lesson";
import type { PronunciationResult } from "@/lib/speech/client";
import { playTts } from "@/lib/speech/play-tts";
import { pronunciationHint } from "@/lib/speech/pronunciation-hints";
import { cn } from "@/lib/utils";

const panel = "space-y-5 rounded-3xl border-2 bg-card p-5 sm:p-7";
const percent = (score: number) => Math.round(score * 100);

export function CourseReviewCards({ cards, onComplete }: { cards: LessonCard[]; onComplete: () => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const card = cards[index];

  function go(next: number) {
    if (saving || next < 0 || next >= cards.length || next === index) return;
    setIndex(next);
    setFlipped(false);
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      go(index + (event.key === "ArrowRight" ? 1 : -1));
    }
  }

  async function finish() {
    setSaving(true);
    try { await onComplete(); } catch { setSaving(false); }
  }

  return <section className={panel} onKeyDown={handleKey} aria-labelledby="review-cards-title">
    <div className="flex items-center justify-between gap-3">
      <h2 id="review-cards-title" className="text-xl font-black">Review Cards</h2>
      {card && <p className="rounded-full bg-secondary/10 px-3 py-1 font-black tabular-nums" aria-live="polite">{index + 1} / {cards.length}</p>}
    </div>
    {card ? <>
      <div className="relative rounded-3xl border-2 border-secondary/30 bg-secondary/5">
        <button type="button" aria-label={flipped ? "Lật về mặt từ" : "Lật xem nghĩa"} aria-pressed={flipped} onClick={() => setFlipped(!flipped)}
          className="grid min-h-64 w-full cursor-pointer content-center gap-3 rounded-3xl p-6 pb-16 text-center focus-visible:outline-2 focus-visible:outline-secondary sm:p-8 sm:pb-16">
          {flipped ? <>
            <span className="text-xl font-black">{card.definition_vi ?? card.definition_en ?? "Chưa có nghĩa"}</span>
            {card.example_en && <span className="space-y-1 rounded-xl bg-background p-3"><span lang="en" className="block font-bold">{card.example_en}</span>{card.example_vi && <span className="block text-sm text-muted-foreground">{card.example_vi}</span>}</span>}
            {!!card.synonyms?.length && <span className="text-sm text-muted-foreground">Đồng nghĩa: <strong lang="en" className="text-foreground">{card.synonyms.join(", ")}</strong></span>}
          </> : <>
            {card.part_of_speech && <span className="mx-auto rounded-full border bg-card px-3 py-1 text-sm font-bold">{card.part_of_speech}</span>}
            <span lang="en" className="text-4xl font-black sm:text-5xl">{card.term}</span>
            {card.ipa && <span className="text-lg text-muted-foreground">{card.ipa}</span>}
          </>}
          <span className="mx-auto inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"><RotateCcw size={15} aria-hidden="true" /> {flipped ? "Xem lại mặt từ" : "Lật xem nghĩa"}</span>
        </button>
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <Button type="button" size="sm" variant="outline" onClick={() => void playTts(flipped ? card.example_en ?? card.term : card.term)}><Volume2 aria-hidden="true" /> {flipped && card.example_en ? "Nghe ví dụ" : "Nghe từ"}</Button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{flipped ? card.definition_vi ?? card.definition_en : card.term}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" size="sm" variant="outline" disabled={!index || saving} onClick={() => go(index - 1)}><ArrowLeft aria-hidden="true" /> Trước</Button>
        <div className="flex flex-wrap justify-center gap-1" aria-label="Chọn thẻ">{cards.map(({ id }, i) => <button key={id} type="button" aria-label={`Thẻ ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => go(i)} className="grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-primary">
          <span className={cn("size-2.5 rounded-full", i === index ? "bg-primary" : "bg-muted-foreground/30")} />
        </button>)}</div>
        <Button type="button" size="sm" disabled={saving} onClick={() => index + 1 === cards.length ? void finish() : go(index + 1)}>{index + 1 === cards.length ? "Tiếp tục" : "Tiếp"} <ArrowRight aria-hidden="true" /></Button>
      </div>
      <p className="text-center text-sm text-muted-foreground">← → chuyển thẻ · Space hoặc Enter để lật khi chọn thẻ</p>
    </> : <><p>Chưa có thẻ từ trong bài này.</p><Button type="button" disabled={saving} onClick={() => void finish()}>Tiếp tục</Button></>}
    {saving && <LogoLoader size="sm" label="Đang lưu bước học" />}
  </section>;
}

function WordScore({ result, audioUrl }: { result: PronunciationResult; audioUrl: string }) {
  const [wordIndex, setWordIndex] = useState<number>();
  const [error, setError] = useState(false);
  const recordingPlayer = useRef<HTMLAudioElement>(null);
  const passed = result.score >= PASS_SCORE;
  const word = wordIndex == null ? undefined : result.words[wordIndex];
  const hints = [...new Set(result.issues.filter((issue) => issue.word_index === wordIndex).map(pronunciationHint).filter(Boolean))];
  const scores = [["Độ chính xác", result.accuracy], ["Độ lưu loát", result.fluency], ["Độ hoàn thiện", result.completeness]] as const;

  return <div className={cn("space-y-4 rounded-3xl border-2 p-4 sm:p-5", passed ? "border-primary/40 bg-primary/5" : "border-brand-orange/50 bg-brand-orange/10")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-xl font-black">{percent(result.score)}% · {passed ? "Đạt" : "Chưa đạt"}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { setError(false); void recordingPlayer.current?.play().catch(() => setError(true)); }}><AudioLines aria-hidden="true" /> Bạn nói</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { recordingPlayer.current?.pause(); void playTts(result.text); }}><Volume2 aria-hidden="true" /> AI phát âm</Button>
      </div>
      <audio ref={recordingPlayer} src={audioUrl} preload="none" />
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Chưa phát được bản ghi.</p>}
    <div className="grid gap-2 sm:grid-cols-3">{scores.map(([label, value]) => <div key={label} className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm"><span className="font-bold">{label}</span><span>{value == null ? "Chưa có" : `${percent(value)}%`}</span></div>
      <progress aria-label={label} max={1} value={value ?? 0} className="block h-2 w-full overflow-hidden rounded-full accent-primary" />
    </div>)}</div>
    <div className="space-y-2">
      <h3 className="font-black">Phân tích từng từ</h3>
      <div className="flex flex-wrap gap-2">{result.words.map((item, index) => <Button key={index} type="button" size="sm" variant={wordIndex === index ? "secondary" : "outline"} aria-expanded={wordIndex === index}
        onClick={() => setWordIndex(wordIndex === index ? undefined : index)}><span lang="en">{item.text}</span> {percent(item.score)}%</Button>)}</div>
      {!result.words.length && <p className="text-sm text-muted-foreground">Chưa có dữ liệu từng từ.</p>}
      {word && <div className="space-y-2 rounded-2xl border bg-card p-3">
        {word.omitted && <p>Từ này chưa được nhận diện.</p>}
        <ul aria-label="Âm vị" className="flex flex-wrap gap-2">{word.phones.map(({ ipa, heard, score }, index) => <li key={index} className="rounded-lg border px-2 py-1 text-sm"><strong>/{ipa}/</strong> {percent(score)}% {heard && heard !== ipa && `(nghe: /${heard}/)`}</li>)}</ul>
        {hints.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{hints.map((hint) => <li key={hint}>{hint}</li>)}</ul>}
        {!word.omitted && !word.phones.length && !hints.length && <p>Chưa có chi tiết âm vị.</p>}
      </div>}
    </div>
  </div>;
}

type Scored = { pron: PronunciationResult; url: string };

function ReadWord({ card, speech, onNext, saving, last }: {
  card: LessonCard; speech: boolean; onNext: (weak: boolean) => void; saving: boolean; last: boolean;
}) {
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [result, setResult] = useState<Scored>();
  const [failures, setFailures] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const retryButton = useRef<HTMLButtonElement>(null);
  const resultUrl = result?.url;
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  async function score() {
    if (!recording || scoring) return;
    setScoring(true);
    setError("");
    const form = new FormData();
    form.set("mode", "scripted");
    form.set("text", card.term);
    form.set("cardId", card.id);
    form.set("audio", recording.audio, "recording.wav");
    try {
      const response = await fetch("/api/speaking/assess", { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      const pron: PronunciationResult | undefined = body?.pron;
      if (!response.ok || typeof pron?.score !== "number") throw new Error(body?.error ?? "Chưa chấm được phát âm.");
      setResult({ pron, url: URL.createObjectURL(recording.audio) });
      if (pron.score < PASS_SCORE) setFailures((value) => value + 1);
      setRecording(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa chấm được phát âm.");
    } finally { setScoring(false); }
  }

  const passed = result != null && result.pron.score >= PASS_SCORE;
  const canSkip = !!result && failures >= 3 && !passed;
  return <div className="space-y-4" onKeyDown={(event) => {
    if (event.key === "Tab" && !event.shiftKey && result && event.target === event.currentTarget) {
      event.preventDefault();
      retryButton.current?.focus();
    }
  }} tabIndex={result ? 0 : undefined} ref={result ? (node) => { node?.focus({ preventScroll: true }); } : undefined}>
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-primary/5 p-4">
      <div className="space-y-1"><p lang="en" className="text-3xl font-black">{card.term}</p>{card.ipa && <p className="text-muted-foreground">{card.ipa}</p>}{card.definition_vi && <p>{card.definition_vi}</p>}</div>
      <Button type="button" size="sm" variant="outline" onClick={() => void playTts(card.term)}><Volume2 aria-hidden="true" /> Nghe mẫu</Button>
    </div>
    {!speech ? <p role="status" className="text-muted-foreground">Chưa có dịch vụ chấm. Hãy nghe mẫu và đọc theo.</p> : result ? <WordScore result={result.pron} audioUrl={result.url} /> : <>
      <AudioRecorder onRecording={setRecording} disabled={scoring} />
      <Button type="button" disabled={!recording || scoring} onClick={() => void score()}>Chấm phát âm</Button>
      {scoring && <LogoLoader size="sm" label="Đang chấm phát âm" />}
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      {result && <Button ref={retryButton} type="button" variant="outline" disabled={saving} onClick={() => setResult(undefined)}>Thử lại</Button>}
      <Button type="button" disabled={saving || (speech && !passed && !canSkip)} onClick={() => onNext(!passed)}>{canSkip ? "Bỏ qua" : "Tiếp tục"}{last && <ArrowRight aria-hidden="true" />}</Button>
    </div>
  </div>;
}

export function CoursePronunciation({ cards, speech, onComplete }: {
  cards: LessonCard[]; speech: boolean; onComplete: (weakTerms: string[]) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [weakTerms, setWeakTerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const card = cards[index];

  async function next(weak: boolean) {
    if (saving) return;
    const weakList = weak && card ? [...weakTerms, card.term] : weakTerms;
    if (index + 1 < cards.length) {
      setWeakTerms(weakList);
      setIndex(index + 1);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await enrollLearnedCards(cards.map(({ id }) => id));
      if (result.error) throw new Error(result.error);
      await onComplete(weakList);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa lưu được thẻ ôn tập.");
      setSaving(false);
    }
  }

  return <section className={panel} aria-labelledby="read-word-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="read-word-title" className="text-xl font-black">Hãy nói từ sau</h2>{card && <p className="font-black tabular-nums" aria-live="polite">{index + 1} / {cards.length}</p>}</div>
    {card ? <ReadWord key={card.id} card={card} speech={speech} onNext={(weak) => void next(weak)} saving={saving} last={index + 1 === cards.length} /> : <><p>Chưa có từ cần đọc.</p><Button type="button" disabled={saving} onClick={() => void next(false)}>Tiếp tục</Button></>}
    {saving && <LogoLoader size="sm" label="Đang lưu thẻ ôn tập" />}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

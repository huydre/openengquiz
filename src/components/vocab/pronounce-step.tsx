"use client";

import { useState } from "react";
import { Lightbulb, RotateCcw, Snail, Volume2 } from "lucide-react";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import type { PronunciationResult } from "@/lib/speech/client";
import { pronunciationHint } from "@/lib/speech/pronunciation-hints";
import { playTts, type TtsAccent } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";

/** Score at or above which a reading counts as passed (0..1). */
export const PASS_SCORE = 0.7;

/**
 * Read `text` aloud, score it with the speech service (scripted mode), show per-word colours and
 * Vietnamese tips. Reports the score through `onScored`; the parent decides when to move on.
 */
export function PronounceStep({
  text, cardId, accent, enabled, onScored,
}: {
  text: string;
  cardId: string;
  accent: TtsAccent;
  enabled: boolean;
  onScored: (score: number) => void;
}) {
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  async function score(take: RecordedAudio | null = recording) {
    if (!take || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("mode", "scripted");
    form.set("text", text);
    form.set("cardId", cardId);
    form.set("audio", take.audio, "recording.wav");
    try {
      const response = await fetch("/api/speaking/assess", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Chưa chấm được phát âm. Hãy thử lại.");
      setResult(body.pron as PronunciationResult);
      onScored((body.pron as PronunciationResult).score);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa chấm được phát âm. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setResult(null);
    setRecording(null);
    setAttempt((n) => n + 1);
  }

  const passed = result ? result.score >= PASS_SCORE : false;
  const issueWords = new Set(result?.issues.map((issue) => issue.word_index) ?? []);
  const hints = [...new Set((result?.issues ?? []).map(pronunciationHint).filter(Boolean))].slice(0, 3);

  const percent = result ? Math.round(result.score * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="bg-muted/50 flex flex-col items-center gap-4 rounded-3xl p-6 text-center">
        <p lang="en" className="text-3xl leading-snug font-black text-balance">{text}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void playTts(text, { accent })}
            className="bg-secondary text-secondary-foreground flex h-11 items-center gap-2 rounded-full px-5 font-extrabold shadow-[0_4px_0_var(--secondary-edge)] active:translate-y-1 active:shadow-none"
          >
            <Volume2 className="size-5" aria-hidden="true" /> Nghe mẫu
          </button>
          <button
            type="button"
            aria-label="Nghe chậm"
            onClick={() => void playTts(text, { accent, speed: 0.7 })}
            className="bg-card text-secondary grid size-11 place-items-center rounded-full border-2 shadow-[0_3px_0_var(--border)] active:translate-y-0.5 active:shadow-none"
          >
            <Snail className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!enabled ? (
        <p role="status" className="bg-accent/15 text-accent-foreground rounded-2xl px-4 py-3 text-sm font-bold">
          Dịch vụ chấm phát âm chưa bật. Hãy nghe mẫu, đọc theo rồi bấm Tiếp.
        </p>
      ) : result ? (
        <div className="space-y-4 animate-[study-rise_0.25s_ease-out]">
          <div className={cn("flex items-center gap-4 rounded-2xl p-4", passed ? "bg-primary/10" : "bg-brand-orange/10")}>
            <span className={cn(
              "grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-black text-white tabular-nums",
              passed ? "bg-primary shadow-[0_4px_0_var(--primary-edge)]" : "bg-brand-orange",
            )}>
              {percent}
            </span>
            <div className="min-w-0">
              <p role="status" className={cn("text-xl font-black", passed ? "text-primary-edge" : "text-brand-orange")}>
                {passed ? "Phát âm tốt lắm!" : "Gần đúng rồi, thử lại nhé"}
              </p>
              <p lang="en" className="mt-1 flex flex-wrap gap-x-1.5 text-lg font-bold">
                {result.words.map((word, index) => {
                  const weak = word.omitted || word.score < PASS_SCORE || issueWords.has(index);
                  return <span key={index} className={weak ? "text-destructive underline decoration-wavy" : "text-primary-edge"}>{word.text}</span>;
                })}
              </p>
            </div>
          </div>
          {hints.length ? (
            <ul className="space-y-2">
              {hints.map((hint) => (
                <li key={hint} className="flex items-start gap-2 text-sm font-semibold"><Lightbulb className="text-accent mt-0.5 size-4 shrink-0" aria-hidden="true" />{hint}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" onClick={retry} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-extrabold">
            <RotateCcw className="size-4" aria-hidden="true" /> Đọc lại
          </button>
        </div>
      ) : (
        <AudioRecorder
          key={attempt}
          variant="wide"
          startLabel={busy ? "Đang chấm..." : "Bấm để đọc"}
          disabled={busy}
          onRecording={(take) => { setRecording(take); if (take) void score(take); }}
        />
      )}
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
    </div>
  );
}

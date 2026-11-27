"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  async function score() {
    if (!recording || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("mode", "scripted");
    form.set("text", text);
    form.set("cardId", cardId);
    form.set("audio", recording.audio, "recording.wav");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p lang="en" className="text-xl font-bold">{text}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void playTts(text, { accent })}>
          <Volume2 aria-hidden="true" /> Nghe mẫu
        </Button>
      </div>

      {!enabled ? (
        <p role="status" className="text-muted-foreground text-sm">
          Dịch vụ chấm phát âm chưa bật. Bạn nghe mẫu và đọc theo, rồi bấm Tiếp.
        </p>
      ) : result ? (
        <div className="space-y-3">
          <p role="status" className={cn("text-lg font-black", passed ? "text-primary" : "text-brand-orange")}>
            {Math.round(result.score * 100)}% · {passed ? "Tốt lắm!" : "Gần đúng rồi, thử lại nhé"}
          </p>
          <p lang="en" className="flex flex-wrap gap-x-2 text-lg font-bold">
            {result.words.map((word, index) => {
              const weak = word.omitted || word.score < PASS_SCORE || issueWords.has(index);
              return (
                <span key={index} className={weak ? "text-destructive underline decoration-wavy" : "text-primary"}>
                  {word.text}
                </span>
              );
            })}
          </p>
          {hints.length > 0 && (
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              {hints.map((hint) => <li key={hint}>{hint}</li>)}
            </ul>
          )}
          <Button type="button" variant="outline" onClick={retry}>Đọc lại</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AudioRecorder key={attempt} onRecording={setRecording} disabled={busy} />
          <Button type="button" disabled={!recording || busy} onClick={() => void score()}>
            {busy ? "Đang chấm..." : "Chấm phát âm"}
          </Button>
        </div>
      )}
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
    </div>
  );
}

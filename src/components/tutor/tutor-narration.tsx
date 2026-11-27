"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playTtsTrack, prefetchTts, type TtsPlayback, type TtsSpeed, type TtsState } from "@/lib/speech/play-tts";
import type { NarrationLine } from "@/lib/courses/narration";

const SPEEDS: TtsSpeed[] = [0.75, 0.9, 1];

type Status = "loading" | "playing" | "paused" | "finishing" | "error";

/**
 * Reusable tutor narration block for course lessons. Plays `lines` serially through
 * playTtsTrack (Kokoro TTS), shows the English line with a Vietnamese subtitle, a dot per
 * line, speed picker (0.75x/0.9x/1x), translation toggle, replay, mascot tap to
 * pause/resume, and a skip button. Calls `onComplete` after the last line (or on skip);
 * the callback may be async so the parent can await progress persistence. A media failure
 * stops playback with an error instead of silently skipping ahead.
 */
export function TutorNarration({
  lines,
  onComplete,
  initialSpeed = 1,
}: {
  lines: NarrationLine[];
  onComplete: () => void | Promise<void>;
  initialSpeed?: TtsSpeed;
}) {
  const [index, setIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [speed, setSpeed] = useState<TtsSpeed>(initialSpeed);
  const [showVi, setShowVi] = useState(true);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<"audio" | "progress">("audio");
  const playback = useRef<TtsPlayback | null>(null);
  const finished = useRef(false);

  const line = lines[index];
  const speaking = status === "playing" || status === "loading";

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setStatus("finishing");
    try {
      await onComplete();
    } catch {
      finished.current = false;
      setStatus("error");
      setErrorKind("progress");
      setError("Chưa lưu được tiến độ. Thử lại nhé.");
    }
  }, [onComplete]);

  // Prefetch the next two lines while the current one plays, so the tutor does not pause to load.
  useEffect(() => {
    for (const next of lines.slice(index + 1, index + 3)) prefetchTts(next.en, { speed });
  }, [index, speed, lines]);

  // Serial playback: one line at a time; index/speed/replay changes restart the effect.
  useEffect(() => {
    if (!line || finished.current) return;
    let cancelled = false;
    const track = playTtsTrack(line.en, {
      speed,
      onState: (state: TtsState) => {
        if (cancelled || finished.current) return;
        if (state === "playing") setStatus("playing");
        else if (state === "loading") setStatus("loading");
      },
    });
    playback.current = track;
    void track.done.then((outcome) => {
      if (cancelled || finished.current) return;
      if (outcome === "failed") {
        setStatus("error");
        setErrorKind("audio");
        setError("Chưa phát được âm thanh. Thử lại hoặc bỏ qua nhé.");
        return;
      }
      if (outcome !== "ended") return; // "stopped" without cleanup: ignore
      if (index + 1 < lines.length) {
        setStatus("loading");
        setIndex(index + 1);
      } else {
        void finish();
      }
    });
    return () => {
      cancelled = true;
      track.stop();
      if (playback.current === track) playback.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, speed, replayNonce, lines]);

  function togglePause() {
    const track = playback.current;
    if (!track) return;
    if (status === "playing" || status === "loading") {
      track.pause();
      setStatus("paused");
    } else if (status === "paused") {
      track.resume();
      setStatus("playing");
    }
  }

  function replay() {
    setStatus("loading");
    setReplayNonce((n) => n + 1);
  }

  function changeSpeed(next: TtsSpeed) {
    setStatus("loading");
    setSpeed(next);
  }

  function skip() {
    playback.current?.stop();
    void finish();
  }

  function retry() {
    setError("");
    if (errorKind === "progress") {
      void finish();
    } else {
      replay();
    }
  }

  return (
    <section className="space-y-5 rounded-3xl border-2 bg-card p-6" aria-label="Gia sư">
      <div className="flex flex-col items-center gap-4">
        {/* Mascot: app logo tile with a simple SVG face inside layered glow rings. */}
        <button
          type="button"
          onClick={togglePause}
          aria-label={status === "paused" ? "Tiếp tục lời dẫn" : "Tạm dừng lời dẫn"}
          className="relative grid size-28 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn("tutor-ring absolute inset-0 rounded-full border-2", speaking ? "border-primary/60" : "border-primary/25")}
              style={{ "--tutor-ring-delay": `${i * 0.9}s`, animationPlayState: speaking ? "running" : "paused" } as React.CSSProperties}
            />
          ))}
          <span
            aria-hidden="true"
            className={cn(
              "tutor-bob bg-primary text-primary-foreground relative grid size-20 place-items-center rounded-3xl shadow-[0_5px_0_var(--primary-edge)]",
              speaking && "scale-105",
            )}
          >
            {/* Mascot face: eyes, smile and blush on the app logo tile styling */}
            <svg viewBox="0 0 48 48" className="size-14" aria-hidden="true">
              <circle cx="15" cy="19" r="3" fill="currentColor" />
              <circle cx="33" cy="19" r="3" fill="currentColor" />
              <circle cx="11" cy="27" r="2.4" fill="currentColor" opacity="0.55" />
              <circle cx="37" cy="27" r="2.4" fill="currentColor" opacity="0.55" />
              <path d="M17 31 q7 6 14 0" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>

        {/* Subtitle card */}
        <div className="w-full rounded-2xl border-2 bg-background p-4 text-center" aria-live="polite">
          {line ? (
            <>
              <p lang="en" className="text-lg font-bold">{line.en}</p>
              {showVi && <p className="mt-1 text-sm text-muted-foreground">{line.vi}</p>}
            </>
          ) : (
            <p className="text-muted-foreground">...</p>
          )}
          <div className="mt-3 flex items-center justify-center gap-1.5" aria-label={`Câu ${index + 1} trên ${lines.length}`}>
            {lines.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === index && speaking ? "bg-primary" : i < index ? "bg-primary/50" : "bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex rounded-xl border-2" role="group" aria-label="Tốc độ đọc">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  "px-3 py-1.5 text-sm font-bold first:rounded-l-[10px] last:rounded-r-[10px]",
                  speed === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowVi((v) => !v)} aria-pressed={showVi}>
            {showVi ? "Ẩn bản dịch" : "Hiện bản dịch"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={replay} disabled={status === "finishing"}>
            <RotateCcw className="size-4" /> Nghe lại
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={skip} disabled={status === "finishing"}>
            <SkipForward className="size-4" /> Bỏ qua
          </Button>
        </div>

        {status === "paused" && (
          <Button type="button" size="sm" onClick={togglePause}>
            <Play className="size-4" /> Tiếp tục
          </Button>
        )}
        {status === "error" && (
          <div className="space-y-2 text-center">
            <p role="alert" className="text-sm font-bold text-destructive">{error}</p>
            <Button type="button" size="sm" onClick={retry}>
              Thử lại
            </Button>
          </div>
        )}
        {status === "finishing" && <p className="text-sm text-muted-foreground">Đang lưu tiến độ...</p>}
      </div>
    </section>
  );
}

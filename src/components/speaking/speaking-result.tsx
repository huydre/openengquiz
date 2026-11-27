import { ArrowRight, Check, Lightbulb, MessageSquareQuote, Target, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpeakingFeedback } from "@/lib/ai/speaking-feedback";
import type { PronunciationResult } from "@/lib/speech/client";
import { playTts } from "@/lib/speech/play-tts";
import { pronunciationHint } from "@/lib/speech/pronunciation-hints";

function pct(score: number | null) {
  return score == null ? null : Math.round(score * 100);
}

function tone(score: number | null) {
  if (score == null) return "muted";
  if (score >= 0.8) return "good";
  if (score >= 0.6) return "ok";
  return "bad";
}

const TONE_TEXT = { good: "text-primary-edge", ok: "text-brand-orange", bad: "text-destructive", muted: "text-muted-foreground" } as const;
const TONE_BAR = { good: "bg-primary", ok: "bg-brand-orange", bad: "bg-destructive", muted: "bg-muted-foreground" } as const;
const TONE_STROKE = { good: "stroke-primary", ok: "stroke-brand-orange", bad: "stroke-destructive", muted: "stroke-muted-foreground" } as const;
const TONE_CHIP = {
  good: "border-primary/40 bg-primary/10 text-primary-edge",
  ok: "border-brand-orange/40 bg-brand-orange/10 text-brand-orange",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border text-muted-foreground",
} as const;

/** Pronunciation scores, per-word colours with phoneme details, and the AI feedback on the answer. */
export function SpeakingResult({ pron, transcript, feedback, saved, speaking, ai }: {
  pron: PronunciationResult;
  transcript: string;
  feedback: SpeakingFeedback | null;
  saved: boolean;
  speaking: boolean;
  ai: boolean;
}) {
  const issueIndices = new Set(pron.issues.map((issue) => issue.word_index));
  const overall = pct(pron.score) ?? 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const metrics = [
    ["Chính xác", pron.accuracy],
    ["Trôi chảy", pron.fluency],
    ["Đầy đủ", pron.completeness],
  ] as const;

  return (
    <section aria-label="Kết quả luyện nói" className="space-y-5">
      <div className="bg-card rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)] sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 108 108" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="54" cy="54" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
              <circle cx="54" cy="54" r={radius} fill="none" strokeWidth="10" strokeLinecap="round"
                className={cn("transition-[stroke-dashoffset] duration-1000", TONE_STROKE[tone(pron.score)])}
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - overall / 100)} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-4xl font-black tabular-nums">{overall}</p>
                <p className="text-muted-foreground text-[11px] font-extrabold uppercase">Phát âm</p>
              </div>
            </div>
          </div>
          <div className="w-full flex-1 space-y-3">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between text-sm font-extrabold">
                  <span>{label}</span>
                  <span className={TONE_TEXT[tone(value)]}>{pct(value) ?? "?"}{pct(value) != null ? "%" : ""}</span>
                </div>
                <div className="bg-muted mt-1 h-2.5 overflow-hidden rounded-full">
                  <div className={cn("h-full rounded-full", TONE_BAR[tone(value)])} style={{ width: `${pct(value) ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <p className="text-muted-foreground mb-3 text-sm font-bold">Bấm vào từng từ để xem âm cần sửa.</p>
          <div className="flex flex-wrap gap-2">
            {pron.words.map((word, index) => {
              const level = word.omitted ? "bad" : issueIndices.has(index) && word.score >= 0.8 ? "ok" : tone(word.score);
              return (
                <details key={index} className="group relative">
                  <summary className={cn("cursor-pointer list-none rounded-xl border-2 px-3 py-1.5 text-lg font-extrabold [&::-webkit-details-marker]:hidden", TONE_CHIP[level])}>
                    <span lang="en">{word.text}</span>
                    <span className="ml-1.5 text-xs font-black opacity-80">{word.omitted ? "bỏ sót" : pct(word.score)}</span>
                  </summary>
                  <div className="bg-popover absolute top-full left-0 z-20 mt-2 w-64 space-y-2 rounded-2xl border-2 p-3 shadow-lg">
                    {word.phones.length ? (
                      <ul className="space-y-1">
                        {word.phones.map((phone, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-ipa font-bold">/{phone.ipa}/{phone.heard && phone.heard !== phone.ipa ? <span className="text-destructive"> → /{phone.heard}/</span> : null}</span>
                            <span className={cn("font-black tabular-nums", TONE_TEXT[tone(phone.score)])}>{pct(phone.score)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-muted-foreground text-sm">Chưa có chi tiết âm.</p>}
                    <button type="button" onClick={() => void playTts(word.text)} className="text-secondary flex items-center gap-1.5 text-sm font-extrabold">
                      <Volume2 className="size-4" aria-hidden="true" /> Nghe từ mẫu
                    </button>
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {speaking && transcript ? (
          <p className="bg-muted/60 mt-6 rounded-2xl px-4 py-3"><span className="text-muted-foreground text-sm font-extrabold">Bạn đã nói: </span><span lang="en" className="font-semibold">{transcript}</span></p>
        ) : null}

        {pron.issues.length ? (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {pron.issues.slice(0, 6).map((issue, i) => {
              const hint = pronunciationHint(issue);
              return (
                <li key={i} className="border-brand-orange/30 bg-brand-orange/5 rounded-2xl border-2 p-3">
                  <p className="font-extrabold"><span lang="en">{issue.word ?? "Âm cần luyện"}</span>
                    {issue.expected ? <span className="font-ipa text-muted-foreground ml-2 text-sm">/{issue.expected}/{issue.heard ? ` → /${issue.heard}/` : ""}</span> : null}
                  </p>
                  {hint ? <p className="text-muted-foreground mt-1 text-sm">{hint}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {pron.warnings.length ? <p className="text-muted-foreground mt-4 text-sm">Bản ghi có vấn đề khi phân tích. Hãy thử lại nếu điểm chưa đúng với câu bạn nói.</p> : null}
      </div>

      {feedback ? (
        <div className="bg-card space-y-5 rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)] sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-black">Góp ý của AI</h3>
            <span className="bg-secondary/15 text-secondary rounded-full px-3 py-1 text-sm font-black">CEFR {feedback.cefr}</span>
          </div>

          <div className={cn("flex items-start gap-3 rounded-2xl p-4", feedback.usedTarget ? "bg-primary/10" : "bg-destructive/10")}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-white", feedback.usedTarget ? "bg-primary" : "bg-destructive")}>
              {feedback.usedTarget ? <Check className="size-5" aria-hidden="true" /> : <Target className="size-5" aria-hidden="true" />}
            </span>
            <div>
              <p className="font-extrabold">{feedback.usedTarget ? "Đã dùng đúng từ mục tiêu" : "Chưa dùng đúng từ mục tiêu"}</p>
              <p className="text-muted-foreground">{feedback.targetNote}</p>
            </div>
          </div>

          {feedback.corrections.length ? (
            <div className="space-y-2">
              <p className="font-extrabold">Sửa câu</p>
              <ul className="space-y-2">
                {feedback.corrections.map((item, i) => (
                  <li key={i} className="rounded-2xl border-2 p-4">
                    <p className="flex flex-wrap items-center gap-2 text-lg font-bold" lang="en">
                      <span className="bg-destructive/10 text-destructive rounded-lg px-2 line-through decoration-2"><X className="mr-1 inline size-4" aria-hidden="true" />{item.original}</span>
                      {item.replacement ? <><ArrowRight className="text-muted-foreground size-4" aria-hidden="true" /><span className="bg-primary/12 text-primary-edge rounded-lg px-2"><Check className="mr-1 inline size-4" aria-hidden="true" />{item.replacement}</span></> : null}
                    </p>
                    <p className="text-muted-foreground mt-1.5">{item.explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="bg-secondary/10 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-secondary flex items-center gap-2 font-extrabold"><MessageSquareQuote className="size-5" aria-hidden="true" /> Câu trả lời mẫu</p>
              <button type="button" onClick={() => void playTts(feedback.example)} aria-label="Nghe câu mẫu" className="bg-secondary text-secondary-foreground grid size-10 place-items-center rounded-full shadow-[0_3px_0_var(--secondary-edge)] active:translate-y-0.5 active:shadow-none">
                <Volume2 className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p lang="en" className="mt-2 text-lg font-semibold">{feedback.example}</p>
          </div>

          <p className="flex items-start gap-2"><Lightbulb className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" /><span><span className="font-extrabold">Nói thêm: </span>{feedback.suggestion}</span></p>
        </div>
      ) : ai ? <p className="text-muted-foreground font-semibold">Chưa có góp ý AI cho lượt này. Điểm phát âm vẫn có ở trên.</p> : null}

      <p role="status" className="text-muted-foreground text-center text-sm font-semibold">
        {saved ? "Đã lưu vào lịch sử luyện nói." : "Chưa lưu được lượt này vào lịch sử. Kết quả vẫn hiển thị ở đây."}
      </p>
    </section>
  );
}

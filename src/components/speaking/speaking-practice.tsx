"use client";

import { useState } from "react";
import { History, Mic, Play, RefreshCw, Sparkles, Volume2 } from "lucide-react";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { ModeCard, ModeIntro, ModeNotice, ModeTopBar, OptionPill, TopBarLink } from "@/components/study/mode-shell";
import type { SpeakingFeedback } from "@/lib/ai/speaking-feedback";
import type { PronunciationResult } from "@/lib/speech/client";
import { playTts } from "@/lib/speech/play-tts";
import { SpeakingResult } from "./speaking-result";

type Question = { question: string; term: string; level: string };
type Result = { pron: PronunciationResult; transcript: string; feedback: SpeakingFeedback | null; saved: boolean };
type Props = { enabled: boolean; setId?: string; setTitle?: string } & (
  | { mode: "scripted"; initialText: string; cardId?: string }
  | { mode: "speaking"; ai: boolean; browserStt: boolean; cards: { id: string; term: string }[] }
);

async function post<T>(path: string, body: FormData | object): Promise<T> {
  const response = await fetch(`/api/speaking/${path}`, body instanceof FormData
    ? { method: "POST", body }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Yêu cầu chưa thành công. Hãy thử lại.");
  return data;
}

const area = "bg-background focus:border-secondary w-full rounded-2xl border-2 p-4 text-lg font-semibold outline-none";

/**
 * Speaking practice. "speaking": pick a word from the set, get an AI question that uses it, answer
 * aloud, and see pronunciation scores plus AI feedback. "scripted": read a given English sentence
 * and get pronunciation scores only.
 */
export function SpeakingPractice(props: Props) {
  const scripted = props.mode === "scripted";
  const [text, setText] = useState(scripted ? props.initialText.slice(0, 2000) : "");
  const [cardId, setCardId] = useState(scripted ? props.cardId : props.cards[0]?.id);
  const [question, setQuestion] = useState<Question>();
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState<"question" | "assess">();
  const [error, setError] = useState("");
  const prompt = scripted ? text.trim() : question?.question;

  function resetAnswer() {
    setRecording(null);
    setTranscript("");
    setResult(undefined);
    setError("");
  }

  async function loadQuestion() {
    if (!cardId || busy) return;
    resetAnswer();
    setQuestion(undefined);
    setBusy("question");
    try { setQuestion(await post<Question>("question", { cardId })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được câu hỏi."); }
    finally { setBusy(undefined); }
  }

  async function assess() {
    if (!recording || !prompt || busy) return;
    setError("");
    setResult(undefined);
    setBusy("assess");
    const form = new FormData();
    form.set("mode", props.mode);
    form.set("audio", recording.audio, "recording.wav");
    form.set(scripted ? "text" : "question", prompt);
    if (cardId) form.set("cardId", cardId);
    if (!scripted && transcript.trim()) form.set("transcript", transcript.trim());
    try {
      const scored = await post<Result>("assess", form);
      setResult(scored);
      if (!scripted) setTranscript(scored.transcript);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không chấm được phát âm."); }
    finally { setBusy(undefined); }
  }

  function playRecording() {
    if (!recording) return;
    const url = URL.createObjectURL(recording.audio);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    void audio.play();
  }

  const title = scripted ? "Luyện phát âm" : "Luyện nói";
  const canAssess = !busy && !!prompt && !!recording && !(!scripted && props.browserStt && !transcript.trim());

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <ModeTopBar setId={props.setId} title={props.setTitle ?? title}>
        <TopBarLink href="/speaking/history" icon={History}>Lịch sử</TopBarLink>
      </ModeTopBar>

      {!props.enabled ? <ModeNotice>Dịch vụ giọng nói chưa được bật. Bạn vẫn có thể nghe mẫu.</ModeNotice> : null}
      {!scripted && !props.ai ? <ModeNotice>AI chưa được bật: vẫn chấm phát âm, chưa có góp ý ngữ pháp.</ModeNotice> : null}

      {scripted ? (
        <ModeIntro
          icon={Mic}
          tone="bg-brand-grape/15 text-brand-grape"
          title={title}
          description="Đọc to một câu tiếng Anh. Bạn sẽ thấy điểm từng từ và từng âm cần sửa."
        >
          <label htmlFor="practice-text" className="block font-extrabold">Câu tiếng Anh để đọc</label>
          <textarea id="practice-text" className={area} lang="en" value={text} rows={3} maxLength={2000}
            disabled={!!busy} placeholder="The quick brown fox jumps over the lazy dog."
            onChange={(e) => { setText(e.target.value); setResult(undefined); setError(""); }} />
        </ModeIntro>
      ) : !question ? (
        <ModeIntro
          icon={Mic}
          tone="bg-brand-grape/15 text-brand-grape"
          title={title}
          description="Chọn một từ, AI sẽ đặt câu hỏi cần dùng từ đó. Trả lời bằng giọng nói để được chấm phát âm và góp ý."
          footer={
            <>
              <p className="text-muted-foreground text-sm font-bold">Câu hỏi phù hợp với trình độ của bạn.</p>
              <Button type="button" size="lg" className="h-14 px-10 text-base" disabled={!!busy || !props.enabled || !cardId} onClick={loadQuestion}>
                {busy === "question" ? "Đang tạo câu hỏi..." : <><Sparkles aria-hidden="true" /> Tạo câu hỏi</>}
              </Button>
            </>
          }
        >
          {props.cards.length ? (
            <div>
              <p id="target-word" className="mb-2 font-extrabold">Từ mục tiêu</p>
              <div role="group" aria-labelledby="target-word" className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                {props.cards.map((card) => (
                  <OptionPill key={card.id} lang="en" selected={cardId === card.id} disabled={!!busy} onClick={() => { setCardId(card.id); resetAnswer(); }}>
                    {card.term}
                  </OptionPill>
                ))}
              </div>
            </div>
          ) : <p className="font-bold">Bộ từ chưa có thẻ để luyện nói.</p>}
        </ModeIntro>
      ) : (
        <ModeCard className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-brand-grape/15 text-brand-grape rounded-full px-3 py-1 text-xs font-extrabold uppercase">Câu hỏi</span>
            <span className="bg-muted rounded-full px-3 py-1 text-xs font-extrabold">Dùng từ <span lang="en">{question.term}</span></span>
            <span className="bg-muted rounded-full px-3 py-1 text-xs font-extrabold">{question.level}</span>
          </div>
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => void playTts(question.question)}
              aria-label="Nghe câu hỏi"
              className="bg-secondary/15 text-secondary hover:bg-secondary/25 grid size-12 shrink-0 place-items-center rounded-2xl"
            >
              <Volume2 className="size-6" aria-hidden="true" />
            </button>
            <p lang="en" className="text-2xl leading-snug font-black text-balance sm:text-3xl">{question.question}</p>
          </div>
          <button type="button" onClick={loadQuestion} disabled={!!busy} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-extrabold disabled:opacity-50">
            <RefreshCw className="size-4" aria-hidden="true" /> Đổi câu hỏi khác
          </button>
        </ModeCard>
      )}

      {busy === "question" && question ? <LogoLoader size="sm" label="Đang tạo câu hỏi" /> : null}

      {props.enabled && prompt && (scripted || question) ? (
        <ModeCard className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">{scripted ? "Đọc câu mẫu" : "Câu trả lời của bạn"}</h2>
            {scripted ? (
              <button type="button" onClick={() => void playTts(prompt)} className="text-secondary flex items-center gap-1.5 text-sm font-extrabold">
                <Volume2 className="size-4" aria-hidden="true" /> Nghe mẫu
              </button>
            ) : null}
          </div>
          <AudioRecorder
            variant="wide"
            startLabel={recording ? "Ghi lại" : "Bấm để nói"}
            disabled={!!busy}
            transcribe={!scripted && props.browserStt}
            onRecording={(next) => { setRecording(next); setTranscript(next?.transcript ?? ""); setResult(undefined); setError(""); }}
          />
          {recording ? (
            <button type="button" onClick={playRecording} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-extrabold">
              <Play className="size-4" aria-hidden="true" /> Nghe lại bản ghi
            </button>
          ) : null}
          {!scripted && recording ? (
            <div className="space-y-2">
              <label htmlFor="practice-transcript" className="font-extrabold">Bản chép câu vừa nói</label>
              <textarea id="practice-transcript" className={area} lang="en" rows={3} maxLength={2000}
                disabled={!!busy} value={transcript} placeholder={props.browserStt ? "" : "Để trống để AI tự chép lại"}
                onChange={(e) => { setTranscript(e.target.value); setResult(undefined); }} />
              <p className="text-muted-foreground text-sm">{props.browserStt
                ? "Kiểm tra hoặc sửa lại đúng câu bạn đã nói trước khi chấm."
                : "Để trống để AI tự chép lại, hoặc nhập đúng câu bạn đã nói."}</p>
            </div>
          ) : null}
          <Button type="button" size="lg" variant="secondary" className="h-14 w-full text-base" disabled={!canAssess} onClick={assess}>
            {busy === "assess" ? "Đang chấm điểm..." : "Chấm điểm"}
          </Button>
        </ModeCard>
      ) : null}

      {busy === "assess" ? <LogoLoader size="sm" label="Đang chấm phát âm" /> : null}
      {error ? <p role="alert" className="text-destructive font-bold">{error}</p> : null}
      {result ? <SpeakingResult {...result} speaking={!scripted} ai={!scripted && props.ai} /> : null}
    </div>
  );
}

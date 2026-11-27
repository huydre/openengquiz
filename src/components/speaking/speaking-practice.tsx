"use client";

import Link from "next/link";
import { useState } from "react";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SpeakingFeedback } from "@/lib/ai/speaking-feedback";
import type { PronunciationResult } from "@/lib/speech/client";
import { playTts } from "@/lib/speech/play-tts";
import { SpeakingResult } from "./speaking-result";

type Question = { question: string; term: string; level: string };
type Result = { pron: PronunciationResult; transcript: string; feedback: SpeakingFeedback | null; saved: boolean };
type Props = { enabled: boolean } & (
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

const panel = "space-y-4 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]";
const area = "w-full rounded-2xl border-2 bg-background p-3 focus-visible:outline-2 focus-visible:outline-ring";

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">{scripted ? "Luyện phát âm" : "Luyện nói với từ mục tiêu"}</h1>
        <Link href="/speaking/history" className={buttonVariants({ variant: "outline" })}>Lịch sử</Link>
      </header>
      {!props.enabled && <p role="status">Dịch vụ giọng nói chưa được bật. Bạn vẫn có thể nghe mẫu.</p>}
      {!scripted && !props.ai && <p className="text-muted-foreground">AI chưa được bật. Vẫn chấm phát âm, chưa có góp ý ngữ pháp.</p>}
      <section className={panel}>
        {scripted ? (
          <div className="space-y-2">
            <label htmlFor="practice-text" className="font-extrabold">Câu tiếng Anh để đọc</label>
            <textarea id="practice-text" className={area} lang="en" value={text} rows={3} maxLength={2000}
              disabled={!!busy} placeholder="The quick brown fox jumps over the lazy dog."
              onChange={(e) => { setText(e.target.value); setResult(undefined); setError(""); }} />
          </div>
        ) : props.cards.length ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 space-y-2">
              <label htmlFor="target-card" className="block font-extrabold">Từ mục tiêu</label>
              <Select value={cardId} disabled={!!busy || !props.enabled} onValueChange={(id) => {
                setCardId(id); setQuestion(undefined); resetAnswer();
              }}>
                <SelectTrigger id="target-card" className="max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{props.cards.map((card) => <SelectItem key={card.id} value={card.id}>{card.term}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="button" disabled={!!busy || !props.enabled} onClick={loadQuestion}>
              {question ? "Đổi câu hỏi" : "Tạo câu hỏi"}
            </Button>
          </div>
        ) : <p>Bộ từ chưa có thẻ để luyện nói.</p>}
        {question && <div><p className="font-bold">Dùng từ <span lang="en">{question.term}</span> · {question.level}</p><p lang="en">{question.question}</p></div>}
        {prompt && <Button type="button" variant="outline" disabled={!!busy} onClick={() => void playTts(prompt)}>Nghe mẫu</Button>}
        {busy === "question" && <LogoLoader size="sm" label="Đang tạo câu hỏi" />}
      </section>
      {props.enabled && (scripted || question) && (
        <section className={panel}>
          <h2 className="text-xl font-extrabold">{scripted ? "Đọc câu mẫu" : "Ghi câu trả lời"}</h2>
          <AudioRecorder disabled={!!busy || !prompt} transcribe={!scripted && props.browserStt} onRecording={(next) => {
            setRecording(next); setTranscript(next?.transcript ?? ""); setResult(undefined); setError("");
          }} />
          {!scripted && recording && (
            <div className="space-y-2">
              <label htmlFor="practice-transcript" className="font-extrabold">Bản chép câu vừa nói</label>
              <textarea id="practice-transcript" className={area} lang="en" rows={3} maxLength={2000}
                disabled={!!busy} value={transcript} onChange={(e) => { setTranscript(e.target.value); setResult(undefined); }} />
              <p className="text-sm text-muted-foreground">{props.browserStt
                ? "Kiểm tra hoặc nhập lại đúng câu bạn đã nói trước khi chấm."
                : "Để trống để Groq tạo bản chép, hoặc nhập đúng câu bạn đã nói. Bạn có thể sửa bản chép và chấm lại."}</p>
            </div>
          )}
          <Button type="button" disabled={!!busy || !prompt || !recording || (!scripted && props.browserStt && !transcript.trim())}
            onClick={assess}>Chấm phát âm</Button>
          {busy === "assess" && <LogoLoader size="sm" label="Đang chấm phát âm" />}
        </section>
      )}
      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
      {result && <SpeakingResult {...result} speaking={!scripted} ai={!scripted && props.ai} />}
    </div>
  );
}

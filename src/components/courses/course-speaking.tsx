"use client";

import { Check, Languages, Lightbulb, Mic, Pencil, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { highlightPhrases, splitQuestion } from "@/lib/courses/course-question";
import type { FeedbackTone, LessonComparison, LessonFeedback, LessonIdea } from "@/lib/courses/lesson-player-types";
import { playTts } from "@/lib/speech/play-tts";
import { lookupResultSchema, type LookupResult } from "@/lib/vocab/lookup-term";

const toneLabels: Record<FeedbackTone, string> = { serious: "Nghiêm túc", friendly: "Thân thiện", funny: "Hài hước" };

function Listen({ text, label }: { text: string; label: string }) {
  const [error, setError] = useState(false);
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => {
      setError(false);
      void playTts(text).catch(() => setError(true));
    }}><Volume2 aria-hidden="true" /> {label}</Button>
    {error && <span role="alert" className="text-sm text-destructive">Chưa phát được âm thanh.</span>}
  </>;
}

function WordMeaning({ term }: { term: string }) {
  const [result, setResult] = useState<LookupResult>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function lookup() {
      try {
        const response = await fetch(`/api/lookup?term=${encodeURIComponent(term)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Chưa tra được nghĩa.");
        const parsed = lookupResultSchema.safeParse(payload.data);
        if (!parsed.success) throw new Error("Chưa có nghĩa cho từ này.");
        setResult(parsed.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa tra được nghĩa.");
      }
    }
    void lookup();
    return () => controller.abort();
  }, [term]);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-baseline gap-2"><strong lang="en">{term}</strong>{result?.ipa && <span>{result.ipa}</span>}</div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : result ? (
      <p>{result.definition_vi ?? result.definition_en ?? "Chưa có nghĩa cho từ này."}</p>
    ) : <LogoLoader size="sm" label="Đang tra nghĩa" />}
  </div>;
}

export function CourseQuestion({ question, second, terms, voice, ai, busy, submit, getIdeas, getTranslation }: {
  question: string; second?: boolean; terms?: string[]; voice: boolean; ai: boolean; busy: boolean;
  submit: (transcript: string, audio?: Blob) => Promise<void>;
  getIdeas: () => Promise<LessonIdea[]>;
  getTranslation: () => Promise<string>;
}) {
  const [mode, setMode] = useState<"voice" | "text">(voice ? "voice" : "text");
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [ideas, setIdeas] = useState<LessonIdea[]>();
  const [showIdeas, setShowIdeas] = useState(false);
  const [loading, setLoading] = useState<"ideas" | "translation">();
  const [error, setError] = useState("");

  async function toggleHelp(kind: "ideas" | "translation") {
    if (kind === "ideas" && showIdeas) { setShowIdeas(false); return; }
    if (kind === "translation" && showTranslation) { setShowTranslation(false); return; }
    setError("");
    setLoading(kind);
    try {
      if (kind === "ideas") {
        if (!ideas) setIdeas(await getIdeas());
        setShowIdeas(true);
      } else {
        if (!translation) setTranslation(await getTranslation());
        setShowTranslation(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tải được gợi ý.");
    } finally { setLoading(undefined); }
  }

  return <div className="space-y-5">
    <section className="space-y-4 rounded-3xl border-2 bg-primary/5 p-5 sm:p-7" aria-labelledby="lesson-question">
      <p className="text-sm font-black text-primary">{second ? "Vận dụng từ mới" : "Khởi động"}</p>
      <h2 id="lesson-question" className="text-2xl font-black leading-snug sm:text-3xl" lang="en">
        {splitQuestion(question).map(({ value, term }, index) => term ? (
          <Popover key={index}>
            <PopoverTrigger className="cursor-pointer rounded px-0.5 decoration-primary/50 decoration-dotted underline-offset-4 hover:bg-primary/10 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
              {value}
            </PopoverTrigger>
            <PopoverContent lang="vi" className="rounded-2xl"><WordMeaning term={term} /></PopoverContent>
          </Popover>
        ) : value)}
      </h2>
      <p className="text-sm text-muted-foreground">Bấm một từ trong câu để tra nghĩa.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Listen text={question} label="Nghe câu hỏi" />
        <Button type="button" size="sm" variant="outline" role="switch" aria-checked={showTranslation} disabled={!!loading} onClick={() => void toggleHelp("translation")}>
          <Languages aria-hidden="true" /> Bản dịch
        </Button>
        <Button type="button" size="sm" variant="secondary" aria-expanded={showIdeas} disabled={!ai || !!loading} onClick={() => void toggleHelp("ideas")}><Lightbulb aria-hidden="true" /> Bí ý tưởng?</Button>
      </div>
      {loading && <LogoLoader size="sm" label={loading === "ideas" ? "Đang tìm ý tưởng" : "Đang dịch câu hỏi"} />}
      {showTranslation && <p className="border-l-2 border-primary pl-3">{translation}</p>}
      {showIdeas && <ul className="space-y-2 rounded-2xl border bg-card p-4">{ideas?.map(({ vi, en }) => <li key={en}>• {vi} <strong lang="en">({en})</strong></li>)}</ul>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!!terms?.length && <p className="text-sm text-muted-foreground">Thử dùng từ vừa học: <strong lang="en" className="text-foreground">{terms.join(", ")}</strong>.</p>}
    </section>
    <section className="space-y-4 rounded-3xl border-2 bg-card p-5 sm:p-7" aria-labelledby="lesson-answer">
      <h2 id="lesson-answer" className="text-xl font-black">{second ? "Trả lời lần 2" : "Đến lượt bạn"}</h2>
      {voice && <div className="flex gap-2" role="group" aria-label="Cách trả lời">
        <Button type="button" size="sm" variant={mode === "voice" ? "secondary" : "outline"} aria-pressed={mode === "voice"} disabled={busy} onClick={() => setMode("voice")}><Mic aria-hidden="true" /> Nói</Button>
        <Button type="button" size="sm" variant={mode === "text" ? "secondary" : "outline"} aria-pressed={mode === "text"} disabled={busy} onClick={() => { setMode("text"); setRecording(null); }}><Pencil aria-hidden="true" /> Nhập</Button>
      </div>}
      {mode === "voice" && <AudioRecorder disabled={busy} transcribe startLabel="Bắt đầu nói" recordingLabel="Đang nói: English" onRecording={(value) => {
        setRecording(value);
        setAnswer(value?.transcript ?? "");
      }} />}
      {(mode === "text" || recording) && <div className="space-y-2">
        <label htmlFor="lesson-answer-input" className="block text-sm font-bold">{mode === "text" ? "Câu trả lời bằng tiếng Anh" : "Bản chép (có thể chỉnh sửa)"}</label>
        <textarea id="lesson-answer-input" lang="en" rows={3} maxLength={2000} value={answer} disabled={busy} onChange={(event) => setAnswer(event.target.value)} className="w-full rounded-2xl border-2 bg-background p-3" />
      </div>}
      {!ai && <p role="status" className="text-sm text-muted-foreground">Gia sư AI chưa sẵn sàng chấm câu trả lời.</p>}
      <Button type="button" disabled={!ai || busy || (mode === "voice" ? !recording : !answer.trim())} onClick={() => void submit(answer, mode === "voice" ? recording?.audio : undefined)}>
        Gửi câu trả lời
      </Button>
      {busy && <LogoLoader size="sm" label="Đang nhận xét" />}
    </section>
  </div>;
}

export function CourseFeedbackPanel({ transcript, feedback, pronunciation, tone, setTone, terms, comparison, busy, retry, advance }: {
  transcript: string; feedback: LessonFeedback | null;
  pronunciation?: number | null; tone: FeedbackTone; setTone: (value: FeedbackTone) => void; terms: string[];
  comparison?: LessonComparison | null;
  busy: boolean; retry: () => void; advance: () => void;
}) {
  const [translated, setTranslated] = useState(false);
  return <div className="space-y-4">
    <section className="space-y-3 rounded-3xl border-2 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">Câu trả lời của bạn</h2><span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary"><Check size={16} aria-hidden="true" /> Hoàn thành</span></div>
      <p className="whitespace-pre-wrap" lang="en">{transcript}</p>
      {pronunciation != null && <p className="text-sm font-bold">Phát âm: {Math.round(pronunciation * 100)}%</p>}
    </section>
    {feedback && <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Tổng CEFR", feedback.cefr], ["Ngữ pháp", feedback.grammarCefr], ["Từ vựng", feedback.vocabularyCefr], ["Mạch lạc", feedback.coherenceCefr]].map(([label, score], index) => <div key={label} className={`rounded-2xl border-2 p-3 ${index === 0 ? "border-primary/30 bg-primary/10" : "bg-card"}`}>
          <dt className="text-sm font-bold text-muted-foreground">{label}</dt><dd className="text-2xl font-black">{score}</dd>
        </div>)}
      </dl>
      <section className="space-y-3 rounded-3xl border-2 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-black">Gợi ý từ gia sư</h2>
          <div className="flex items-center gap-2"><label htmlFor="lesson-tone" className="text-sm font-bold">Giọng góp ý</label>
            <Select value={tone} disabled={busy} onValueChange={(value) => setTone(value as FeedbackTone)}>
              <SelectTrigger id="lesson-tone"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(toneLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <p>{feedback.comment_vi}</p>
        {feedback.corrections.length > 0 && <ul className="space-y-2">{feedback.corrections.map(({ original, replacement, reason }, index) => <li key={index} className="border-l-2 border-primary/30 pl-3">
          <p lang="en"><del className="text-muted-foreground">{original}</del> <strong>{replacement}</strong></p><p className="text-sm">{reason}</p>
        </li>)}</ul>}
      </section>
      <section className="space-y-3 rounded-3xl border-2 bg-secondary/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">Câu trả lời điểm cao</h2><span className="rounded-full border bg-card px-2 py-1 text-xs font-black">{feedback.exampleCefr}</span></div>
        <p lang="en">{highlightPhrases(feedback.example, [...feedback.highlights, ...terms]).map(({ text, highlighted }, index) => highlighted ? <mark key={index} className="rounded bg-amber-200 px-0.5 text-amber-950">{text}</mark> : text)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Listen text={feedback.example} label="Nghe câu mẫu" />
          <Button type="button" size="sm" variant="outline" aria-expanded={translated} onClick={() => setTranslated(!translated)}><Languages aria-hidden="true" /> {translated ? "Ẩn bản dịch" : "Xem bản dịch"}</Button>
        </div>
        {translated && <p className="text-muted-foreground">{feedback.example_vi}</p>}
      </section>
    </>}
    {comparison && <section className="space-y-2 rounded-3xl border-2 bg-primary/5 p-5 sm:p-6">
      <h2 className="text-xl font-black">So với lần 1</h2>
      <p>Lần 1: {comparison.first?.feedback?.cefr ?? "Chưa có điểm"} · Lần 2: {comparison.second?.feedback?.cefr ?? "Chưa có điểm"}</p>
      {comparison.delta != null && <p className="font-bold">{Math.round(comparison.delta * 100) === 0 ? "Điểm không đổi" : `${comparison.delta > 0 ? "Tăng" : "Giảm"} ${Math.abs(Math.round(comparison.delta * 100))} điểm`}</p>}
      <p>Đã dùng {comparison.usedSecond.length} từ của bài, trong đó {comparison.newTerms.length} từ chưa dùng ở lần 1{comparison.newTerms.length > 0 && <>: <strong lang="en">{comparison.newTerms.join(", ")}</strong></>}.</p>
    </section>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={retry}>Thử lại</Button>
      <Button type="button" disabled={busy} onClick={advance}>Tiếp tục</Button>
    </div>
  </div>;
}

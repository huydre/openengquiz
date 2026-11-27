import { ArrowRight, Check, Keyboard, Languages, Lightbulb, Mic, RotateCcw, SendHorizontal, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { highlightPhrases, splitQuestion } from "@/lib/courses/course-question";
import type { CourseSpeakingQuestion } from "@/lib/courses/lesson-activities";
import type { FeedbackTone, LessonFeedback, LessonIdea } from "@/lib/courses/lesson-player-types";
import { playTts } from "@/lib/speech/play-tts";
import { lookupResultSchema, type LookupResult } from "@/lib/vocab/lookup-term";

const toneLabels: Record<FeedbackTone, string> = { serious: "Nghiêm túc", friendly: "Thân thiện", funny: "Hài hước" };

function WordMeaning({ term }: { term: string }) {
  const [result, setResult] = useState<LookupResult>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/lookup?term=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Chưa tra được từ.");
        const parsed = lookupResultSchema.safeParse(body.data);
        if (!parsed.success) throw new Error("Phản hồi không hợp lệ.");
        setResult(parsed.data);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Chưa tra được từ.");
      });
    return () => controller.abort();
  }, [term]);
  return <div className="space-y-2">
    {result ? <>
      <p className="font-black" lang="en">{result.term}{result.ipa && <span className="ml-2 font-normal text-muted-foreground">{result.ipa}</span>}</p>
      {result.part_of_speech && <p className="text-sm text-muted-foreground">{result.part_of_speech}</p>}
      {result.definition_vi && <p lang="vi">{result.definition_vi}</p>}
      {result.definition_en && <p lang="en" className="text-sm">{result.definition_en}</p>}
      {result.example_en && <p lang="en" className="text-sm italic">{result.example_en}</p>}
      {result.example_vi && <p lang="vi" className="text-sm">{result.example_vi}</p>}
      {result.synonyms.length > 0 && <p className="text-sm text-muted-foreground">Đồng nghĩa: {result.synonyms.join(", ")}</p>}
    </> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <LogoLoader size="sm" label="Đang tra từ" />}
  </div>;
}

export interface CourseV2SpeakingProps {
  lessonId: string;
  activity: number;
  smallStep: number;
  question: CourseSpeakingQuestion;
  targetTerm?: string;
  targetIpa?: string | null;
  terms: string[];
  speech: boolean;
  ai: boolean;
  busy: boolean;
  tone: FeedbackTone;
  initialAttempt?: { id: string; transcript: string; feedback: LessonFeedback | null } | null;
  onAnswered: (attemptId: string, transcript: string) => void;
  onComplete: () => Promise<void> | void;
  onFeedback: (attemptId: string, tone?: FeedbackTone) => Promise<LessonFeedback | null>;
  getIdeas: () => Promise<LessonIdea[]>;
}

export function CourseV2Speaking({
  lessonId, activity, smallStep, question, targetTerm, targetIpa, terms, speech, ai, busy, tone,
  initialAttempt, onAnswered, onComplete, onFeedback, getIdeas,
}: CourseV2SpeakingProps) {
  const [mode, setMode] = useState<"voice" | "text">(speech ? "voice" : "text");
  const [transcribing, setTranscribing] = useState(false);
  const [sttError, setSttError] = useState("");
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [ideas, setIdeas] = useState<LessonIdea[]>();
  const [showIdeas, setShowIdeas] = useState(false);
  const [showExampleVi, setShowExampleVi] = useState(false);
  const [loading, setLoading] = useState<"ideas" | "translation">();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(initialAttempt?.id ?? null);
  const [transcript, setTranscript] = useState(initialAttempt?.transcript ?? "");
  const [feedback, setFeedback] = useState<LessonFeedback | null>(initialAttempt?.feedback ?? null);
  const [resumeAttemptId] = useState(() => initialAttempt?.feedback ? null : initialAttempt?.id ?? null);
  const [feedbackLoading, setFeedbackLoading] = useState(() => !!initialAttempt && !initialAttempt.feedback && ai);
  const [feedbackError, setFeedbackError] = useState("");
  const pendingWrite = useRef(false);
  const generation = useRef(0);

  // When the browser could not transcribe, ask the server (Groq, then our own Whisper) so the
  // learner sees and can edit the text before submitting.
  async function fillTranscript(audio: Blob) {
    setTranscribing(true);
    setSttError("");
    try {
      const form = new FormData();
      form.set("audio", audio, "recording.wav");
      const response = await fetch("/api/speaking/transcribe", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.text !== "string") throw new Error(body.error ?? "Chưa chép được lời.");
      setAnswer((current) => current.trim() ? current : body.text);
    } catch (cause) {
      setSttError(cause instanceof Error ? cause.message : "Chưa chép được lời.");
    } finally {
      setTranscribing(false);
    }
  }

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
        if (!translation) setTranslation(question.vi);
        setShowTranslation(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tải được gợi ý.");
    } finally { setLoading(undefined); }
  }

  async function submit() {
    if (pendingWrite.current || !answer.trim()) return;
    pendingWrite.current = true;
    const gen = ++generation.current;
    const text = answer.trim();
    setSubmitting(true);
    setError("");
    setFeedbackError("");
    // Show the answer immediately; feedback loads in the background.
    setTranscript(text);
    setAttemptId(null);
    setFeedback(null);
    setFeedbackLoading(true);
    try {
      const response = await fetch(`/api/courses/lessons/${lessonId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", activity, smallStep, transcript: text }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Chưa lưu được câu trả lời.");
      const id = body.attemptId;
      if (typeof id !== "string") throw new Error("Chưa lưu được câu trả lời.");
      if (gen !== generation.current) return;
      setAttemptId(id);
      onAnswered(id, text);
      void onFeedback(id).then((fb) => {
        if (gen === generation.current) setFeedback(fb);
      }).catch((cause) => {
        if (gen === generation.current) setFeedbackError(cause instanceof Error ? cause.message : "Chưa tải được nhận xét.");
      }).finally(() => {
        if (gen === generation.current) setFeedbackLoading(false);
      });
    } catch (cause) {
      if (gen !== generation.current) return;
      setError(cause instanceof Error ? cause.message : "Chưa lưu được câu trả lời.");
      setFeedbackLoading(false);
    } finally {
      pendingWrite.current = false;
      setSubmitting(false);
    }
  }

  async function handleToneChange(value: FeedbackTone) {
    if (!attemptId || pendingWrite.current) return;
    pendingWrite.current = true;
    const gen = generation.current;
    setFeedbackError("");
    try {
      const fb = await onFeedback(attemptId, value);
      if (gen !== generation.current) return;
      setFeedback(fb);
    } catch (cause) {
      if (gen !== generation.current) return;
      setFeedbackError(cause instanceof Error ? cause.message : "Chưa đổi được giọng nhận xét.");
    } finally {
      pendingWrite.current = false;
    }
  }

  function handleRetry() {
    generation.current += 1;
    setAttemptId(null);
    setTranscript("");
    setFeedback(null);
    setAnswer("");
    setRecording(null);
    setError("");
    setFeedbackError("");
    setFeedbackLoading(false);
  }

  // Auto-fetch feedback once when an initial attempt has no stored feedback.
  useEffect(() => {
    if (!resumeAttemptId || !ai) return;
    const gen = generation.current;
    let cancelled = false;
    onFeedback(resumeAttemptId)
      .then((fb) => { if (!cancelled && gen === generation.current) setFeedback(fb); })
      .catch(() => { if (!cancelled && gen === generation.current) setFeedbackError("Chưa tải được nhận xét."); })
      .finally(() => { if (!cancelled && gen === generation.current) setFeedbackLoading(false); });
    return () => { cancelled = true; };
  }, [resumeAttemptId, ai, onFeedback]);

  const canSubmit = !busy && !submitting && !transcribing && (mode === "voice" ? !!recording : !!answer.trim());
  const showFeedback = !!transcript && (submitting || attemptId !== null);
  const canContinue = attemptId !== null && !submitting;

  const iconButton = "text-muted-foreground hover:bg-muted hover:text-foreground grid size-10 place-items-center rounded-full transition-colors aria-pressed:bg-secondary/15 aria-pressed:text-secondary-edge";
  const scores = feedback?.ielts
    ? ([["Tổng", feedback.ielts.overall.toFixed(1)], ["Ngữ pháp", feedback.ielts.grammar.toFixed(1)], ["Từ vựng", feedback.ielts.vocabulary.toFixed(1)], ["Mạch lạc", feedback.ielts.coherence.toFixed(1)]] as const)
    : feedback
      ? ([["Tổng", feedback.cefr], ["Ngữ pháp", feedback.grammarCefr], ["Từ vựng", feedback.vocabularyCefr], ["Mạch lạc", feedback.coherenceCefr]] as const)
      : [];

  return <div className="space-y-4">
    <section className="bg-card space-y-5 rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)] sm:p-7" aria-labelledby="v2-question">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-secondary/10 text-secondary-edge rounded-full px-3 py-1 text-xs font-extrabold">
          {question.part === 1 ? "IELTS Part 1" : "IELTS Part 3"}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className={iconButton} aria-label="Dịch câu hỏi" aria-pressed={showTranslation} disabled={!!loading} onClick={() => void toggleHelp("translation")}>
            <Languages aria-hidden="true" className="size-5" />
          </button>
          <button type="button" className={iconButton} aria-label="Nghe câu hỏi" onClick={() => void playTts(question.en).catch(() => {})}>
            <Volume2 aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 id="v2-question" className="text-2xl leading-snug font-black sm:text-3xl" lang="en">
          {splitQuestion(question.en).map(({ value, term }, index) => term ? (
            <Popover key={index}>
              <PopoverTrigger className="hover:text-primary-edge cursor-pointer rounded-sm underline decoration-muted-foreground/40 decoration-dotted decoration-2 underline-offset-[7px] hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary">
                {value}
              </PopoverTrigger>
              <PopoverContent lang="vi" className="w-72 rounded-2xl"><WordMeaning term={term} /></PopoverContent>
            </Popover>
          ) : value)}
        </h2>
        {showTranslation ? <p className="text-muted-foreground font-semibold">{translation}</p> : null}
        {targetTerm ? (
          <p className="text-muted-foreground text-sm">Hãy thử dùng <strong lang="en" className="text-foreground">{targetTerm}</strong>{targetIpa ? <> - {targetIpa}</> : null} trong câu trả lời</p>
        ) : terms.length > 0 ? (
          <p className="text-muted-foreground text-sm">Thử dùng từ vừa học: <strong lang="en" className="text-foreground">{terms.join(", ")}</strong></p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-bold">
        <button type="button" disabled={!ai || !!loading} aria-expanded={showIdeas} onClick={() => void toggleHelp("ideas")} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline-offset-4 hover:underline aria-expanded:text-secondary-edge">
          <Lightbulb aria-hidden="true" className="size-4" /> Bí ý tưởng?
        </button>
      </div>
      {loading ? <LogoLoader size="sm" label={loading === "ideas" ? "Đang tìm ý tưởng" : "Đang dịch câu hỏi"} /> : null}
      {showIdeas && ideas?.length ? (
        <ul className="bg-accent/10 space-y-1.5 rounded-2xl p-4 text-sm">
          {ideas.map(({ vi, en }) => <li key={en}><span className="font-semibold">{vi}</span> <span lang="en" className="text-muted-foreground">({en})</span></li>)}
        </ul>
      ) : null}
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}

      {!showFeedback ? (
        <div className="space-y-3" aria-label="Câu trả lời">
          {mode === "voice" && !recording ? (
            <>
              <p className="text-muted-foreground text-center text-sm font-bold">Đang nói: <span className="text-foreground">English</span></p>
              <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                <AudioRecorder variant="wide" disabled={busy || submitting} transcribe startLabel="Bắt đầu nói" onRecording={(value) => {
                  setRecording(value);
                  setAnswer(value?.transcript ?? "");
                  if (value && !value.transcript.trim()) void fillTranscript(value.audio);
                }} />
                <Button type="button" size="lg" variant="outline" disabled={busy || submitting} onClick={() => { setMode("text"); setRecording(null); }}>
                  <Keyboard aria-hidden="true" /> Nhập
                </Button>
              </div>
            </>
          ) : (
            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              {speech ? (
                <button type="button" aria-label="Trả lời bằng giọng nói" disabled={busy || submitting} onClick={() => { setMode("voice"); setRecording(null); setAnswer(""); }} className={iconButton}>
                  <Mic aria-hidden="true" className="size-5" />
                </button>
              ) : null}
              <input
                id="v2-answer-input"
                aria-label={recording ? "Bản chép lời, có thể sửa" : "Câu trả lời bằng tiếng Anh"}
                lang="en"
                autoFocus={mode === "text"}
                maxLength={2000}
                value={answer}
                disabled={busy || submitting || transcribing}
                placeholder={transcribing ? "Đang chép lời..." : "Nhập câu trả lời của bạn..."}
                onChange={(event) => setAnswer(event.target.value)}
                className="bg-muted/50 focus-visible:border-primary h-12 min-w-0 flex-1 rounded-2xl border-2 px-4 text-base font-semibold outline-none"
              />
              <button type="submit" aria-label="Gửi câu trả lời" disabled={!canSubmit} className="bg-primary grid size-12 shrink-0 place-items-center rounded-full text-white shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none disabled:opacity-40">
                <SendHorizontal aria-hidden="true" className="size-5" />
              </button>
            </form>
          )}
          {transcribing ? <LogoLoader size="sm" label="Đang chép lời bạn vừa nói..." /> : null}
          {sttError ? <p role="alert" className="text-destructive text-sm font-bold">{sttError}</p> : null}
          {!ai ? <p role="status" className="text-muted-foreground text-center text-sm">Gia sư AI chưa sẵn sàng chấm câu trả lời.</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold">Câu trả lời của bạn</p>
            <span className="bg-primary/10 text-primary-edge inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold">
              {attemptId ? <><Check aria-hidden="true" className="size-3.5" /> Đã gửi</> : "Đang lưu"}
            </span>
          </div>
          <p lang="en" className="bg-primary/10 rounded-2xl rounded-tl-md px-4 py-3 text-base font-semibold whitespace-pre-wrap">{transcript}</p>
          {feedbackLoading ? <LogoLoader size="sm" label="Đang đánh giá câu trả lời..." /> : null}
          {feedbackError ? <p role="alert" className="text-destructive text-sm font-bold">{feedbackError}</p> : null}
        </div>
      )}
    </section>

    {showFeedback && feedback ? <>
      {feedback.used.length > 0 ? (
        <p className="bg-primary/10 text-primary-edge flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold">
          <Check aria-hidden="true" className="size-4 stroke-[3]" /> Đã sử dụng từ trong câu trả lời: <span lang="en">{feedback.used.join(", ")}</span>
        </p>
      ) : null}

      <dl className="grid grid-cols-4 gap-2">
        {scores.map(([label, score], index) => (
          <div key={label} className={index === 0 ? "bg-primary text-primary-foreground rounded-2xl p-3 text-center shadow-[0_4px_0_var(--primary-edge)]" : "bg-card rounded-2xl border-2 p-3 text-center"}>
            <dt className={index === 0 ? "text-xs font-bold opacity-90" : "text-muted-foreground text-xs font-bold"}>{label}</dt>
            <dd className="text-2xl font-black tabular-nums">{score}</dd>
          </div>
        ))}
      </dl>
      {feedback.ielts ? <p className="text-muted-foreground -mt-2 text-xs">Điểm ước lượng để luyện tập, không phải điểm thi IELTS chính thức.</p> : null}

      <section className="bg-card space-y-3 rounded-3xl border-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black">Gợi ý</h3>
          <Select value={tone} disabled={busy} onValueChange={(value) => void handleToneChange(value as FeedbackTone)}>
            <SelectTrigger aria-label="Giọng góp ý" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(toneLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p>{feedback.comment_vi}</p>
        {feedback.corrections.length > 0 ? (
          <ul className="space-y-2">
            {feedback.corrections.map(({ original, replacement, reason }, index) => (
              <li key={index} className="bg-muted/50 space-y-0.5 rounded-2xl p-3">
                <p lang="en"><del className="text-destructive decoration-2">{original}</del> <span aria-hidden="true">→</span> <strong className="text-primary-edge">{replacement}</strong></p>
                <p className="text-muted-foreground text-sm">{reason}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border-secondary/30 bg-secondary/5 space-y-3 rounded-3xl border-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-lg font-black">
            Câu trả lời band cao {feedback.exampleCefr ? <span className="bg-card rounded-full border-2 px-2 py-0.5 text-xs font-black">{feedback.exampleCefr}</span> : null}
          </h3>
          <div className="flex items-center gap-1">
            <button type="button" className={iconButton} aria-label="Nghe câu mẫu" onClick={() => void playTts(feedback.example).catch(() => {})}><Volume2 aria-hidden="true" className="size-5" /></button>
            <button type="button" className={iconButton} aria-label="Dịch câu mẫu" aria-pressed={showExampleVi} onClick={() => setShowExampleVi(!showExampleVi)}><Languages aria-hidden="true" className="size-5" /></button>
          </div>
        </div>
        <p lang="en" className="text-lg leading-relaxed">
          {/* Upgraded words in bold green; other useful expressions get a dotted underline. */}
          {highlightPhrases(feedback.example, [...(feedback.upgrades ?? []), ...terms]).map(({ text, highlighted }, index) => highlighted
            ? <strong key={index} className="text-primary-edge font-extrabold">{text}</strong>
            : highlightPhrases(text, feedback.highlights).map((part, inner) => part.highlighted
              ? <span key={`${index}-${inner}`} className="underline decoration-secondary/60 decoration-dotted decoration-2 underline-offset-4">{part.text}</span>
              : part.text))}
        </p>
        {showExampleVi ? <p className="text-muted-foreground">{feedback.example_vi}</p> : null}
      </section>
    </> : null}

    {showFeedback ? (
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" size="lg" variant="outline" disabled={busy || submitting} onClick={handleRetry}>
          <RotateCcw aria-hidden="true" /> Thử lại
        </Button>
        <Button type="button" size="lg" disabled={!canContinue || busy} onClick={() => void onComplete()}>
          Tiếp tục <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    ) : null}
  </div>;
}

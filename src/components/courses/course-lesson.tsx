"use client";

import { ArrowLeft, ArrowRight, History, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CallSession } from "@/app/(app)/study/[setId]/call/call-session";
import { LogoLoader } from "@/components/layout/logo-loader";
import { TutorNarration } from "@/components/tutor/tutor-narration";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LessonCard } from "@/components/vocab/vocab-lesson";
import { COURSE_CALL_TURNS } from "@/lib/ai/conversation-types";
import type { FeedbackTone, LessonAction, LessonAttempt, LessonCallState, LessonComparison, LessonIdea, LessonStep } from "@/lib/courses/lesson-player-types";
import { narrationLinesSchema, type NarrationKind, type NarrationLine } from "@/lib/courses/narration";
import { CourseFeedbackPanel, CourseQuestion } from "./course-speaking";
import { CoursePronunciation, CourseReviewCards } from "./course-vocabulary";

const labels = ["Gia sư mở đầu", "Nói trước", "Nhận xét lần 1", "Gia sư chuyển đoạn", "Thẻ từ", "Đọc từng từ", "Nói lại và hội thoại"];
export type CoursePlayerProps = {
  course: string;
  lesson: { id: string; title: string; warmup_question: string; set_id: string };
  cards: LessonCard[];
  partNumber: number;
  lessonNumber: number;
  step: LessonStep;
  completed: boolean;
  history: LessonAttempt[];
  first: LessonAttempt | null;
  second: LessonAttempt | null;
  comparison?: LessonComparison | null;
  tone: FeedbackTone;
  weakTerms: string[];
  calling: boolean;
  speech: boolean;
  ai: boolean;
  next?: string;
  resume: LessonCallState | null;
  narration?: NarrationLine[];
};

function LessonNarration({ id, kind, lines: supplied, onComplete }: {
  id: string; kind: NarrationKind; lines?: NarrationLine[]; onComplete: () => void | Promise<void>;
}) {
  const [lines, setLines] = useState(supplied);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (supplied) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/courses/lessons/${id}/narration?kind=${kind}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Chưa tải được lời dẫn.");
        setLines(narrationLinesSchema.parse(data.lines));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa tải được lời dẫn.");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, kind, retry, supplied]);
  if (lines) return <TutorNarration lines={lines} onComplete={onComplete} />;
  return <section className="space-y-4 rounded-3xl border-2 bg-card p-6">
    {error ? <>
      <p role="alert" className="text-destructive">{error}</p>
      <Button type="button" variant="outline" onClick={() => { setError(""); setRetry(retry + 1); }}>Tải lại lời dẫn</Button>
    </> : <LogoLoader label="Đang tải lời dẫn" />}
  </section>;
}

export function CourseLesson(props: CoursePlayerProps) {
  const { course, lesson, cards, partNumber, lessonNumber, step, completed, history, first, second, comparison, tone, weakTerms, calling, speech, ai, next, resume, narration } = props;
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retryIntroDone, setRetryIntroDone] = useState(false);
  const pendingWrite = useRef(false);
  const busy = saving || refreshing;
  const mapHref = `/courses/${course}`;
  const terms = cards.map(({ term }) => term);

  async function request<T>(action: LessonAction, fields: Record<string, unknown> = {}, audio?: Blob): Promise<T> {
    let options: RequestInit;
    if (audio) {
      const form = new FormData();
      form.set("step", String(step));
      form.set("action", action);
      form.set("audio", audio, "recording.wav");
      for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
      options = { method: "POST", body: form };
    } else {
      options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, action, ...fields }) };
    }
    const response = await fetch(`/api/courses/lessons/${lesson.id}`, options);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error ?? "Chưa lưu được bài học. Hãy thử lại.");
    return result as T;
  }

  async function save(action: LessonAction, fields?: Record<string, unknown>, audio?: Blob) {
    if (pendingWrite.current) return;
    pendingWrite.current = true;
    setSaving(true);
    setError("");
    try {
      await request(action, fields, audio);
      startRefresh(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa lưu được tiến độ.");
      throw cause;
    } finally {
      pendingWrite.current = false;
      setSaving(false);
    }
  }

  function act(action: LessonAction, fields?: Record<string, unknown>, audio?: Blob) {
    return save(action, fields, audio).catch(() => {});
  }

  function question(secondAnswer: boolean) {
    return <CourseQuestion key={secondAnswer ? "second" : "first"} question={lesson.warmup_question} second={secondAnswer} terms={secondAnswer ? terms : undefined} voice={speech} ai={ai} busy={busy}
      submit={(transcript, audio) => act("answer", { transcript }, audio)}
      getIdeas={async () => (await request<{ ideas: LessonIdea[] }>("ideas")).ideas}
      getTranslation={async () => (await request<{ translation: string }>("translate")).translation} />;
  }

  function feedback(attempt: LessonAttempt, showComparison: boolean) {
    return <CourseFeedbackPanel key={attempt.id} transcript={attempt.transcript} feedback={attempt.feedback} pronunciation={attempt.pron?.score}
      tone={tone} setTone={(value) => void act("tone", { tone: value })} terms={terms} busy={busy} comparison={showComparison ? comparison : undefined}
      retry={() => void act("retry")} advance={() => void act("advance")} />;
  }

  return <div className="mx-auto max-w-3xl space-y-5 pb-10">
    <header className="space-y-4 rounded-3xl border-2 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href={mapHref} className={buttonVariants({ size: "sm", variant: "outline" })}><ArrowLeft aria-hidden="true" /> Bản đồ</Link>
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="outline" size="sm"><History aria-hidden="true" /> Lịch sử</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl">
            <h2 className="font-black">Lượt nói của bài này</h2>
            {history.length ? <ol className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {history.map((attempt) => <li key={attempt.id} className="space-y-1 rounded-xl border p-2">
                <p className="text-xs text-muted-foreground">{new Date(attempt.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {attempt.feedback?.cefr ?? "Chưa có điểm CEFR"}{attempt.pron?.score != null && ` · Phát âm ${Math.round(attempt.pron.score * 100)}%`}</p>
                <p lang="en" className="whitespace-pre-wrap break-words text-sm">{attempt.transcript}</p>
              </li>)}
            </ol> : <p className="mt-2 text-sm text-muted-foreground">Chưa có lượt trả lời.</p>}
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted-foreground">Phần {partNumber} • Bài {lessonNumber}</p>
          <h1 className="text-3xl font-black" lang="en">{lesson.title}</h1>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-black text-primary tabular-nums">{step} / 7</span>
      </div>
      <div className="space-y-1">
        <progress aria-label="Tiến độ bài học" value={step} max={7} className="block h-2 w-full overflow-hidden rounded-full bg-muted accent-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary" />
        <p className="text-sm font-bold text-muted-foreground">{completed ? "Đã hoàn thành" : labels[step - 1]}</p>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-card p-3 text-destructive">{error}</p>}
    {completed ? <section className="space-y-4 rounded-3xl border-2 bg-card p-6">
      <div className="flex items-center gap-3"><Trophy className="text-primary" aria-hidden="true" /><h2 className="text-2xl font-black">Đã hoàn thành bài học</h2></div>
      <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-primary/5 p-4">
        <div><dt className="text-sm font-bold">Lần 1</dt><dd className="text-xl font-black">{first?.feedback ? `${first.feedback.cefr} · ${Math.round(first.feedback.score * 100)}/100` : "Chưa có"}</dd></div>
        <div><dt className="text-sm font-bold">Lần 2</dt><dd className="text-xl font-black">{second?.feedback ? `${second.feedback.cefr} · ${Math.round(second.feedback.score * 100)}/100` : "Chưa có"}</dd></div>
        <div><dt className="text-sm font-bold">Từ đã học</dt><dd className="text-xl font-black">{cards.length}</dd></div>
      </dl>
      <div><h3 className="font-black">Từ cần luyện thêm</h3>{weakTerms.length ? <p lang="en">{weakTerms.join(", ")}</p> : <p className="text-muted-foreground">Không có từ được đánh dấu.</p>}</div>
      <div className="flex flex-wrap gap-2">
        <Link href={mapHref} className={buttonVariants({ variant: "outline" })}>Về bản đồ</Link>
        {next && <Link href={`/courses/${course}/lessons/${next}`} className={buttonVariants()}>Bài tiếp theo <ArrowRight aria-hidden="true" /></Link>}
      </div>
    </section> : <>
      {step === 1 && <LessonNarration key="intro" id={lesson.id} kind="intro" lines={narration} onComplete={() => save("advance")} />}
      {step === 2 && question(false)}
      {step === 3 && first && feedback(first, false)}
      {step === 4 && <LessonNarration key="transition" id={lesson.id} kind="transition" lines={narration} onComplete={() => save("advance")} />}
      {step === 5 && <CourseReviewCards cards={cards} onComplete={() => save("advance")} />}
      {step === 6 && <CoursePronunciation cards={cards} speech={speech} onComplete={(weakTerms?: string[]) => save("advance", { weakTerms: weakTerms ?? [] })} />}
      {step === 7 && (calling ? <CallSession setId={lesson.set_id} setTitle={lesson.title} aiEnabled={ai} scenarios={[{ id: "course", label: lesson.warmup_question }]}
        maxTurns={COURSE_CALL_TURNS} cardCount={cards.length} resume={resume} onComplete={(threadId) => save("advance", { threadId })} />
        : second ? feedback(second, true) : retryIntroDone ? question(true) : <LessonNarration key="retry" id={lesson.id} kind="retry" lines={narration} onComplete={() => setRetryIntroDone(true)} />)}
    </>}
  </div>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { Button } from "@/components/ui/button";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VocabLesson, type LessonCard } from "@/components/vocab/vocab-lesson";
import { CallSession } from "@/app/(app)/study/[setId]/call/call-session";
import { COURSE_CALL_TURNS, type CallMessage } from "@/lib/ai/conversation-types";
import type { CourseFeedback } from "@/lib/courses/course-feedback";

const labels = ["Nói trước", "Học từ mới", "Nói lại", "Hội thoại thực tế"];
type Comparison = CourseFeedback & { used: string[]; total: number };

export function CourseLesson({ course, lesson, cards, step, completed, comparison, speech, ai, next, resume }: {
  course: string; lesson: { id: string; title: string; warmup_question: string; set_id: string };
  cards: LessonCard[]; step: number; completed: boolean; comparison?: Comparison;
  speech: boolean; ai: boolean; next?: string; resume: { threadId: string; scenario: string; messages: CallMessage[] } | null;
}) {
  const router = useRouter();
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<number>();

  async function advance(body: FormData | number) {
    const response = await fetch(`/api/courses/lessons/${lesson.id}`, body instanceof FormData ? { method: "POST", body }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: body }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error ?? "Chưa lưu được tiến độ.");
    router.refresh();
    return result as { score?: number };
  }

  async function speak() {
    if (!recording || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("step", String(step));
    form.set("audio", recording.audio, "recording.wav");
    form.set("transcript", transcript);
    try { setScore((await advance(form)).score); setRecording(null); setTranscript(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa chấm được bản nói."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-6 pb-8">
    <Link href={`/courses/${course}`} className="font-bold text-primary underline">Về bản đồ khoá học</Link>
    <h1 lang="en" className="text-3xl font-black">{lesson.title}</h1>
    <ol aria-label="Bốn bước bài học" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{labels.map((label, i) => <li key={label} aria-current={!completed && step === i + 1 ? "step" : undefined}
      className={`rounded-xl border-2 p-2 text-sm font-bold ${step === i + 1 && !completed ? "border-primary bg-primary/10" : "bg-card"}`}>
      {i + 1}. {label}{completed || step > i + 1 ? <span className="sr-only"> (đã xong)</span> : null}
    </li>)}</ol>
    {score !== undefined && <p role="status" className="font-bold">Điểm phát âm lượt vừa chấm: {Math.round(score * 100)}/100</p>}
    {comparison && <Collapsible defaultOpen={!completed} className="rounded-3xl border-2 bg-card p-5">
      <CollapsibleTrigger className="text-left font-extrabold underline">So sánh hai lượt nói · {comparison.used.length}/{comparison.total} từ đã dùng</CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
      <p>{comparison.comparison}</p>
      {!!comparison.used.length && <p lang="en">{comparison.used.join(", ")}</p>}
      {comparison.corrections.length > 0 && <ul className="space-y-2">{comparison.corrections.map((item, i) => <li key={i} className="border-l-2 pl-3"><p lang="en"><del>{item.original}</del> <strong>{item.replacement}</strong></p><p>{item.reason}</p></li>)}</ul>}
      <p className="font-bold">Câu trả lời gợi ý</p><p lang="en">{comparison.example}</p>
      </CollapsibleContent>
    </Collapsible>}
    {completed ? <section className="space-y-3 rounded-3xl border-2 bg-card p-5"><h2 className="text-xl font-black">Đã hoàn thành bài học</h2>
      {next && <Link href={`/courses/${course}/lessons/${next}`} className="font-bold text-primary underline">Học bài tiếp theo</Link>}
    </section> : (step === 1 || step === 3) ? <section className="space-y-4 rounded-3xl border-2 bg-card p-5">
      <h2 className="text-xl font-black">{labels[step - 1]}</h2><p lang="en" className="text-lg font-bold">{lesson.warmup_question}</p>
      {step === 3 && <p>Thử dùng từ vừa học: <span lang="en">{cards.map(({ term }) => term).join(", ")}</span>.</p>}
      {!speech || (step === 3 && !ai) ? <p role="status">Dịch vụ chấm nói chưa sẵn sàng.</p> : <>
        <AudioRecorder disabled={busy} transcribe onRecording={(value) => { setRecording(value); setTranscript(value?.transcript ?? ""); }} />
        <label className="block font-bold" htmlFor="course-transcript">Bản chép câu trả lời</label>
        <textarea id="course-transcript" lang="en" rows={3} maxLength={2000} value={transcript} disabled={busy} onChange={(e) => setTranscript(e.target.value)} className="w-full rounded-xl border-2 p-3" />
        <Button type="button" disabled={!recording || busy} onClick={speak}>Chấm và lưu bản nói</Button>
        {busy && <LogoLoader size="sm" label="Đang chấm bản nói" />}
      </>}
    </section> : step === 2 ? <VocabLesson setId={lesson.set_id} title={lesson.title} cards={cards} speechEnabled={speech} onComplete={async () => { await advance(2); }} />
      : <CallSession setId={lesson.set_id} setTitle={lesson.title} aiEnabled={ai} scenarios={[{ id: "course", label: lesson.warmup_question }]}
          maxTurns={COURSE_CALL_TURNS} cardCount={cards.length} resume={resume} onComplete={async () => { await advance(4); }} />}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}

"use client";

import { ArrowLeft, ArrowRight, Check, ChevronDown, Phone, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CallOrb } from "@/app/(app)/study/[setId]/call/call-orb";
import { CallSession } from "@/app/(app)/study/[setId]/call/call-session";
import { LogoLoader } from "@/components/layout/logo-loader";
import { TutorNarration } from "@/components/tutor/tutor-narration";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LessonCard } from "@/components/vocab/vocab-lesson";
import { COURSE_CALL_TURNS } from "@/lib/ai/conversation-types";
import {
  ACTIVITY_COUNT,
  activityDescriptors,
  firstUnfinishedActivity,
  type CourseActivityContent,
  type CourseActivityProgress,
  type CourseGrammarPoint,
} from "@/lib/courses/lesson-activities";
import type {
  FeedbackTone,
  LessonCallState,
  LessonFeedback,
  LessonIdea,
} from "@/lib/courses/lesson-player-types";
import type { NarrationLine } from "@/lib/courses/narration";
import { CourseV2Speaking } from "./course-v2-speaking";
import { CourseV2Vocabulary, vocabStepKind } from "./course-v2-vocabulary";
import { LessonActivityList } from "./lesson-activity-list";
import { useLessonActivities, type ActivityPostFn } from "./use-lesson-activities";

export type CourseActivityAttempt = {
  id: string;
  activity: number;
  smallStep: number;
  transcript: string;
  feedback: LessonFeedback | null;
};

export type CourseActivityLessonProps = {
  course: string;
  lesson: { id: string; title: string; set_id: string; warmup_question: string };
  partNumber: number;
  lessonNumber: number;
  content: CourseActivityContent;
  cards: LessonCard[];
  progress: CourseActivityProgress[];
  attempts: CourseActivityAttempt[];
  initialActivity?: number;
  tone: FeedbackTone;
  speech: boolean;
  ai: boolean;
  next?: string;
  call?: LessonCallState | null;
};

const SPEAKING_ACTIVITIES = [1, 3, 4, 6] as const;
const KIND_LABELS: Record<string, string> = {
  speaking: "Speaking",
  vocabulary: "Review Cards",
  call: "Conversation",
};
/** Label above the activity for each small-step kind of a vocabulary activity. */
const VOCAB_STEP_LABELS: Record<string, string> = {
  review: "Review Cards",
  recall: "Meaning Recall",
  fill: "Fill in the Blank",
  speak: "Speaking",
  shadow: "Listen & Speak",
};

function speakingQuestion(content: CourseActivityContent, activity: number) {
  const slot = SPEAKING_ACTIVITIES.indexOf(activity as (typeof SPEAKING_ACTIVITIES)[number]);
  return slot < 0 ? null : content.speaking[slot];
}

function grammarFor(content: CourseActivityContent, activity: number): CourseGrammarPoint | null {
  return activity === 2 ? content.grammar[0] ?? null : activity === 5 ? content.grammar[1] ?? null : null;
}

function vocabCards(cards: LessonCard[], activity: number): LessonCard[] {
  const offset = activity === 2 ? 0 : 4;
  return cards.slice(offset, offset + 4);
}

function activityTerms(cards: LessonCard[], activity: number): string[] {
  if (activity === 3) return cards.slice(0, 4).map(({ term }) => term);
  if (activity === 6) return cards.slice(4, 8).map(({ term }) => term);
  return [];
}

/** Latest saved attempt for a (activity, smallStep) slot, if any. */
function latestAttempt(attempts: CourseActivityAttempt[], activity: number, smallStep: number) {
  return attempts.find((row) => row.activity === activity && row.smallStep === smallStep) ?? null;
}

function progressFor(progress: CourseActivityProgress[], activity: number) {
  return progress.find((row) => row.activity === activity) ?? null;
}

/** Short bilingual tutor intro for each activity (1-3 lines, English with a matching Vietnamese line). */
function narrationFor(kind: string, activity: number): NarrationLine[] {
  if (kind === "vocabulary") {
    return [
      { en: "Now let's learn four new words and one grammar point.", vi: "Giờ mình học bốn từ mới và một điểm ngữ pháp nhé." },
      { en: "Flip each card, then say the word out loud.", vi: "Lật từng thẻ rồi đọc to từ đó lên." },
    ];
  }
  if (kind === "call") {
    return [
      { en: "Great work! Time for a short call with me.", vi: "Làm tốt lắm! Giờ mình gọi điện ngắn với nhau nhé." },
      { en: "Try to use the words from this lesson.", vi: "Hãy thử dùng các từ của bài này." },
    ];
  }
  if (activity === 3 || activity === 6) {
    return [
      { en: "Let's use the words you just learned.", vi: "Mình dùng ngay những từ bạn vừa học nhé." },
      { en: "Answer the question in your own words.", vi: "Trả lời câu hỏi bằng lời của bạn." },
    ];
  }
  return [
    { en: "Let's start with a speaking question.", vi: "Mình bắt đầu bằng một câu hỏi nói nhé." },
    { en: "You can speak or type your answer.", vi: "Bạn có thể nói hoặc gõ câu trả lời." },
  ];
}

function ActivityNarration({ lines, onDone }: { lines: NarrationLine[]; onDone: () => void }) {
  const [finished, setFinished] = useState(false);
  if (finished) return null;
  return <TutorNarration lines={lines} initialSpeed={0.9} onComplete={() => { setFinished(true); onDone(); }} />;
}

export function CourseActivityLesson(props: CourseActivityLessonProps) {
  const { course, lesson, partNumber, lessonNumber, content, cards, progress: initialProgress, attempts: initialAttempts, initialActivity, tone, speech, ai, next, call } = props;
  const { post, busy, error, clearError } = useLessonActivities(lesson.id);
  const descriptors = useMemo(() => activityDescriptors(content), [content]);
  const [progress, setProgress] = useState<CourseActivityProgress[]>(initialProgress);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [selected, setSelected] = useState<number>(() => {
    if (initialActivity && initialActivity >= 1 && initialActivity <= ACTIVITY_COUNT) return initialActivity;
    return firstUnfinishedActivity(initialProgress) ?? ACTIVITY_COUNT;
  });
  const [introDone, setIntroDone] = useState<Record<number, boolean>>({});
  const [callPhase, setCallPhase] = useState<"idle" | "starting" | "ready">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const loadFeedback = useCallback(async (attemptId: string, nextTone?: FeedbackTone) => {
    const result = await post<{ feedback: LessonFeedback | null }>("feedback", selected, 1, { attemptId, ...(nextTone ? { tone: nextTone } : {}) });
    setAttempts((rows) => rows.map((row) => row.id === attemptId ? { ...row, feedback: result.feedback } : row));
    return result.feedback;
  }, [post, selected]);

  const descriptor = descriptors.find((row) => row.activity === selected) ?? descriptors[0];
  const row = progressFor(progress, selected);
  const completed = row?.completed_at != null;
  const smallStep = row?.small_step ?? 1;
  const state = (row?.state ?? null) as Record<string, unknown> | null;
  const callLaunched = state?.callLaunched === true;

  const doneCount = progress.filter((entry) => entry.completed_at).length;
  const mapHref = `/courses/${course}`;

  const mergeProgress = useCallback((result: unknown) => {
    const saved = (result as { progress?: CourseActivityProgress } | null)?.progress;
    if (!saved || typeof saved.activity !== "number") return;
    setProgress((rows) => {
      const rest = rows.filter((entry) => entry.activity !== saved.activity);
      return [...rest, { ...saved, lesson_id: saved.lesson_id ?? lesson.id }];
    });
  }, [lesson.id]);

  const trackedPost = useCallback<ActivityPostFn>(async <T,>(action: string, activity: number, step: number, fields?: Record<string, unknown>, audio?: Blob): Promise<T> => {
    const result = await post<T>(action, activity, step, fields, audio);
    if (action === "checkpoint" || action === "complete" || action === "start_call") {
      mergeProgress(result);
    }
    return result;
  }, [post, mergeProgress]);

  function select(activity: number) {
    if (activity === selected) return;
    clearError();
    setSelected(activity);
    // Keep the address in step so a reload or shared link opens the same activity.
    const url = new URL(window.location.href);
    url.searchParams.set("activity", String(activity));
    window.history.replaceState(window.history.state, "", url);
  }

  async function completeActivity(activity: number, step: number, threadId?: string) {
    await trackedPost("complete", activity, step, threadId ? { threadId } : {});
  }

  async function startCall() {
    setCallPhase("starting");
    try {
      await trackedPost("start_call", selected, 1);
      setCallPhase("ready");
    } catch {
      setCallPhase("idle");
    }
  }

  function renderActivity() {
    if (descriptor.kind === "speaking") {
      const question = speakingQuestion(content, selected);
      if (!question) return <p className="text-muted-foreground">Chưa có câu hỏi cho hoạt động này.</p>;
      const saved = latestAttempt(attempts, selected, 1);
      return (
        <CourseV2Speaking
          key={selected}
          lessonId={lesson.id}
          activity={selected}
          smallStep={1}
          question={question}
          terms={activityTerms(cards, selected)}
          speech={speech}
          ai={ai}
          busy={busy}
          tone={tone}
          initialAttempt={saved ? { id: saved.id, transcript: saved.transcript, feedback: saved.feedback } : null}
          onAnswered={(id, transcript) => setAttempts((rows) => [
            { id, activity: selected, smallStep: 1, transcript, feedback: null },
            ...rows.filter((entry) => entry.activity !== selected || entry.smallStep !== 1),
          ])}
          onComplete={() => void completeActivity(selected, 1).catch(() => {})}
          onFeedback={loadFeedback}
          getIdeas={async () => {
            const result = await post<{ ideas: LessonIdea[] }>("ideas", selected, 1);
            return result.ideas;
          }}
        />
      );
    }

    if (descriptor.kind === "vocabulary") {
      const activity = selected as 2 | 5;
      const group = activity === 2 ? "A" : "B";
      return (
        <CourseV2Vocabulary
          key={selected}
          lessonId={lesson.id}
          activity={activity}
          group={group}
          cards={vocabCards(cards, activity)}
          grammar={grammarFor(content, activity)}
          speech={speech}
          ai={ai}
          tone={tone}
          initialStep={smallStep}
          initialState={state}
          busy={busy}
          post={trackedPost}
        />
      );
    }

    // Activity 7: AI call. Mount CallSession only after this session's
    // start_call persisted (callPhase ready) or a prior launch left both the
    // progress flag and a resumable thread.
    const scenarioLabel = content.conversation || lesson.warmup_question;
    const canResume = callPhase === "ready" || (callLaunched && call != null);
    if (!canResume) {
      const starting = callPhase === "starting";
      return (
        <section className="from-sidebar-accent/70 to-card flex flex-col items-center gap-5 rounded-3xl border-2 bg-gradient-to-b p-8 text-center">
          <CallOrb mode={starting ? "thinking" : "idle"} level={0} onTap={() => void startCall()} disabled={busy || !ai || starting} label="Bắt đầu cuộc gọi" />
          <div className="space-y-1">
            <h2 className="text-2xl font-black">{starting ? "Đang kết nối với gia sư..." : "Gọi điện với gia sư"}</h2>
            <p className="text-muted-foreground mx-auto max-w-md font-semibold">{scenarioLabel}</p>
          </div>
          <Button type="button" size="lg" disabled={busy || !ai || starting} onClick={() => void startCall()}>
            <Phone aria-hidden="true" /> Bắt đầu cuộc gọi
          </Button>
          {!ai ? <p className="text-muted-foreground text-sm">AI chưa được bật.</p> : null}
        </section>
      );
    }
    const resume = callLaunched && call
      ? { threadId: call.threadId, scenario: call.scenario, messages: call.messages, finished: call.finished }
      : null;
    return (
      <CallSession
        setId={lesson.set_id}
        setTitle={lesson.title}
        aiEnabled={ai}
        scenarios={[{ id: "course", label: scenarioLabel }]}
        maxTurns={COURSE_CALL_TURNS}
        cardCount={cards.length}
        resume={resume}
        autoStart={callPhase === "ready" && !resume}
        onComplete={async (threadId) => { await completeActivity(selected, 1, threadId); }}
      />
    );
  }

  const introLines = narrationFor(descriptor.kind, selected);
  // The tutor intro plays once per activity; an activity already under way resumes directly.
  const started = (row != null && (row.small_step > 1 || Object.keys(state ?? {}).length > 0))
    || attempts.some((entry) => entry.activity === selected);
  const showIntro = !introDone[selected] && !completed && !started;
  const doneSet = new Set(progress.filter((entry) => entry.completed_at).map((entry) => entry.activity));
  const nextActivity = firstUnfinishedActivity(progress);
  const nextDescriptor = nextActivity ? descriptors.find((entry) => entry.activity === nextActivity) : undefined;
  const stepLabel = descriptor.kind === "vocabulary" ? VOCAB_STEP_LABELS[vocabStepKind(smallStep) ?? "review"] : KIND_LABELS[descriptor.kind];
  const stepDone = completed ? descriptor.smallSteps : descriptor.kind === "vocabulary" ? smallStep - 1 : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href={mapHref} aria-label="Về bản đồ khoá học" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeft />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 lang="en" className="truncate text-lg font-black sm:text-xl">{lesson.title}</h1>
            <p className="text-muted-foreground text-xs font-bold">Phần {partNumber} • Bài {lessonNumber}</p>
          </div>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger
              aria-label="Chọn hoạt động"
              className="bg-card hover:bg-muted inline-flex items-center gap-1 rounded-full border-2 px-3 py-1.5 text-sm font-black tabular-nums"
            >
              {selected} / {ACTIVITY_COUNT} <ChevronDown aria-hidden="true" className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,24rem)] rounded-3xl p-3">
              <p className="px-1 pb-2 text-sm font-extrabold">Các hoạt động trong bài</p>
              <LessonActivityList
                descriptors={descriptors}
                doneActivities={doneSet}
                current={selected}
                onSelect={(activity) => { setMenuOpen(false); select(activity); }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Bar value={doneCount} max={ACTIVITY_COUNT} label="Tiến độ bài học" />
      </header>

      {error ? (
        <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-2xl border-2 px-4 py-2.5 text-sm font-bold">
          {error}
        </p>
      ) : null}

      {doneCount === ACTIVITY_COUNT ? (
        <section className="from-primary/15 to-card flex flex-col items-center gap-4 rounded-3xl border-2 bg-gradient-to-b p-8 text-center">
          <span className="bg-accent text-accent-foreground grid size-20 place-items-center rounded-3xl shadow-[0_6px_0_var(--accent-edge)]">
            <Trophy aria-hidden="true" className="size-10" />
          </span>
          <div className="space-y-1">
            <h2 className="text-2xl font-black">Hoàn thành bài học!</h2>
            <p className="text-muted-foreground font-semibold">Bạn đã xong cả 7 hoạt động của bài <span lang="en" className="text-foreground">{lesson.title}</span>.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={mapHref} className={buttonVariants({ variant: "outline", size: "lg" })}>Về bản đồ</Link>
            {next ? (
              <Link href={`/courses/${course}/lessons/${next}`} className={buttonVariants({ size: "lg" })}>
                Bài tiếp theo <ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-4" aria-label={descriptor.titleVi}>
          {/* During the tutor intro only the lesson header shows, as in the reference flow. */}
          <div className={cn("space-y-2", showIntro && "hidden")}>
            <div className="flex items-center justify-between gap-2">
              <span className="bg-card rounded-full border-2 px-3 py-0.5 text-sm font-extrabold">{stepLabel}</span>
              {descriptor.smallSteps > 1 ? (
                <span className="text-muted-foreground text-sm font-bold tabular-nums">{Math.min(smallStep, descriptor.smallSteps)} / {descriptor.smallSteps}</span>
              ) : null}
            </div>
            {descriptor.smallSteps > 1 ? <Bar value={stepDone} max={descriptor.smallSteps} label="Tiến độ hoạt động" thin /> : null}
          </div>
          {busy ? <LogoLoader size="sm" label="Đang lưu tiến độ" /> : null}
          {completed ? (
            <div className="bg-card flex flex-col items-center gap-3 rounded-3xl border-2 p-8 text-center">
              <span className="bg-primary text-primary-foreground grid size-14 place-items-center rounded-2xl shadow-[0_4px_0_var(--primary-edge)]">
                <Check aria-hidden="true" className="size-7 stroke-[3]" />
              </span>
              <h2 className="text-xl font-black">Đã xong hoạt động này</h2>
              {nextDescriptor ? (
                <>
                  <p className="text-muted-foreground font-semibold">Tiếp theo: {nextDescriptor.titleVi}</p>
                  <Button size="lg" onClick={() => select(nextDescriptor.activity)}>
                    Tiếp tục <ArrowRight aria-hidden="true" />
                  </Button>
                </>
              ) : null}
            </div>
          ) : showIntro ? (
            <ActivityNarration key={selected} lines={introLines} onDone={() => setIntroDone((map) => ({ ...map, [selected]: true }))} />
          ) : (
            renderActivity()
          )}
        </section>
      )}
    </div>
  );
}

function Bar({ value, max, label, thin }: { value: number; max: number; label: string; thin?: boolean }) {
  const percent = max ? Math.round((Math.max(0, Math.min(value, max)) / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("bg-muted w-full overflow-hidden rounded-full", thin ? "h-1.5" : "h-2.5")}
    >
      <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

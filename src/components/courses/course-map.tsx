"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, ChevronDown, Lock, Target, Volume2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LessonActivityList } from "./lesson-activity-list";
import { activityDescriptors, courseActivityContentSchema, firstUnfinishedActivity, type CourseActivityProgress } from "@/lib/courses/lesson-activities";
import { playTts } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";
import { lessonIcon } from "./lesson-icons";
import { Ipa } from "@/components/vocab/ipa-text";

export type CourseLevel = { id: string; title: string; words_target: number; summary: string; entry: string; outcome: string; method: string };
export type CoursePart = { id: string; title: string; course_lessons: { id: string; title: string; icon: string; activity_content?: unknown }[] };
export type NotebookCard = { id: string; term: string; ipa: string | null; definition_vi: string | null; score: number | null };

/** Sine-like wave (fraction of the maximum swing) that continues across parts. */
const WAVE = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6];
const ROW_HEIGHT = 140;
/** Icon bubble colours cycle through the brand palette so neighbouring lessons look distinct. */
const BUBBLES = [
  "bg-primary/15 text-primary",
  "bg-secondary/15 text-secondary",
  "bg-brand-orange/20 text-brand-orange",
  "bg-brand-grape/15 text-brand-grape",
];

type Panel = "levels" | "goals" | "words";

export function CourseMap({ course, courses, level, levels, parts, completed, next, notebook, activityByLesson }: {
  course: string;
  courses: { slug: string; title: string }[];
  level: CourseLevel;
  levels: CourseLevel[];
  parts: CoursePart[];
  completed: string[];
  next?: string;
  notebook: NotebookCard[];
  activityByLesson: Map<string, CourseActivityProgress[]>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("levels");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = parts.reduce((n, p) => n + p.course_lessons.length, 0);
  const percent = total ? Math.round((completed.length * 100) / total) : 0;
  const courseTitle = courses.find((row) => row.slug === course)?.title ?? course;

  function show(value: Panel) {
    setError("");
    setPanel(value);
    setOpen(true);
  }

  async function choose(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/courses/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: id }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Chưa lưu được cấp độ. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <header className="bg-card space-y-5 rounded-3xl border-2 p-6 shadow-[0_4px_0_var(--border)]">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={course} onValueChange={(slug) => router.push(`/courses/${slug}`)}>
            <SelectTrigger aria-label="Chọn khoá học"><SelectValue /></SelectTrigger>
            <SelectContent>
              {courses.map((row) => <SelectItem key={row.slug} value={row.slug}>{row.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => show("levels")}
            className="flex h-11 items-center gap-2 rounded-2xl border-2 px-4 text-sm font-extrabold shadow-[0_2px_0_var(--border)] hover:bg-muted"
          >
            {level.title}
            <ChevronDown aria-hidden="true" className="text-muted-foreground size-4" />
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-black">{courseTitle} · {level.title}</h1>
          <p className="text-muted-foreground">{level.summary}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm font-bold">
            <span>{completed.length}/{total} bài hoàn thành</span>
            <span className="text-primary">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Tiến độ cấp độ"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="bg-muted h-3 overflow-hidden rounded-full"
          >
            <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => show("goals")}>
            <Target aria-hidden="true" /> Mục tiêu khoá học
          </Button>
          <Button type="button" variant="outline" onClick={() => show("words")}>
            <BookOpen aria-hidden="true" /> Sổ từ vựng
          </Button>
        </div>
      </header>

      {parts.map((part, partIndex) => (
        <section key={part.id} aria-labelledby={`part-${part.id}`} className="space-y-6">
          <header className="flex items-center gap-4 text-center">
            <span aria-hidden="true" className="bg-border h-0.5 flex-1 rounded-full" />
            <span>
              <span className="text-muted-foreground block text-xs font-black tracking-widest">PART {partIndex + 1}</span>
              <h2 id={`part-${part.id}`} lang="en" className="text-xl font-black">{part.title}</h2>
            </span>
            <span aria-hidden="true" className="bg-border h-0.5 flex-1 rounded-full" />
          </header>

          <LessonTrail
            course={course}
            lessons={part.course_lessons}
            completed={completed}
            next={next}
            activityByLesson={activityByLesson}
            colorOffset={partIndex}
            waveOffset={parts.slice(0, partIndex).reduce((n, p) => n + p.course_lessons.length, 0)}
          />
        </section>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="bg-card max-h-[85vh] overflow-auto rounded-3xl border-2 sm:max-w-xl">
          <DialogTitle className="pr-8 text-xl font-black">
            {panel === "levels" ? "Chọn cấp độ" : panel === "goals" ? "Mục tiêu khoá học" : "Sổ từ vựng"}
          </DialogTitle>

          {panel === "levels" && (
            <ul className="space-y-2">
              {levels.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-current={row.id === level.id}
                    disabled={busy}
                    onClick={() => void choose(row.id)}
                    className={cn(
                      "w-full rounded-2xl border-2 p-3 text-left hover:border-primary focus-visible:outline-2",
                      row.id === level.id && "border-primary bg-primary/10",
                    )}
                  >
                    <span className="flex justify-between font-extrabold">
                      {row.title}
                      {row.id === level.id && <Check className="text-primary size-5" aria-hidden />}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {row.words_target} từ · 6 phần · 30 bài · {row.summary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {panel === "goals" && (
            <div className="space-y-4">
              <p className="font-extrabold">{level.title} · {level.words_target} từ · {total} bài</p>
              <dl className="space-y-3">
                {[["Đầu vào", level.entry], ["Đầu ra", level.outcome], ["Phương pháp", level.method]].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground text-xs font-black tracking-widest uppercase">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t-2 pt-3 text-sm font-bold">
                {parts.length} phần · {total} bài học · {level.words_target} từ vựng
              </p>
            </div>
          )}

          {panel === "words" && (notebook.length ? (
            <ul className="divide-y">
              {notebook.map((word) => (
                <li key={word.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <strong lang="en">{word.term}</strong> <span className="text-muted-foreground"><Ipa value={word.ipa} /></span>
                    <p className="text-muted-foreground text-sm">
                      {word.definition_vi}
                      {word.score !== null ? ` · Phát âm ${Math.round(word.score * 100)}/100` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Nghe ${word.term}`}
                    onClick={() => { void playTts(word.term).catch(() => setError("Chưa phát được âm thanh.")); }}
                  >
                    <Volume2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Chưa có từ đã học trong khoá này.</p>
          ))}

          {error && <p role="alert" className="text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Lessons laid out along an S-curve with a dashed connector drawn through their centres.
 * Completed segments of the connector are green; the current lesson is raised and labelled.
 */
function LessonTrail({ course, lessons, completed, next, colorOffset, waveOffset, activityByLesson }: {
  course: string;
  lessons: CoursePart["course_lessons"];
  completed: string[];
  next?: string;
  colorOffset: number;
  waveOffset: number;
  activityByLesson: Map<string, CourseActivityProgress[]>;
}) {
  const { ref: trackRef, percent: swing } = useSwing();
  const points = lessons.map((_, i) => ({
    x: 50 + WAVE[(i + waveOffset) % WAVE.length] * swing,
    y: i * ROW_HEIGHT + ROW_HEIGHT / 2,
  }));
  const height = lessons.length * ROW_HEIGHT;

  return (
    <ol ref={trackRef} className="relative mx-auto max-w-2xl" style={{ height }}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {points.slice(1).map((point, i) => {
          const from = points[i];
          const bend = (point.y - from.y) * 0.75;
          const done = completed.includes(lessons[i].id);
          return (
            <path
              key={i}
              d={`M ${from.x} ${from.y} C ${from.x} ${from.y + bend}, ${point.x} ${point.y - bend}, ${point.x} ${point.y}`}
              fill="none"
              strokeWidth={3}
              strokeDasharray="6 8"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={done ? "stroke-primary" : "stroke-border"}
            />
          );
        })}
      </svg>

      {lessons.map((lesson, i) => {
        const done = completed.includes(lesson.id);
        const active = next === lesson.id;
        const locked = !done && !active;
        const Icon = lessonIcon(lesson.icon);
        const status = done ? "Đã hoàn thành" : active ? "Học tiếp" : "Chưa mở";
        const content = courseActivityContentSchema.safeParse(lesson.activity_content);
        const progress = activityByLesson.get(lesson.id) ?? [];
        const doneCount = progress.filter((row) => row.completed_at).length;
        const href = `/courses/${course}/lessons/${lesson.id}`;

        const card = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "relative grid size-12 shrink-0 place-items-center rounded-full",
                locked ? "bg-muted text-muted-foreground" : BUBBLES[(i + colorOffset) % BUBBLES.length],
              )}
            >
              {content.success && <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90 text-primary" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="24" cy="24" r="22" className="opacity-15" />
                <circle cx="24" cy="24" r="22" pathLength="7" strokeDasharray={`${doneCount} 7`} />
              </svg>}
              <Icon className="size-6" />
              {done ? (
                <span className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-card">
                  <Check className="size-3" />
                </span>
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span lang="en" className={cn("line-clamp-2 block leading-tight font-extrabold", locked && "text-muted-foreground")}>{lesson.title}</span>
              <span className="text-muted-foreground block text-xs font-bold">
                {content.success && active && doneCount > 0 ? `${doneCount}/7 hoạt động` : status}
              </span>
            </span>
            {locked ? <Lock aria-hidden="true" className="text-muted-foreground size-4 shrink-0" /> : null}
            {active ? (
              <span className="bg-primary text-primary-foreground hidden rounded-full px-2.5 py-1 text-[10px] font-black uppercase sm:inline">
                {completed.length || doneCount ? "Tiếp" : "Bắt đầu"}
              </span>
            ) : null}
          </>
        );

        const className = cn(
          "absolute flex w-52 -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-3xl border-2 bg-card p-3 pr-4 text-sm transition-transform sm:w-60",
          active && "border-primary bg-sidebar-accent shadow-[0_4px_0_var(--primary-edge)] hover:-translate-y-[calc(50%+2px)]",
          done && "shadow-[0_3px_0_var(--border)] hover:-translate-y-[calc(50%+2px)]",
          locked && "text-muted-foreground",
        );
        const style = { left: `${points[i].x}%`, top: points[i].y };

        return (
          <li key={lesson.id}>
            {locked ? (
              <div className={className} style={style}>{card}</div>
            ) : content.success ? (
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className={cn(className, "text-left")} style={style} aria-current={active ? "step" : undefined}>
                    {card}
                  </button>
                </DialogTrigger>
                <DialogContent aria-describedby={undefined} className="bg-card max-h-[88vh] overflow-auto rounded-3xl border-2 sm:max-w-md [&>*]:min-w-0">
                  <div className="flex items-center gap-3 pr-8">
                    <span aria-hidden="true" className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", BUBBLES[(i + colorOffset) % BUBBLES.length])}>
                      <Icon className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <DialogTitle lang="en" className="text-xl leading-tight font-black">{lesson.title}</DialogTitle>
                      <p className="text-muted-foreground text-sm font-bold">{doneCount}/7 hoạt động đã xong</p>
                    </div>
                  </div>
                  <LessonActivityList
                    descriptors={activityDescriptors(content.data)}
                    doneActivities={new Set(progress.filter((row) => row.completed_at).map((row) => row.activity))}
                    hrefFor={(activity) => `${href}?activity=${activity}`}
                  />
                  <Link
                    href={`${href}?activity=${firstUnfinishedActivity(progress) ?? 1}`}
                    className={buttonVariants({ size: "lg", className: "w-full" })}
                  >
                    {done ? "Học lại" : doneCount ? "Tiếp tục" : "Bắt đầu"}
                  </Link>
                </DialogContent>
              </Dialog>
            ) : (
              <Link
                href={href}
                aria-current={active ? "step" : undefined}
                aria-label={`${lesson.title}, ${status}`}
                className={className}
                style={style}
              >
                {card}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Largest horizontal swing (in % of the track) that keeps cards inside the track:
 * half the track minus half a card (104px mobile, 120px from sm) and a small margin.
 */
function useSwing() {
  const ref = useRef<HTMLOListElement>(null);
  const [percent, setPercent] = useState(28);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (!width) return;
      const halfCard = width >= 576 ? 120 : 104;
      setPercent(Math.max(0, Math.min(30, ((width / 2 - halfCard - 8) / width) * 100)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, percent };
}

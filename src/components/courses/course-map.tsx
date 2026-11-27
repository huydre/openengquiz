"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Coffee, Home, Lock, MapPin, Sparkles, Sun, Users, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playTts } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";

const icons = { book: BookOpen, cup: Coffee, home: Home, map: MapPin, spark: Sparkles, sun: Sun, users: Users };
export type CourseLevel = { id: string; title: string; words_target: number; summary: string; entry: string; outcome: string; method: string };
export type CoursePart = { id: string; title: string; course_lessons: { id: string; title: string; icon: string }[] };
export type NotebookCard = { id: string; term: string; ipa: string | null; definition_vi: string | null; score: number | null };

export function CourseMap({ course, courses, level, levels, parts, completed, next, notebook }: {
  course: string; courses: { slug: string; title: string }[]; level: CourseLevel; levels: CourseLevel[];
  parts: CoursePart[]; completed: string[]; next?: string; notebook: NotebookCard[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"levels" | "goals" | "words">("levels");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = parts.reduce((n, p) => n + p.course_lessons.length, 0);

  function show(value: typeof panel) {
    setError("");
    setPanel(value);
    setOpen(true);
  }

  async function choose(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/courses/choice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: id }) });
      if (!res.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch { setError("Chưa lưu được cấp độ. Hãy thử lại."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-8 pb-12">
    <header className="space-y-4 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1"><label htmlFor="course-picker" className="block text-sm font-bold">Khoá học</label>
          <Select value={course} onValueChange={(slug) => router.push(`/courses/${slug}`)}>
            <SelectTrigger id="course-picker"><SelectValue /></SelectTrigger>
            <SelectContent>{courses.map((row) => <SelectItem key={row.slug} value={row.slug}>{row.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => show("levels")}>Cấp độ: {level.title}</Button>
      </div>
      <p className="text-muted-foreground">{level.summary}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => show("goals")}>Mục tiêu khoá học</Button>
        <Button type="button" variant="outline" onClick={() => show("words")}>Sổ từ vựng</Button>
      </div>
      <p className="text-sm font-bold">{completed.length}/{total} bài đã hoàn thành</p>
      <Progress aria-label="Tiến độ cấp độ" value={total ? completed.length * 100 / total : 0} />
    </header>
    {parts.map((part, index) => <section key={part.id} className="space-y-4">
      <header className="flex items-center gap-4 pt-4 text-center">
            <span aria-hidden="true" className="bg-border h-0.5 flex-1 rounded-full" />
            <span>
              <p className="text-muted-foreground text-xs font-black tracking-widest">PART {index + 1}</p>
              <h2 className="text-xl font-black">{part.title}</h2>
            </span>
            <span aria-hidden="true" className="bg-border h-0.5 flex-1 rounded-full" />
          </header>
      <ol className="relative mx-auto grid max-w-xl gap-5 before:absolute before:inset-y-4 before:left-5 before:border-l-2 before:border-dashed before:border-primary/40 sm:before:left-1/2">
        {part.course_lessons.map((lesson, n) => {
          const done = completed.includes(lesson.id);
          const active = next === lesson.id;
          const Icon = icons[lesson.icon as keyof typeof icons] ?? BookOpen;
          const cls = cn("relative flex min-h-20 w-full items-center gap-3 rounded-3xl border-2 bg-card p-4 text-sm font-extrabold sm:w-[53%]", n % 2 ? "sm:ml-auto" : "sm:mr-auto", active ? "border-primary bg-primary/10 shadow-[0_4px_0_var(--primary-edge)]" : "shadow-[0_3px_0_var(--border)]");
          const text = <><Icon className="size-6 shrink-0 text-primary" aria-hidden /><span><span lang="en">{lesson.title}</span><span className="block text-xs text-muted-foreground">{done ? "Đã hoàn thành" : active ? "Học tiếp" : "Đã khoá"}</span></span>{done ? <Check className="ml-auto size-4 shrink-0" aria-hidden /> : !active && <Lock className="ml-auto size-4 shrink-0" aria-hidden />}</>;
          return <li key={lesson.id}>{done || active ? <Link aria-current={active ? "step" : undefined} href={`/courses/${course}/lessons/${lesson.id}`} className={cls}>{text}</Link> : <div className={cn(cls, "opacity-65")}>{text}</div>}</li>;
        })}
      </ol>
    </section>)}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-auto rounded-3xl border-2 bg-card sm:max-w-xl">
      <DialogTitle className="pr-8 text-xl font-black">{panel === "levels" ? "Chọn cấp độ" : panel === "goals" ? "Mục tiêu khoá học" : "Sổ từ vựng"}</DialogTitle>
      {panel === "levels" && <ul className="space-y-2">{levels.map((row) => <li key={row.id}>
        <button type="button" aria-current={row.id === level.id} disabled={busy} onClick={() => void choose(row.id)} className="w-full rounded-2xl border-2 p-3 text-left hover:border-primary focus-visible:outline-2">
          <span className="flex justify-between font-extrabold">{row.title}{row.id === level.id && <Check className="size-5" aria-hidden />}</span>
          <span className="text-sm text-muted-foreground">{row.words_target} từ · 6 phần · 30 bài · {row.summary}</span>
        </button>
      </li>)}</ul>}
      {panel === "goals" && <div className="space-y-4"><h3 className="font-extrabold">{level.title} · {level.words_target} từ · {total} bài</h3>
        <dl className="space-y-3">{[["Đầu vào", level.entry], ["Đầu ra", level.outcome], ["Phương pháp", level.method]].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="text-muted-foreground">{value}</dd></div>)}</dl>
        <p className="border-t pt-3 text-sm font-bold">{parts.length} phần · {total} bài học · {level.words_target} từ vựng</p></div>}
      {panel === "words" && (notebook.length ? <ul className="divide-y">{notebook.map((word) => <li key={word.id} className="flex items-center justify-between gap-3 py-2"><div><strong lang="en">{word.term}</strong> <span>{word.ipa}</span><p className="text-sm text-muted-foreground">{word.definition_vi}{word.score !== null ? ` · Phát âm ${Math.round(word.score * 100)}/100` : ""}</p></div>
        <Button type="button" size="icon" variant="ghost" aria-label={`Nghe ${word.term}`} onClick={() => { void playTts(word.term).catch(() => setError("Chưa phát được âm thanh.")); }}><Volume2 /></Button></li>)}</ul> : <p>Chưa có từ đã học trong khoá này.</p>)}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  </div>;
}

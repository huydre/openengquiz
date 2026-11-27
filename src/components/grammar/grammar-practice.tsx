"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button, buttonVariants } from "@/components/ui/button";
import type { GrammarGrade, GrammarMode } from "@/lib/ai/grammar";

export type WrongAttempt = {
  id: string;
  mode: string;
  prompt: string;
  reference: string;
  answer: string;
  score: number;
  created_at: string;
};

type ExerciseState =
  | { kind: "translate"; prompt_vi: string; reference_en: string; used_terms: string[] }
  | { kind: "fix"; wrong_en: string; hint_vi: string; reference_en: string; target_terms: string[] };

type GradeState = GrammarGrade & { saved: boolean };

const panel = "space-y-4 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]";
const area = "w-full rounded-2xl border-2 bg-background p-3 focus-visible:outline-2 focus-visible:outline-ring";

async function post<T>(body: object): Promise<T> {
  const response = await fetch("/api/ai/grammar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Yêu cầu chưa thành công. Hãy thử lại.");
  return data;
}

function exercisePrompt(exercise: ExerciseState): string {
  return exercise.kind === "translate" ? exercise.prompt_vi : exercise.wrong_en;
}

export function GrammarPractice({
  setId,
  setTitle,
  terms,
  wrongAttempts,
  aiEnabled,
}: {
  setId: string;
  setTitle: string;
  terms: { id: string; term: string; definition_vi: string | null }[];
  wrongAttempts: WrongAttempt[];
  aiEnabled: boolean;
}) {
  const [mode, setMode] = useState<GrammarMode>("translate");
  const [exercise, setExercise] = useState<ExerciseState>();
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<GradeState>();
  const [busy, setBusy] = useState<"exercise" | "grade">();
  const [error, setError] = useState("");

  function reset() {
    setExercise(undefined);
    setAnswer("");
    setGrade(undefined);
    setError("");
  }

  async function loadExercise(nextMode: GrammarMode = mode) {
    setBusy("exercise");
    setError("");
    try {
      const data = await post<{ exercise: ExerciseState }>({ action: "exercise", setId, mode: nextMode });
      setExercise(data.exercise);
      setAnswer("");
      setGrade(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được bài tập.");
    } finally {
      setBusy(undefined);
    }
  }

  function retryAttempt(attempt: WrongAttempt) {
    const nextMode: GrammarMode = attempt.mode === "fix" ? "fix" : "translate";
    setMode(nextMode);
    setExercise(nextMode === "fix"
      ? { kind: "fix", wrong_en: attempt.prompt, hint_vi: "", reference_en: attempt.reference, target_terms: [] }
      : { kind: "translate", prompt_vi: attempt.prompt, reference_en: attempt.reference, used_terms: [] });
    setAnswer("");
    setGrade(undefined);
    setError("");
  }

  async function submitGrade() {
    if (!exercise) return;
    setBusy("grade");
    setError("");
    try {
      const data = await post<{ grade: GrammarGrade; saved: boolean }>({
        action: "grade",
        setId,
        mode: exercise.kind,
        prompt: exercisePrompt(exercise),
        reference: exercise.reference_en,
        answer: answer.trim(),
      });
      setGrade({ ...data.grade, saved: data.saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không chấm được bài.");
    } finally {
      setBusy(undefined);
    }
  }

  const canAnswer = aiEnabled && terms.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Ngữ pháp AI</h1>
          <Link href={`/sets/${setId}`} className="text-sm font-bold underline">Về bộ từ: {setTitle}</Link>
        </div>
        <Link href="/history" className={buttonVariants({ variant: "outline" })}>Lịch sử</Link>
      </header>

      {!aiEnabled && (
        <p role="status" className="rounded-2xl border-2 border-dashed p-4 text-sm font-bold">
          AI chưa được bật. Bạn vẫn xem lại các câu đã luyện bên dưới.
        </p>
      )}
      {aiEnabled && !terms.length && <p>Bộ từ chưa có thẻ để luyện ngữ pháp.</p>}

      {canAnswer && (
        <section className={panel}>
          <div className="flex flex-wrap items-center gap-2">
            {(["translate", "fix"] as const).map((m) => (
              <Button key={m} type="button"
                variant={mode === m ? "default" : "outline"}
                disabled={!!busy}
                onClick={() => { setMode(m); reset(); }}>
                {m === "translate" ? "Dịch Việt → Anh" : "Sửa câu sai"}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "translate"
              ? "AI đưa một câu tiếng Việt dùng từ trong bộ. Hãy dịch sang tiếng Anh tự nhiên."
              : "AI đưa một câu tiếng Anh có lỗi ngữ pháp. Hãy sửa lại cho đúng."}
          </p>
          {!exercise ? (
            <Button type="button" disabled={!!busy} onClick={() => void loadExercise()}>
              Tạo bài tập
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border-2 bg-background p-4">
                {exercise.kind === "translate" ? (
                  <p lang="vi" className="text-lg font-bold">{exercise.prompt_vi}</p>
                ) : (
                  <div className="space-y-2">
                    <p lang="en" className="text-lg font-bold">{exercise.wrong_en}</p>
                    {exercise.hint_vi && <p className="text-sm text-muted-foreground">Gợi ý: {exercise.hint_vi}</p>}
                  </div>
                )}
                {(exercise.kind === "translate" ? exercise.used_terms : exercise.target_terms).length > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Từ mục tiêu: {(exercise.kind === "translate" ? exercise.used_terms : exercise.target_terms).join(", ")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="grammar-answer" className="font-extrabold">
                  {exercise.kind === "translate" ? "Câu dịch của bạn" : "Câu đã sửa"}
                </label>
                <textarea id="grammar-answer" className={area} lang="en" rows={3} maxLength={2000}
                  disabled={!!busy} value={answer} placeholder="Nhập câu trả lời bằng tiếng Anh..."
                  onChange={(e) => { setAnswer(e.target.value); setGrade(undefined); }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!!busy || !answer.trim()} onClick={() => void submitGrade()}>
                  Chấm bài
                </Button>
                <Button type="button" variant="outline" disabled={!!busy} onClick={() => void loadExercise()}>
                  Bài mới
                </Button>
              </div>
            </div>
          )}
          {busy === "exercise" && <LogoLoader size="sm" label="Đang tạo bài tập" />}
          {busy === "grade" && <LogoLoader size="sm" label="Đang chấm bài" />}
        </section>
      )}

      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}

      {grade && (
        <section className={panel}>
          <h2 className="text-xl font-extrabold">Kết quả: {grade.score}%</h2>
          {!grade.saved && <p className="text-sm text-muted-foreground">Bài này chưa lưu được vào lịch sử.</p>}
          <div className="rounded-2xl border-2 bg-background p-4">
            <p className="text-sm font-bold text-muted-foreground">Câu đúng</p>
            <p lang="en" className="text-lg font-bold">{grade.corrected_en}</p>
          </div>
          <p lang="vi">{grade.explanation_vi}</p>
          {grade.mistakes.length > 0 && (
            <ul className="space-y-2">
              {grade.mistakes.map((m, i) => (
                <li key={i} className="rounded-2xl border-2 p-3 text-sm">
                  <p lang="en"><span className="line-through">{m.original}</span> → <strong>{m.replacement}</strong></p>
                  <p className="text-muted-foreground">{m.explanation_vi}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={panel}>
        <h2 className="text-xl font-extrabold">Câu cần ôn lại ({wrongAttempts.length})</h2>
        {!wrongAttempts.length ? (
          <p className="text-muted-foreground">Chưa có câu nào sai. Hãy luyện một bài để bắt đầu.</p>
        ) : (
          <ul className="space-y-3">
            {wrongAttempts.map((attempt) => (
              <li key={attempt.id} className="border-t pt-3">
                <p className="font-bold">
                  {attempt.mode === "fix" ? "Sửa câu sai" : "Dịch câu"} · {attempt.score}%
                </p>
                <p lang={attempt.mode === "fix" ? "en" : "vi"}>{attempt.prompt}</p>
                <p lang="en" className="text-sm text-muted-foreground">Đáp án: {attempt.reference}</p>
                {aiEnabled && (
                  <Button type="button" variant="outline" size="sm" className="mt-2"
                    disabled={!!busy} onClick={() => retryAttempt(attempt)}>
                    Làm lại câu này
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

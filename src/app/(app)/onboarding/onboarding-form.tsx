"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveOnboarding, skipOnboarding } from "./actions";

const goals = [
  { value: "ielts", label: "IELTS", description: "Luyện từ vựng cho kỳ thi IELTS" },
  { value: "toeic", label: "TOEIC", description: "Từ vựng thường gặp trong TOEIC" },
  { value: "thpt", label: "THPT", description: "Ôn tập cho kỳ thi THPT" },
  { value: "communication", label: "Giao tiếp", description: "Tự tin nói chuyện hằng ngày" },
  { value: "work", label: "Công việc", description: "Dùng tiếng Anh trong công việc" },
] as const;

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function OnboardingForm({
  initialGoal,
  initialLevel,
}: {
  initialGoal: string | null;
  initialLevel: string | null;
}) {
  const [error, action, pending] = useActionState(saveOnboarding, null);
  const [skipError, skipAction, skipping] = useActionState(skipOnboarding, null);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <p className="font-extrabold uppercase tracking-wide text-primary">Bắt đầu học</p>
        <h1 className="text-3xl font-black sm:text-4xl">Bạn muốn học để làm gì?</h1>
        <p className="text-muted-foreground">Chọn mục tiêu và trình độ để bắt đầu nhé.</p>
      </div>

      <form action={action} className="space-y-8">
        <fieldset className="space-y-3">
          <legend className="mb-3 text-lg font-extrabold">Mục tiêu của bạn</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((goal) => (
              <label key={goal.value} className="cursor-pointer">
                <input
                  className="peer sr-only"
                  type="radio"
                  name="goal"
                  value={goal.value}
                  defaultChecked={initialGoal === goal.value}
                  required
                />
                <span className="flex min-h-24 flex-col justify-center rounded-3xl border-2 border-border bg-card px-5 py-4 shadow-[0_4px_0_var(--border)] transition-colors hover:border-primary peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  <span className="font-extrabold">{goal.label}</span>
                  <span className="text-sm text-muted-foreground">{goal.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-lg font-extrabold">Trình độ hiện tại</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {levels.map((level) => (
              <label key={level} className="cursor-pointer">
                <input
                  className="peer sr-only"
                  type="radio"
                  name="level"
                  value={level}
                  defaultChecked={initialLevel === level}
                  required
                />
                <span className="flex h-16 items-center justify-center rounded-2xl border-2 border-border bg-card font-extrabold shadow-[0_4px_0_var(--border)] transition-colors hover:border-primary peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  {level}
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Chưa chắc? Chọn mức gần đúng, bạn có thể đổi sau.</p>
        </fieldset>

        {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
        <Button type="submit" disabled={pending || skipping} size="lg" className="w-full sm:w-auto">
          {pending ? "Đang lưu..." : "Bắt đầu học"}
        </Button>
      </form>

      <form action={skipAction}>
        {skipError && <p role="alert" className="mb-2 text-sm font-bold text-destructive">{skipError}</p>}
        <Button type="submit" variant="ghost" disabled={pending || skipping}>
          {skipping ? "Đang xử lý..." : "Bỏ qua lúc này"}
        </Button>
      </form>
    </div>
  );
}

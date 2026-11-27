"use client";

import { useState, useTransition } from "react";
import { Trophy } from "lucide-react";
import { setLeaderboardVisibility } from "@/lib/gamification/leaderboard-actions";
import { cn } from "@/lib/utils";

/** Switch for showing the learner's name on the weekly leaderboard. */
export function LeaderboardToggle({ initial }: { initial: boolean }) {
  const [visible, setVisible] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    const next = !visible;
    setVisible(next);
    setError("");
    startTransition(async () => {
      const result = await setLeaderboardVisibility(next);
      if (result.error) {
        setVisible(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <span className="bg-accent/25 text-accent-foreground grid size-11 shrink-0 place-items-center rounded-2xl"><Trophy className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p id="leaderboard-label" className="font-extrabold">Hiện tên trên bảng xếp hạng tuần</p>
          <p className="text-muted-foreground text-sm">Chỉ hiện tên hiển thị và XP, không bao giờ hiện email. Tắt thì bạn vẫn xem được hạng của mình.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          aria-labelledby="leaderboard-label"
          disabled={pending}
          onClick={toggle}
          className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60", visible ? "bg-primary" : "bg-muted-foreground/40")}
        >
          <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-[left]", visible ? "left-7" : "left-1")} />
        </button>
      </div>
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
    </div>
  );
}

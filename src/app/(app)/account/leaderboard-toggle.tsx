"use client";

import { useState, useTransition } from "react";
import { setLeaderboardVisibility } from "@/lib/gamification/leaderboard-actions";
import { cn } from "@/lib/utils";

/** Switch for showing the learner's name on the weekly leaderboard. */
export function LeaderboardToggle({ initial, labelledBy }: { initial: boolean; labelledBy: string }) {
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-labelledby={labelledBy}
        disabled={pending}
        onClick={toggle}
        className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60", visible ? "bg-primary" : "bg-muted-foreground/40")}
      >
        <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-[left]", visible ? "left-7" : "left-1")} />
      </button>
      {error ? <p role="alert" className="text-destructive text-xs font-bold">{error}</p> : null}
    </div>
  );
}

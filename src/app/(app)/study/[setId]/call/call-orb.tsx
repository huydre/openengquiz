"use client";

import { cn } from "@/lib/utils";

export type CallOrbMode = "speaking" | "listening" | "thinking" | "idle";

/**
 * Large tutor for the call screen. The face tile sits in soft rings that react to the call:
 * rings pulse while the tutor speaks, swell with the microphone level while listening, and
 * three dots bounce while the tutor thinks. Tapping it is the "tap to interrupt / talk" action.
 */
export function CallOrb({ mode, level, onTap, disabled, label }: {
  mode: CallOrbMode;
  level: number;
  onTap: () => void;
  disabled?: boolean;
  label: string;
}) {
  const listening = mode === "listening";
  // Mic level is 0..1 and usually small: lift it so normal speech gives a visible swell.
  const swell = listening ? 1 + Math.min(1, level * 6) * 0.35 : 1;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={label}
      className="group relative grid size-64 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-default sm:size-72"
    >
      {/* Soft halo, tinted by mode */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-6 rounded-full blur-2xl transition-colors duration-500",
          mode === "speaking" && "bg-primary/30",
          listening && "bg-secondary/30",
          mode === "thinking" && "bg-accent/30",
          mode === "idle" && "bg-muted",
        )}
      />
      {/* Pulsing rings while the tutor speaks */}
      {mode === "speaking" && [0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="tutor-ring border-primary/50 absolute inset-4 rounded-full border-4"
          style={{ "--tutor-ring-delay": `${i * 0.9}s` } as React.CSSProperties}
        />
      ))}
      {/* Level ring while listening */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-10 rounded-full border-4 transition-[transform,opacity,border-color] duration-100",
          listening ? "border-secondary/60 opacity-100" : "border-transparent opacity-0",
        )}
        style={{ transform: `scale(${swell})` }}
      />
      {/* Face tile */}
      <span
        aria-hidden="true"
        className={cn(
          "relative grid size-36 place-items-center rounded-[2.5rem] text-white transition-[background-color,box-shadow,transform] duration-300 sm:size-40",
          mode === "speaking" && "tutor-bob bg-primary shadow-[0_8px_0_var(--primary-edge)]",
          listening && "bg-secondary shadow-[0_8px_0_var(--secondary-edge)]",
          mode === "thinking" && "bg-accent text-accent-foreground shadow-[0_8px_0_var(--accent-edge)]",
          mode === "idle" && "bg-primary shadow-[0_8px_0_var(--primary-edge)]",
          !disabled && "group-hover:scale-[1.03] group-active:translate-y-1 group-active:shadow-none",
        )}
      >
        <svg viewBox="0 0 48 48" className="size-24 sm:size-28">
          <circle cx="15" cy="19" r="3" fill="currentColor" />
          <circle cx="33" cy="19" r="3" fill="currentColor" />
          <circle cx="11" cy="27" r="2.4" fill="currentColor" opacity="0.55" />
          <circle cx="37" cy="27" r="2.4" fill="currentColor" opacity="0.55" />
          {listening ? (
            // Small "o" mouth: the tutor is listening attentively
            <ellipse cx="24" cy="32" rx="3" ry="2.6" fill="currentColor" />
          ) : (
            <path d="M17 31 q7 6 14 0" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          )}
        </svg>
        {mode === "thinking" && (
          <span className="absolute -top-3 -right-3 flex gap-1 rounded-full bg-card px-2.5 py-2 shadow-md">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="bg-accent-edge size-2 animate-bounce rounded-full motion-reduce:animate-none"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

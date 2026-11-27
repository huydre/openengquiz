import { cn } from "@/lib/utils";

/** Small version of the app's tutor (logo tile with a friendly face) for chat rows. */
export function TutorAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-primary grid size-9 shrink-0 place-items-center rounded-xl shadow-[0_2px_0_var(--primary-edge)]", className)}
    >
      <svg viewBox="0 0 24 24" className="size-6 text-white">
        <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
        <circle cx="15.5" cy="10" r="1.6" fill="currentColor" />
        <path d="M8 14.5c1.1 1.4 2.4 2 4 2s2.9-.6 4-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brand loader: the OpenEngQuiz tile hops with a squash-and-stretch and a shrinking shadow.
 * CSS-only (keyframes in globals.css), so it works as a Suspense fallback in Server Components.
 * Fades in after a short delay to avoid flashing on fast loads; static under reduced motion.
 */
export function LogoLoader({
  label = "Đang tải...",
  size = "md",
  className,
}: {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "logo-loader flex flex-col items-center justify-center gap-3",
        size === "md" ? "min-h-64 py-12" : "py-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "logo-loader-tile bg-primary text-primary-foreground grid place-items-center rounded-2xl shadow-[0_4px_0_var(--primary-edge)]",
          size === "md" ? "size-14" : "size-10",
        )}
      >
        <Languages className={size === "md" ? "size-7" : "size-5"} />
      </span>
      <span aria-hidden="true" className="logo-loader-shadow bg-foreground/15 h-1.5 w-10 rounded-full" />
      <span className="text-muted-foreground text-sm font-bold">{label}</span>
    </div>
  );
}

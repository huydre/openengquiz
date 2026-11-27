import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

/** OpenEngQuiz mark: icon tile + wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span className="bg-primary text-primary-foreground grid size-8 place-items-center">
        <Languages className="size-4" aria-hidden="true" />
      </span>
      <span className="font-mono text-sm font-bold tracking-widest uppercase">OpenEngQuiz</span>
    </span>
  );
}

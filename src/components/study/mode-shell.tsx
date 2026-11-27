import Link from "next/link";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Top bar of a study mode: a close button back to the set, and optional actions on the right. */
export function ModeTopBar({ setId, title, children }: { setId?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {setId ? (
        <Link
          href={`/sets/${setId}`}
          aria-label={`Thoát, về bộ từ ${title}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-10 shrink-0 place-items-center rounded-xl transition-colors"
        >
          <X className="size-6" aria-hidden="true" />
        </Link>
      ) : null}
      <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm font-extrabold">{title}</p>
      {children}
    </div>
  );
}

/** Small outlined pill link used in the top bar (e.g. history). */
export function TopBarLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:bg-muted flex h-10 items-center gap-2 rounded-2xl border-2 px-4 text-sm font-extrabold shadow-[0_3px_0_var(--border)] active:translate-y-0.5 active:shadow-none">
      <Icon className="size-4" aria-hidden="true" />{children}
    </Link>
  );
}

/**
 * Intro card shown before a study mode starts: icon, name, what it does, the mode's options,
 * and a footer with the start action.
 */
export function ModeIntro({ icon: Icon, tone, title, description, badges, children, footer }: {
  icon: LucideIcon;
  tone: string;
  title: string;
  description: React.ReactNode;
  badges?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="bg-card overflow-hidden rounded-[2rem] border-2 shadow-[0_6px_0_var(--border)]">
      <div className="from-muted/70 to-card space-y-4 bg-gradient-to-b p-6 sm:p-8">
        <span className={cn("grid size-16 place-items-center rounded-3xl", tone)}>
          <Icon className="size-8" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <div className="text-muted-foreground mt-2 max-w-xl text-lg">{description}</div>
        </div>
        {badges ? <div className="flex flex-wrap gap-2 text-sm font-extrabold">{badges}</div> : null}
      </div>
      {children ? <div className="space-y-5 border-t-2 p-6 sm:p-8">{children}</div> : null}
      {footer ? <div className="flex flex-col gap-3 border-t-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">{footer}</div> : null}
    </section>
  );
}

/** A selectable pill, used for option pickers in mode intros. */
export function OptionPill({ selected, onClick, children, tone = "secondary", disabled, lang }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "secondary" | "primary";
  disabled?: boolean;
  lang?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      lang={lang}
      className={cn(
        "h-11 rounded-2xl border-2 px-4 font-extrabold transition-colors disabled:opacity-50",
        selected
          ? tone === "primary" ? "border-primary bg-primary/12 text-primary-edge" : "border-secondary bg-secondary/15 text-secondary"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Rounded content card used inside study modes. */
export function ModeCard({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("bg-card rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)] sm:p-8", className)} {...props}>
      {children}
    </section>
  );
}

/** Coloured notice for a mode that runs with reduced features (AI or speech service off). */
export function ModeNotice({ children }: { children: React.ReactNode }) {
  return <p role="status" className="bg-accent/15 text-accent-foreground rounded-2xl px-4 py-3 text-sm font-bold">{children}</p>;
}

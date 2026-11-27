import { cn } from "@/lib/utils";

// Technical decoration shared by the dark landing sections (adapted from Watermelon landing-01).

/** Small "+" marks where the section's vertical guide lines meet its top/bottom border. */
export function Crosshair({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute z-10 hidden h-4 w-4 lg:block",
        isTop ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
        isLeft ? "left-8 -translate-x-1/2 md:left-16" : "right-8 translate-x-1/2 md:right-16",
      )}
    >
      <div className="absolute top-1/2 right-0 left-0 h-px bg-white/20" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />
    </div>
  );
}

/** Thin vertical guide lines and top/bottom borders framing a section. */
export function GuideLines() {
  return (
    <div aria-hidden="true">
      <div className="absolute top-0 left-0 hidden w-full border-t border-white/5 lg:block" />
      <div className="absolute bottom-0 left-0 hidden w-full border-b border-white/5 lg:block" />
      <div className="absolute top-0 bottom-0 left-8 hidden w-px bg-white/5 md:left-16 lg:block" />
      <div className="absolute top-0 right-8 bottom-0 hidden w-px bg-white/5 md:right-16 lg:block" />
      <Crosshair position="top-left" />
      <Crosshair position="top-right" />
      <Crosshair position="bottom-left" />
      <Crosshair position="bottom-right" />
    </div>
  );
}

/** L-shaped marks on the four corners of a box. Parent must be `relative`. */
export function CornerAccents() {
  return (
    <div aria-hidden="true">
      <div className="absolute top-0 left-0 h-2 w-2 border-t border-l border-white/40" />
      <div className="absolute top-0 right-0 h-2 w-2 border-t border-r border-white/40" />
      <div className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-white/40" />
      <div className="absolute right-0 bottom-0 h-2 w-2 border-r border-b border-white/40" />
    </div>
  );
}

/** "// LABEL" eyebrow above section headings. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-primary inline-flex items-center text-xs font-bold tracking-widest uppercase">
      <span className="mr-3 opacity-70">{"//"}</span>
      {children}
    </span>
  );
}

/** Faint dot grid background. */
export function DotGrid() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px]"
    />
  );
}

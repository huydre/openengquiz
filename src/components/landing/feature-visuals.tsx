// Illustrative mock-ups for the feature bento. Static sample content, no live data.

export function FlashcardVisual() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute right-6 bottom-6 hidden w-44 sm:block">
      <div className="absolute inset-0 translate-x-3 -translate-y-3 rotate-6 border border-white/10 bg-white/3" />
      <div className="bg-background relative flex aspect-[4/3] flex-col justify-between border border-white/15 p-4">
        <span className="text-primary text-[10px] tracking-widest uppercase">{"// adj"}</span>
        <span className="font-sans text-xl font-extrabold">resilient</span>
        <span className="text-xs text-white/60">kiên cường</span>
      </div>
    </div>
  );
}

export function SpeakingVisual() {
  return (
    <div aria-hidden="true" className="pointer-events-none mt-6 flex w-full max-w-md flex-col gap-3 text-xs">
      <div className="self-start border border-white/10 bg-white/3 px-3 py-2 text-white/70">
        AI: Why is a scalable system important?
      </div>
      <div className="bg-primary/10 border-primary/30 self-end border px-3 py-2 text-white/80">
        A scalable system can <span className="text-destructive line-through">handles</span>{" "}
        <span className="text-primary font-bold">handle</span> more users.
      </div>
      <div className="text-primary self-end text-[10px] tracking-widest uppercase">
        ✓ Dùng đúng từ · Phát âm 92/100
      </div>
    </div>
  );
}

const INTERVALS = ["1 ngày", "3 ngày", "7 ngày", "14 ngày", "30 ngày"];
const RATINGS = ["Again", "Hard", "Good", "Easy"];

export function ReviewVisual() {
  return (
    <div aria-hidden="true" className="pointer-events-none mt-6 w-full max-w-lg">
      <div className="flex items-end gap-2">
        {INTERVALS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div className="bg-primary/70 w-full" style={{ height: `${16 + i * 14}px` }} />
            <span className="text-[10px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <span
            key={r}
            className="border border-white/10 py-1.5 text-center text-[10px] tracking-widest text-white/60 uppercase"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

const PATHS = [
  { name: "IELTS", progress: 72 },
  { name: "TOEIC", progress: 45 },
  { name: "THPT", progress: 88 },
  { name: "Giao tiếp", progress: 30 },
];

export function PathsVisual() {
  return (
    <ul aria-hidden="true" className="pointer-events-none mt-6 flex w-full max-w-xs flex-col gap-3">
      {PATHS.map((p) => (
        <li key={p.name} className="flex items-center gap-3 text-[10px] tracking-widest text-white/50 uppercase">
          <span className="w-16 shrink-0">{p.name}</span>
          <span className="h-1.5 flex-1 bg-white/10">
            <span className="bg-primary block h-full" style={{ width: `${p.progress}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

import type { CardMastery } from "@/lib/srs/card-mastery";
import { cn } from "@/lib/utils";

const ROWS: { key: CardMastery; label: string; dot: string; bar: string }[] = [
  { key: "mastered", label: "Thành thạo", dot: "bg-primary", bar: "bg-primary" },
  { key: "learning", label: "Đang học", dot: "bg-brand-orange", bar: "bg-brand-orange" },
  { key: "new", label: "Chưa học", dot: "bg-muted-foreground/30", bar: "bg-muted-foreground/20" },
];

/** Set progress: a stacked bar plus counts of mastered, learning and not-yet-studied cards. */
export function SetProgress({ counts }: { counts: Record<CardMastery, number> }) {
  const total = counts.new + counts.learning + counts.mastered;
  if (!total) return null;
  const percent = Math.round((counts.mastered / total) * 100);
  return (
    <div className="space-y-2" aria-label="Tiến độ bộ từ">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-extrabold">Tiến độ</p>
        <p className="text-muted-foreground text-sm font-bold"><span className="text-foreground font-black">{percent}%</span> thành thạo</p>
      </div>
      <div className="bg-muted flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={`${counts.mastered} thành thạo, ${counts.learning} đang học, ${counts.new} chưa học`}>
        {ROWS.map(({ key, bar }) => counts[key] ? <span key={key} className={cn("h-full", bar)} style={{ width: `${(counts[key] / total) * 100}%` }} /> : null)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ROWS.map(({ key, label, dot }) => (
          <li key={key} className="flex items-center gap-1.5 font-semibold">
            <span aria-hidden="true" className={cn("size-2.5 rounded-full", dot)} />
            <span className="font-black tabular-nums">{counts[key]}</span>
            <span className="text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

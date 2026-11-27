import { addDays } from "@/components/review/vietnam-day";

type Activity = { day: string; reviews: number; studied: number };
type Forecast = { day: string; count: number };

const HEAT_COLORS = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/55",
  "bg-primary/80",
  "bg-primary",
];

function shortDay(day: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "numeric" })
    .format(new Date(`${day}T12:00:00Z`));
}

export function ActivityCharts({ today, activity, forecast }: {
  today: string;
  activity: Activity[];
  forecast: Forecast[];
}) {
  const byDay = new Map(activity.map((entry) => [entry.day, entry.reviews + entry.studied]));
  const heatDays = Array.from({ length: 84 }, (_, index) => addDays(today, index - 83));
  const maxForecast = Math.max(1, ...forecast.map((entry) => entry.count));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
        <h2 className="text-xl font-extrabold">Hoạt động 12 tuần</h2>
        <p className="text-muted-foreground mt-1 text-sm">Mỗi ô là một ngày học hoặc ôn tập.</p>
        <div
          role="img"
          aria-label={`Hoạt động từ ${shortDay(heatDays[0])} đến ${shortDay(today)}. ${activity.filter((entry) => entry.reviews + entry.studied > 0 && entry.day >= heatDays[0]).length} ngày có hoạt động.`}
          className="mt-5 grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto"
        >
          {heatDays.map((day) => {
            const count = byDay.get(day) ?? 0;
            const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 11 ? 3 : 4;
            return (
              <span
                key={day}
                aria-hidden="true"
                title={`${shortDay(day)}: ${count} hoạt động`}
                className={`aspect-square min-w-3 rounded-sm ${HEAT_COLORS[level]}`}
              />
            );
          })}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">Ít hoạt động <span className="text-primary">● ● ● ●</span> Nhiều hoạt động</p>
      </section>
      <section className="rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
        <h2 className="text-xl font-extrabold">Dự báo 7 ngày</h2>
        <p className="text-muted-foreground mt-1 text-sm">Thẻ đã lên lịch đến hạn mỗi ngày.</p>
        <ul className="mt-5 space-y-3">
          {forecast.map(({ day, count }, index) => (
            <li key={day} className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-3 text-sm">
              <span className="font-bold">{index === 0 ? "Hôm nay" : shortDay(day)}</span>
              <span className="h-4 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${count / maxForecast * 100}%` }} />
              </span>
              <span className="text-right font-extrabold">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { Crown, EyeOff, Medal, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboardVisibility, getWeeklyLeaderboard, type WeeklyLeaderboard } from "@/lib/gamification/weekly-leaderboard";
import { XP_PER_COURSE_ACTIVITY, XP_PER_REVIEW_OR_SESSION, XP_PER_SPEAKING_ATTEMPT } from "@/lib/gamification/weekly-xp";
import { LogoLoader } from "@/components/layout/logo-loader";
import { cn } from "@/lib/utils";

export const metadata = { title: "Xếp hạng tuần" };

type Entry = WeeklyLeaderboard["entries"][number];

const PODIUM = [
  { place: 2, height: "h-28", tone: "bg-secondary text-secondary-foreground shadow-[0_5px_0_var(--secondary-edge)]", icon: Medal },
  { place: 1, height: "h-36", tone: "bg-accent text-accent-foreground shadow-[0_5px_0_var(--accent-edge)]", icon: Crown },
  { place: 3, height: "h-24", tone: "bg-brand-orange text-white shadow-[0_5px_0_oklch(0.62_0.15_55)]", icon: Medal },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

/** Days and hours until the week resets (weekEnd is the next Monday 00:00 VN, exclusive). */
function timeLeft(weekEnd: string) {
  const end = new Date(`${weekEnd}T00:00:00+07:00`).getTime();
  const hours = Math.max(0, Math.floor((end - Date.now()) / 3_600_000));
  return hours >= 24 ? `${Math.floor(hours / 24)} ngày ${hours % 24} giờ` : `${hours} giờ`;
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải bảng xếp hạng..." />}>
      <LeaderboardContent />
    </Suspense>
  );
}

async function LeaderboardContent() {
  const supabase = await createClient();
  const [board, visible] = await Promise.all([getWeeklyLeaderboard(supabase), getLeaderboardVisibility(supabase)]);
  const top = board.entries.filter((entry) => entry.rank <= 3);
  const rest = board.entries.filter((entry) => entry.rank > 3);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <div className="flex items-center gap-4">
        <span className="bg-accent/25 text-accent-foreground grid size-14 place-items-center rounded-3xl"><Trophy className="size-7" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black">Xếp hạng tuần</h1>
          <p className="text-muted-foreground font-semibold">Tuần mới bắt đầu sau {timeLeft(board.weekEnd)}. Học đều mỗi ngày để leo hạng.</p>
        </div>
      </div>

      <section className="bg-card flex items-center gap-4 rounded-3xl border-2 p-5 shadow-[0_5px_0_var(--border)]">
        <span className="bg-primary text-primary-foreground grid size-14 shrink-0 place-items-center rounded-2xl text-xl font-black shadow-[0_4px_0_var(--primary-edge)]">
          {board.me.rank ?? "–"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black">{board.me.rank ? `Bạn đang hạng ${board.me.rank}` : "Bạn chưa có XP tuần này"}</p>
          <p className="text-muted-foreground text-sm font-semibold">
            {board.me.xp} XP · ôn hoặc học thẻ +{XP_PER_REVIEW_OR_SESSION}, luyện nói +{XP_PER_SPEAKING_ATTEMPT}, xong một hoạt động bài học +{XP_PER_COURSE_ACTIVITY}
          </p>
        </div>
      </section>

      {!visible ? (
        <p className="bg-muted/70 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold">
          <EyeOff className="size-4 shrink-0" aria-hidden="true" /> Bạn đang ẩn tên khỏi bảng xếp hạng.
          <Link href="/account" className="text-primary-edge ml-auto underline">Đổi trong Tài khoản</Link>
        </p>
      ) : null}

      {board.entries.length ? (
        <>
          {top.length ? (
            <section aria-label="Ba hạng đầu" className="grid grid-cols-3 items-end gap-3 pt-6">
              {PODIUM.map(({ place, height, tone, icon: Icon }) => {
                const entry = top.find((item) => item.rank === place);
                return (
                  <div key={place} className="flex flex-col items-center gap-2 text-center">
                    {entry ? (
                      <>
                        <span className={cn("bg-card grid size-14 place-items-center rounded-full border-2 text-lg font-black", entry.isMe && "border-primary")}>{initials(entry.name)}</span>
                        <p className="max-w-full truncate font-extrabold">{entry.name}{entry.isMe ? " (bạn)" : ""}</p>
                        <p className="text-muted-foreground text-sm font-black tabular-nums">{entry.xp} XP</p>
                      </>
                    ) : <span className="size-14" />}
                    <div className={cn("flex w-full flex-col items-center justify-start gap-1 rounded-t-3xl pt-3", height, entry ? tone : "bg-muted")}>
                      <Icon className="size-6" aria-hidden="true" />
                      <span className="text-2xl font-black">{place}</span>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}

          {rest.length ? (
            <ol className="bg-card divide-y-2 overflow-hidden rounded-3xl border-2 shadow-[0_5px_0_var(--border)]">
              {rest.map((entry) => <Row key={`${entry.rank}-${entry.name}`} entry={entry} />)}
            </ol>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground rounded-3xl border-2 border-dashed p-10 text-center font-semibold">Chưa ai có XP tuần này. Học một bài để đứng đầu bảng!</p>
      )}
    </div>
  );
}

function Row({ entry }: { entry: Entry }) {
  return (
    <li className={cn("flex items-center gap-4 px-5 py-3", entry.isMe && "bg-primary/10")}>
      <span className="text-muted-foreground w-8 text-center text-lg font-black tabular-nums">{entry.rank}</span>
      <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-full font-black">{initials(entry.name)}</span>
      <span className="min-w-0 flex-1 truncate font-extrabold">{entry.name}{entry.isMe ? " (bạn)" : ""}</span>
      <span className="font-black tabular-nums">{entry.xp} XP</span>
    </li>
  );
}

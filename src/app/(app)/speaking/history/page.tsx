import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Lịch sử luyện nói" };

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default function SpeakingHistoryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Lịch sử luyện nói</h1>
        <Link href="/pronunciation" className={buttonVariants({ variant: "outline" })}>
          Luyện phát âm
        </Link>
      </div>
      <Suspense fallback={<LogoLoader label="Đang tải lịch sử..." />}>
        <RecentAttempts />
      </Suspense>
    </div>
  );
}

async function RecentAttempts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("speaking_attempts")
    .select("id, mode, prompt_text, transcript, score:pron->score, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);

  if (error) return <p role="alert">Không tải được lịch sử luyện nói. Thử lại sau nhé.</p>;
  if (!data.length) return <p>Bạn chưa có lượt luyện nào được lưu.</p>;

  return (
    <ul className="space-y-3">
      {data.map((attempt) => (
        <li key={attempt.id} className="space-y-2 rounded-3xl border-2 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-extrabold">
              {attempt.mode === "scripted" ? "Đọc câu mẫu" : "Nói với từ mục tiêu"}
            </span>
            <time dateTime={attempt.created_at} className="text-muted-foreground">
              {dateTime.format(new Date(attempt.created_at))}
            </time>
          </div>
          <p className="break-words font-bold" lang="en">{attempt.prompt_text}</p>
          {attempt.mode === "speaking" && <p className="break-words" lang="en">{attempt.transcript}</p>}
          {typeof attempt.score === "number" && (
            <p className="text-sm">Điểm phát âm: <strong>{Math.round(attempt.score * 100)}%</strong></p>
          )}
        </li>
      ))}
    </ul>
  );
}

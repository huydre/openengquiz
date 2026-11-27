import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoLoader } from "@/components/layout/logo-loader";
import { DeleteAccountForm } from "./delete-account-form";
import { LeaderboardToggle } from "./leaderboard-toggle";
import { getLeaderboardVisibility } from "@/lib/gamification/weekly-leaderboard";

export const metadata = { title: "Tài khoản" };

export default function AccountPage() {
  return <Suspense fallback={<LogoLoader label="Đang tải tài khoản..." />}><AccountContent /></Suspense>;
}

async function AccountContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, showOnLeaderboard] = await Promise.all([
    supabase.from("profiles").select("display_name, goal, level").eq("id", user!.id).maybeSingle(),
    getLeaderboardVisibility(supabase),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-black">Tài khoản</h1>

      <section className="bg-card space-y-3 rounded-3xl border-2 p-6 shadow-[0_4px_0_var(--border)]">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-muted-foreground text-xs font-extrabold uppercase">Email</dt><dd className="font-bold break-all">{user!.email}</dd></div>
          <div><dt className="text-muted-foreground text-xs font-extrabold uppercase">Tên hiển thị</dt><dd className="font-bold">{profile?.display_name || "Chưa đặt"}</dd></div>
          <div><dt className="text-muted-foreground text-xs font-extrabold uppercase">Mục tiêu</dt><dd className="font-bold">{profile?.goal?.toUpperCase() || "Chưa chọn"}</dd></div>
          <div><dt className="text-muted-foreground text-xs font-extrabold uppercase">Trình độ</dt><dd className="font-bold">{profile?.level || "Chưa chọn"}</dd></div>
        </dl>
        <p className="text-muted-foreground text-sm">
          Xem <Link href="/privacy" className="text-primary-edge font-bold underline">Chính sách bảo mật</Link> và <Link href="/terms" className="text-primary-edge font-bold underline">Điều khoản sử dụng</Link>.
        </p>
      </section>

      <section className="bg-card rounded-3xl border-2 p-6 shadow-[0_4px_0_var(--border)]">
        <LeaderboardToggle initial={showOnLeaderboard} />
      </section>

      <section className="border-destructive/30 bg-destructive/5 space-y-3 rounded-3xl border-2 p-6" aria-labelledby="delete-title">
        <h2 id="delete-title" className="text-destructive text-xl font-black">Xoá tài khoản</h2>
        <p className="text-sm">Xoá vĩnh viễn tài khoản cùng toàn bộ bộ từ, thẻ, ảnh tải lên, tiến độ ôn tập, kết quả bài học và lịch sử luyện nói. Không thể khôi phục.</p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}

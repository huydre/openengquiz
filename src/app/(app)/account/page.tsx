import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, FileText, KeyRound, LogOut, Palette, Pencil, ShieldCheck, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { LogoLoader } from "@/components/layout/logo-loader";
import { tagLabel } from "@/components/paths/path-cards";
import { getLeaderboardVisibility } from "@/lib/gamification/weekly-leaderboard";
import { cn } from "@/lib/utils";
import { DeleteAccountForm } from "./delete-account-form";
import { LeaderboardToggle } from "./leaderboard-toggle";
import { ThemePicker } from "./theme-picker";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Tài khoản" };

export default function AccountPage() {
  return <Suspense fallback={<LogoLoader label="Đang tải tài khoản..." />}><AccountContent /></Suspense>;
}

function initials(name: string) {
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

async function AccountContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, showOnLeaderboard] = await Promise.all([
    supabase.from("profiles").select("display_name, goal, level").eq("id", user!.id).maybeSingle(),
    getLeaderboardVisibility(supabase),
  ]);
  const name = profile?.display_name || user!.email?.split("@")[0] || "Bạn";
  const avatarUrl = (user!.user_metadata?.avatar_url ?? user!.user_metadata?.picture) as string | undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <h1 className="text-3xl font-black">Tài khoản</h1>

      {/* Profile */}
      <section className="bg-card from-primary/10 to-card flex flex-col items-center gap-5 rounded-[2rem] border-2 bg-gradient-to-b p-6 text-center shadow-[0_6px_0_var(--border)] sm:flex-row sm:text-left">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google profile photo, external
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-20 shrink-0 rounded-full object-cover shadow-[0_5px_0_var(--primary-edge)] ring-4 ring-primary" />
        ) : (
          <span className="bg-primary text-primary-foreground grid size-20 shrink-0 place-items-center rounded-full text-3xl font-black shadow-[0_5px_0_var(--primary-edge)]">
            {initials(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-black">{name}</p>
          <p className="text-muted-foreground truncate font-semibold">{user!.email}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            <span className="bg-card rounded-full border-2 px-3 py-0.5 text-sm font-extrabold">{profile?.goal ? tagLabel(profile.goal) : "Chưa chọn mục tiêu"}</span>
            <span className="bg-card rounded-full border-2 px-3 py-0.5 text-sm font-extrabold">{profile?.level ? `Trình độ ${profile.level}` : "Chưa chọn trình độ"}</span>
          </div>
        </div>
        <Link href="/onboarding" className="hover:bg-muted flex h-10 shrink-0 items-center gap-2 rounded-2xl border-2 px-4 text-sm font-extrabold shadow-[0_3px_0_var(--border)] active:translate-y-0.5 active:shadow-none">
          <Pencil className="size-4" aria-hidden="true" /> Đổi mục tiêu
        </Link>
      </section>

      {/* Settings */}
      <SettingsGroup title="Cài đặt">
        <SettingRow icon={Palette} tone="bg-secondary/15 text-secondary" title="Giao diện" description="Sáng, tối, hoặc theo cài đặt của máy.">
          <ThemePicker />
        </SettingRow>
        <SettingRow
          icon={Trophy}
          tone="bg-accent/25 text-accent-foreground"
          title="Hiện tên trên bảng xếp hạng tuần"
          titleId="leaderboard-setting"
          description="Chỉ hiện tên hiển thị và XP, không bao giờ hiện email. Tắt thì bạn vẫn thấy hạng của mình."
        >
          <LeaderboardToggle initial={showOnLeaderboard} labelledBy="leaderboard-setting" />
        </SettingRow>
      </SettingsGroup>

      {/* Sign-in */}
      <SettingsGroup title="Đăng nhập">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="bg-primary/15 text-primary-edge grid size-10 shrink-0 place-items-center rounded-xl"><KeyRound className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="font-extrabold">Mật khẩu</p>
              <p className="text-muted-foreground text-sm">Đặt hoặc đổi mật khẩu để đăng nhập bằng email mà không cần chờ link.</p>
            </div>
          </div>
          <PasswordForm />
        </div>
      </SettingsGroup>

      {/* Info */}
      <SettingsGroup title="Thông tin">
        <LinkRow href="/privacy" icon={ShieldCheck} title="Chính sách bảo mật" />
        <LinkRow href="/terms" icon={FileText} title="Điều khoản sử dụng" />
        <form action={signOut}>
          <button type="submit" className="hover:bg-muted/60 flex w-full items-center gap-4 px-5 py-4 text-left transition-colors">
            <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl"><LogOut className="size-5" aria-hidden="true" /></span>
            <span className="flex-1 font-extrabold">Đăng xuất</span>
          </button>
        </form>
      </SettingsGroup>

      {/* Danger zone, collapsed until asked for */}
      <details className="group bg-card overflow-hidden rounded-3xl border-2">
        <summary className="hover:bg-muted/60 flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="bg-destructive/10 text-destructive grid size-10 shrink-0 place-items-center rounded-xl"><Trash2 className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="text-destructive block font-extrabold">Xoá tài khoản</span>
            <span className="text-muted-foreground block text-sm">Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học.</span>
          </span>
          <ChevronRight className="text-muted-foreground size-5 transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <div className="border-destructive/20 bg-destructive/5 space-y-3 border-t-2 p-5">
          <p className="text-sm">Toàn bộ bộ từ, thẻ, ảnh tải lên, tiến độ ôn tập, kết quả bài học và lịch sử luyện nói sẽ bị xoá. <strong>Không thể khôi phục.</strong></p>
          <DeleteAccountForm />
        </div>
      </details>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground px-1 text-xs font-extrabold tracking-wide uppercase">{title}</h2>
      <div className="bg-card divide-y-2 overflow-hidden rounded-3xl border-2 shadow-[0_4px_0_var(--border)]">{children}</div>
    </section>
  );
}

function SettingRow({ icon: Icon, tone, title, titleId, description, children }: {
  icon: LucideIcon;
  tone: string;
  title: string;
  titleId?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}><Icon className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p id={titleId} className="font-extrabold">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

function LinkRow({ href, icon: Icon, title }: { href: string; icon: LucideIcon; title: string }) {
  return (
    <Link href={href} className="hover:bg-muted/60 flex items-center gap-4 px-5 py-4 transition-colors">
      <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl"><Icon className="size-5" aria-hidden="true" /></span>
      <span className="flex-1 font-extrabold">{title}</span>
      <ChevronRight className="text-muted-foreground size-5" aria-hidden="true" />
    </Link>
  );
}

"use client";

// Login card from Watermelon auth-01: email + password (sign in or sign up), Google OAuth,
// and an emailed sign-in link for forgotten passwords or accounts created without one.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { Auth1 } from "@/components/ui/auth-01";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";
type Status =
  | { kind: "idle" }
  | { kind: "sent"; email: string; reason: "confirm" | "link" }
  | { kind: "error"; message: string };

/** Seconds to wait between two emails, so a fresh link does not invalidate the one in flight. */
const EMAIL_COOLDOWN = 60;

/** Supabase auth errors in plain Vietnamese, with a next step where one exists. */
function authErrorMessage(error: { message: string; code?: string }): string {
  const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (text.includes("rate limit") || text.includes("over_email_send_rate_limit")) {
    return "Hệ thống đang gửi quá nhiều email. Bạn hãy đăng nhập bằng mật khẩu hoặc Google, hoặc thử lại sau ít phút.";
  }
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) {
    return "Email hoặc mật khẩu chưa đúng. Nếu trước đây bạn đăng nhập bằng link email, hãy bấm \"Quên mật khẩu?\" để nhận link rồi đặt mật khẩu trong trang Tài khoản.";
  }
  if (text.includes("email not confirmed") || text.includes("email_not_confirmed")) {
    return "Email chưa được xác nhận. Mở email xác nhận đã gửi cho bạn rồi đăng nhập lại.";
  }
  if (text.includes("already registered") || text.includes("user_already_exists")) {
    return "Email này đã có tài khoản. Chuyển sang \"Đăng nhập\", hoặc bấm \"Quên mật khẩu?\".";
  }
  if (text.includes("weak") || text.includes("password should")) {
    return "Mật khẩu cần ít nhất 8 ký tự.";
  }
  if (text.includes("expired") || text.includes("otp_expired") || text.includes("invalid")) {
    return "Link đăng nhập đã hết hạn hoặc đã được dùng. Hãy dùng link trong email mới nhất, mở trên cùng trình duyệt bạn đã yêu cầu.";
  }
  return "Đăng nhập thất bại, vui lòng thử lại.";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<Status>(() => {
    const code = searchParams.get("error");
    if (!code) return { kind: "idle" };
    return { kind: "error", message: code === "link" ? authErrorMessage({ message: "expired" }) : "Đăng nhập thất bại, vui lòng thử lại." };
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setStatus({ kind: "error", message: authErrorMessage(error) });
      setLoading(false);
    }
  }

  async function submit(email: string, password: string) {
    setLoading(true);
    setStatus({ kind: "idle" });
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus({ kind: "error", message: authErrorMessage(error) });
        setLoading(false);
        return;
      }
      router.replace(safeNextPath(next));
      router.refresh();
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setStatus({ kind: "error", message: authErrorMessage(error) });
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace(safeNextPath(next));
      router.refresh();
      return;
    }
    setLoading(false);
    setCooldown(EMAIL_COOLDOWN);
    setStatus({ kind: "sent", email, reason: "confirm" });
  }

  async function sendSignInLink() {
    const email = (document.getElementById("Auth1-email") as HTMLInputElement | null)?.value.trim() ?? "";
    if (!email) {
      setStatus({ kind: "error", message: "Nhập email trước rồi bấm \"Quên mật khẩu?\"." });
      return;
    }
    if (cooldown > 0) return;
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      setStatus({ kind: "error", message: authErrorMessage(error) });
      return;
    }
    setCooldown(EMAIL_COOLDOWN);
    setStatus({ kind: "sent", email, reason: "link" });
  }

  return (
    <Auth1
      heading={mode === "signin" ? "Chào mừng bạn" : "Tạo tài khoản"}
      subheading="Học từ nào, nói từ đó. Miễn phí."
      emailPlaceholder="Email của bạn"
      passwordPlaceholder={mode === "signin" ? "Mật khẩu" : "Mật khẩu (ít nhất 8 ký tự)"}
      passwordAutoComplete={mode === "signin" ? "current-password" : "new-password"}
      submitLabel={mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
      dividerText="hoặc"
      socialProviders={[
        { name: "Tiếp tục với Google", icon: <FcGoogle aria-hidden="true" />, onClick: signInWithGoogle },
      ]}
      loading={loading}
      onSubmit={(email, password) => submit(email, password)}
      formHeader={
        <div role="tablist" aria-label="Cách vào tài khoản" className="bg-muted grid grid-cols-2 rounded-xl p-1">
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              disabled={loading}
              onClick={() => { setMode(value); setStatus({ kind: "idle" }); }}
              className={cn(
                "rounded-lg py-1.5 text-sm font-extrabold transition-colors disabled:cursor-wait",
                mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          ))}
        </div>
      }
      formReplacement={
        status.kind === "sent" ? (
          <div role="status" className="border-primary/30 bg-primary/10 space-y-2 rounded-2xl border p-4 text-center text-sm">
            <p>
              {status.reason === "confirm" ? "Đã gửi email xác nhận tới " : "Đã gửi link đăng nhập tới "}
              <b>{status.email}</b>.
            </p>
            <p className="text-muted-foreground text-xs">
              Mở link trong email mới nhất, trên chính trình duyệt này. Không thấy thì xem thư mục Spam.
            </p>
            <button
              type="button"
              className="text-primary-edge text-xs font-bold underline disabled:no-underline disabled:opacity-60"
              disabled={cooldown > 0}
              onClick={() => setStatus({ kind: "idle" })}
            >
              {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Quay lại"}
            </button>
          </div>
        ) : undefined
      }
      notice={
        <div className="space-y-2 text-center">
          {mode === "signin" && status.kind !== "sent" ? (
            <button
              type="button"
              onClick={sendSignInLink}
              disabled={loading || cooldown > 0}
              className="text-muted-foreground hover:text-foreground text-xs font-bold underline disabled:opacity-60"
            >
              {cooldown > 0 ? `Quên mật khẩu? (gửi lại sau ${cooldown}s)` : "Quên mật khẩu? Gửi link đăng nhập qua email"}
            </button>
          ) : null}
          {status.kind === "error" ? (
            <p role="alert" className="text-destructive text-xs font-semibold">
              {status.message}
            </p>
          ) : null}
        </div>
      }
      bottomPromptText={mode === "signin" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
      bottomPromptLinkText={mode === "signin" ? "Tạo tài khoản" : "Đăng nhập"}
      onBottomPromptClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setStatus({ kind: "idle" }); }}
    />
  );
}

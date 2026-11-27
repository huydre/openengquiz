"use client";

// Login card from Watermelon auth-01, used passwordless: Google OAuth or an email magic link.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { Auth1 } from "@/components/ui/auth-01";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/safe-next-path";

type Status = { kind: "idle" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(
    searchParams.get("error") === "auth"
      ? { kind: "error", message: "Đăng nhập thất bại, vui lòng thử lại." }
      : { kind: "idle" },
  );

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      setLoading(false);
    }
  }

  async function signInWithEmail(email: string) {
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setLoading(false);
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", email });
  }

  return (
    <Auth1
      heading="Chào mừng bạn"
      subheading="Học từ nào, nói từ đó. Miễn phí."
      emailPlaceholder="Email của bạn"
      showPasswordField={false}
      submitLabel="Gửi link đăng nhập"
      dividerText="hoặc"
      socialProviders={[
        { name: "Tiếp tục với Google", icon: <FcGoogle aria-hidden="true" />, onClick: signInWithGoogle },
      ]}
      loading={loading}
      onSubmit={(email) => signInWithEmail(email)}
      formReplacement={
        status.kind === "sent" ? (
          <p role="status" className="border-primary/30 bg-primary/10 rounded-2xl border p-4 text-center text-sm">
            Đã gửi link đăng nhập tới <b>{status.email}</b>. Kiểm tra hộp thư của bạn.
          </p>
        ) : undefined
      }
      notice={
        status.kind === "error" ? (
          <p role="alert" className="text-destructive text-center text-xs">
            {status.message}
          </p>
        ) : undefined
      }
      bottomPromptText="Lần đầu? Đăng nhập là tự tạo tài khoản."
      bottomPromptLinkText="Về trang chủ"
      onBottomPromptClick={() => router.push("/")}
    />
  );
}

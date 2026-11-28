"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Sets or changes the account password, so learners who joined by email link can sign in with one. */
export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setState({ kind: "error", message: "Mật khẩu cần ít nhất 8 ký tự." });
      return;
    }
    setState({ kind: "saving" });
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      const same = error.message.toLowerCase().includes("different");
      setState({ kind: "error", message: same ? "Mật khẩu mới phải khác mật khẩu cũ." : "Chưa lưu được mật khẩu, thử lại sau." });
      return;
    }
    setPassword("");
    setState({ kind: "saved" });
  }

  return (
    <form onSubmit={save} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <input
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={password}
        onChange={(event) => { setPassword(event.target.value); if (state.kind !== "saving") setState({ kind: "idle" }); }}
        placeholder="Mật khẩu mới"
        aria-label="Mật khẩu mới"
        className="bg-muted focus-visible:ring-primary/30 h-10 w-full rounded-xl border-2 border-transparent px-3 text-sm outline-none focus-visible:ring-2 sm:w-48"
      />
      <button
        type="submit"
        disabled={state.kind === "saving"}
        className="bg-primary text-primary-foreground h-10 shrink-0 rounded-xl px-4 text-sm font-extrabold shadow-[0_3px_0_var(--primary-edge)] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
      >
        {state.kind === "saving" ? "Đang lưu..." : "Lưu"}
      </button>
      {state.kind === "saved" ? <p role="status" className="text-primary-edge text-xs font-bold">Đã lưu mật khẩu.</p> : null}
      {state.kind === "error" ? <p role="alert" className="text-destructive text-xs font-bold">{state.message}</p> : null}
    </form>
  );
}

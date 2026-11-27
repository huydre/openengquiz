"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type SubmitFeedback = (input: { message: string; page: string }) => Promise<{ ok: true } | { error: string }>;

/** "Báo lỗi / góp ý" dialog: a short message sent with the current page path. */
export function FeedbackDialog({ submit, children }: { submit: SubmitFeedback; children: (open: () => void) => React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setState("sending");
    setError("");
    const result = await submit({ message: message.trim(), page: pathname }).catch(() => ({ error: "Chưa gửi được. Thử lại sau nhé." }));
    if ("error" in result) {
      setError(result.error);
      setState("idle");
      return;
    }
    setState("sent");
    setMessage("");
  }

  return (
    <>
      {children(() => { setOpen(true); setState("idle"); setError(""); })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="bg-card rounded-3xl border-2 sm:max-w-lg">
          {state === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="text-primary size-14" aria-hidden="true" />
              <DialogTitle className="text-2xl font-black">Cảm ơn bạn!</DialogTitle>
              <p className="text-muted-foreground font-semibold">Góp ý đã được gửi tới nhóm phát triển.</p>
              <Button type="button" size="lg" onClick={() => setOpen(false)}>Đóng</Button>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="bg-brand-orange/15 text-brand-orange grid size-11 place-items-center rounded-2xl">
                  <MessageSquareWarning className="size-6" aria-hidden="true" />
                </span>
                <DialogTitle className="text-2xl font-black">Báo lỗi hoặc góp ý</DialogTitle>
              </div>
              <label htmlFor="feedback-message" className="text-muted-foreground block font-semibold">
                Bạn gặp lỗi gì, hay muốn app có thêm gì? Mô tả ngắn là đủ.
              </label>
              <textarea
                id="feedback-message"
                autoFocus
                rows={5}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ví dụ: Ở bài 3, nút Tiếp tục không bấm được..."
                className="bg-background focus:border-primary w-full rounded-2xl border-2 p-4 font-semibold outline-none"
              />
              <p className="text-muted-foreground text-xs font-semibold">Gửi kèm trang bạn đang xem: <span className="font-mono">{pathname}</span></p>
              {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button type="submit" disabled={state === "sending" || !message.trim()}>{state === "sending" ? "Đang gửi..." : "Gửi góp ý"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

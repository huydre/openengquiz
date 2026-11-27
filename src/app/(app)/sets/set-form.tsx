"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSet, updateSet, type SetInput } from "./set-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SetForm({ id, initial }: { id?: string; initial?: SetInput }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [visibility, setVisibility] = useState<SetInput["visibility"]>(initial?.visibility ?? "private");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = id
        ? await updateSet(id, { title, description, visibility })
        : await createSet({ title, description, visibility });
      if (result.error) setError(result.error);
      else if (result.id) router.push(`/sets/${result.id}`);
      else setError("Không lưu được bộ từ.");
    } catch {
      setError("Không lưu được bộ từ. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-3xl border-2 bg-card p-6 shadow-[0_4px_0_var(--border)]">
      <div><label htmlFor="set-title" className="mb-2 block font-bold">Tên bộ từ</label><input id="set-title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="focus-visible:ring-primary w-full rounded-2xl border-2 bg-background p-3 outline-none focus-visible:ring-2" placeholder="Ví dụ: Từ vựng giao tiếp" /></div>
      <div><label htmlFor="set-description" className="mb-2 block font-bold">Mô tả</label><textarea id="set-description" maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="focus-visible:ring-primary w-full rounded-2xl border-2 bg-background p-3 outline-none focus-visible:ring-2" placeholder="Bộ từ này giúp bạn học gì?" /></div>
      <div><label htmlFor="set-visibility" className="mb-2 block font-bold">Chia sẻ</label>
        <Select value={visibility} onValueChange={(value) => setVisibility(value as SetInput["visibility"])}>
          <SelectTrigger id="set-visibility" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Riêng tư</SelectItem>
            <SelectItem value="unlisted">Ai có link đều xem được</SelectItem>
            <SelectItem value="public">Công khai</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : id ? "Lưu thay đổi" : "Tạo bộ từ"}</Button><Link href={id ? `/sets/${id}` : "/sets"} className="font-bold underline">Huỷ</Link></div>
    </form>
  );
}

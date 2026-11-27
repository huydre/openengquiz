"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { changeVisibility, deleteSet, duplicateSet, type SetInput } from "./set-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SetManagement({ id, visibility }: { id: string; visibility: SetInput["visibility"] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(task: () => Promise<{ error?: string; id?: string }>, navigate = false) {
    setPending(true);
    setError("");
    try {
      const result = await task();
      if (result.error) setError(result.error);
      else if (navigate) router.push(result.id ? `/sets/${result.id}` : "/sets");
      else router.refresh();
    } catch {
      setError("Không thực hiện được. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border-2 p-4">
      <Link href={`/sets/${id}/edit`} className="rounded-2xl border-2 px-4 py-2 font-bold">Sửa bộ từ</Link>
      <Button variant="outline" disabled={pending} onClick={() => run(() => duplicateSet(id), true)}>Nhân bản</Button>
      <div className="flex items-center gap-2 font-bold">
        <span id="set-visibility-label">Chia sẻ</span>
        <Select
          disabled={pending}
          value={visibility}
          onValueChange={(value) => run(() => changeVisibility(id, value as SetInput["visibility"]))}
        >
          <SelectTrigger aria-labelledby="set-visibility-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Riêng tư</SelectItem>
            <SelectItem value="unlisted">Có link</SelectItem>
            <SelectItem value="public">Công khai</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visibility !== "private" ? <Button variant="outline" disabled={pending} onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/shared/${id}`); setNotice("Đã sao chép link chia sẻ."); } catch { setError("Không sao chép được link. Hãy thử lại."); } }}>Sao chép link</Button> : null}
      <Button variant="destructive" disabled={pending} onClick={() => { if (window.confirm("Xoá bộ từ và tất cả thẻ?")) run(() => deleteSet(id), true); }}>Xoá bộ từ</Button>
      {error ? <p role="alert" className="text-destructive w-full text-sm">{error}</p> : null}
      {notice ? <p role="status" className="w-full text-sm">{notice}</p> : null}
    </div>
  );
}

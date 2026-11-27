"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Folder, Globe, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { changeVisibility, deleteSet, duplicateSet, type SetInput } from "./set-actions";
import { moveSetToFolder } from "./folder-actions";

const NO_FOLDER = "none";

/** Runs a set action, then navigates or refreshes; surfaces errors and notices. */
function useSetAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(task: () => Promise<{ error?: string; id?: string }>, navigate = false) {
    setPending(true);
    setError("");
    setNotice("");
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

  return { pending, error, notice, setError, setNotice, run };
}

/** "⋯" menu with the less frequent set actions: edit, duplicate, copy link, delete. */
export function SetMenu({ id, visibility }: { id: string; visibility: SetInput["visibility"] }) {
  const { pending, error, notice, setError, setNotice, run } = useSetAction();
  const [open, setOpen] = useState(false);
  const item = "hover:bg-muted flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold disabled:opacity-50";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/shared/${id}`);
      setNotice("Đã sao chép link chia sẻ.");
    } catch {
      setError("Không sao chép được link. Hãy thử lại.");
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Thao tác khác"
          className="bg-card hover:bg-muted grid size-11 place-items-center rounded-2xl border-2 shadow-[0_3px_0_var(--border)]"
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 rounded-2xl p-1.5">
          <Link href={`/sets/${id}/edit`} className={item}><Pencil aria-hidden="true" className="size-4" /> Sửa tên và mô tả</Link>
          <button type="button" className={item} disabled={pending} onClick={() => { setOpen(false); void run(() => duplicateSet(id), true); }}>
            <Copy aria-hidden="true" className="size-4" /> Nhân bản
          </button>
          {visibility !== "private" ? (
            <button type="button" className={item} onClick={() => void copyLink()}>
              <Link2 aria-hidden="true" className="size-4" /> Sao chép link chia sẻ
            </button>
          ) : null}
          <div className="my-1 border-t" />
          <button
            type="button"
            className={cn(item, "text-destructive")}
            disabled={pending}
            onClick={() => { setOpen(false); if (window.confirm("Xoá bộ từ và tất cả thẻ?")) void run(() => deleteSet(id), true); }}
          >
            <Trash2 aria-hidden="true" className="size-4" /> Xoá bộ từ
          </button>
        </PopoverContent>
      </Popover>
      {error || notice ? (
        <p role={error ? "alert" : "status"} className={cn("absolute top-full right-0 mt-2 w-max max-w-64 text-right text-xs font-bold", error ? "text-destructive" : "text-primary-edge")}>
          {error || notice}
        </p>
      ) : null}
    </div>
  );
}

/** Compact sharing and folder controls shown under the set title. */
export function SetSettings({ id, visibility, folders = [], folderId = null }: {
  id: string;
  visibility: SetInput["visibility"];
  folders?: { id: string; name: string }[];
  folderId?: string | null;
}) {
  const { pending, error, run } = useSetAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm font-bold">
        <Globe aria-hidden="true" className="text-muted-foreground size-4" />
        <span className="sr-only">Chia sẻ</span>
        <Select disabled={pending} value={visibility} onValueChange={(value) => run(() => changeVisibility(id, value as SetInput["visibility"]))}>
          <SelectTrigger aria-label="Chia sẻ" className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Riêng tư</SelectItem>
            <SelectItem value="unlisted">Có link</SelectItem>
            <SelectItem value="public">Công khai</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {folders.length ? (
        <label className="flex items-center gap-1.5 text-sm font-bold">
          <Folder aria-hidden="true" className="text-muted-foreground size-4" />
          <span className="sr-only">Thư mục</span>
          <Select disabled={pending} value={folderId ?? NO_FOLDER} onValueChange={(value) => run(() => moveSetToFolder(id, value === NO_FOLDER ? null : value))}>
            <SelectTrigger aria-label="Thư mục" className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLDER}>Không có thư mục</SelectItem>
              {folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      ) : null}
      {error ? <p role="alert" className="text-destructive text-xs font-bold">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder, FolderPlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFolder, deleteFolder } from "./folder-actions";

export type FolderOption = { id: string; name: string; count: number };

/** Folder filter for the sets page: all sets, each folder, create and delete folders. */
export function FolderBar({ folders, active, total }: { folders: FolderOption[]; active: string | null; total: number }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await createFolder(name);
    setPending(false);
    if (result.error) { setError(result.error); return; }
    setName("");
    setCreating(false);
    router.push(`/sets?folder=${result.id}`);
  }

  async function remove(id: string) {
    if (!window.confirm("Xoá thư mục này? Các bộ từ bên trong vẫn được giữ lại.")) return;
    setPending(true);
    const result = await deleteFolder(id);
    setPending(false);
    if (result.error) { setError(result.error); return; }
    router.push("/sets");
  }

  const chip = (selected: boolean) => cn(
    "inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
    selected ? "border-primary bg-primary/10 text-primary-edge" : "bg-card hover:bg-muted",
  );

  return (
    <div className="space-y-2">
      <nav aria-label="Thư mục" className="flex flex-wrap items-center gap-2">
        <Link href="/sets" aria-current={active ? undefined : "page"} className={chip(!active)}>
          Tất cả <span className="tabular-nums opacity-70">{total}</span>
        </Link>
        {folders.map((folder) => (
          <Link key={folder.id} href={`/sets?folder=${folder.id}`} aria-current={active === folder.id ? "page" : undefined} className={chip(active === folder.id)}>
            <Folder aria-hidden="true" className="size-4" /> {folder.name} <span className="tabular-nums opacity-70">{folder.count}</span>
          </Link>
        ))}
        {creating ? (
          <form onSubmit={submit} className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              aria-label="Tên thư mục mới"
              placeholder="Tên thư mục"
              className="bg-card focus-visible:border-primary h-9 w-40 rounded-full border-2 px-3 text-sm font-semibold outline-none"
            />
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>Tạo</Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Huỷ" onClick={() => { setCreating(false); setName(""); }}><X /></Button>
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className={cn(chip(false), "border-dashed")}>
            <FolderPlus aria-hidden="true" className="size-4" /> Thư mục mới
          </button>
        )}
        {active ? (
          <Button type="button" size="sm" variant="ghost" className="text-destructive ml-auto" disabled={pending} onClick={() => void remove(active)}>
            <Trash2 aria-hidden="true" /> Xoá thư mục
          </Button>
        ) : null}
      </nav>
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}
    </div>
  );
}

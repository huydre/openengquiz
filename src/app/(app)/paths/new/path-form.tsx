"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoLoader } from "@/components/layout/logo-loader";
import { levels } from "@/lib/paths/path-data";
import { createPath } from "./actions";

export function PathForm({ sets }: { sets: { id: string; title: string; visibility: string }[] }) {
  const [error, action, pending] = useActionState(createPath, null);
  const [picked, setPicked] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("private");
  const eligible = sets.filter((set) => visibility === "private" || set.visibility === "public");
  const available = eligible.filter((set) => !picked.includes(set.id));
  function move(index: number, offset: number) {
    setPicked((ids) => {
      const copy = [...ids];
      const next = index + offset;
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }
  return (
    <form action={action} className="space-y-5 rounded-3xl border-2 p-5">
      <label className="block space-y-1 font-bold">Tên lộ trình<Input name="title" required maxLength={200} /></label>
      <label className="block space-y-1 font-bold">Mô tả<Input name="description" maxLength={3000} /></label>
      <label className="block space-y-1 font-bold">Nhãn (cách nhau bằng dấu phẩy)<Input name="tags" maxLength={409} /></label>
      <div className="flex flex-wrap gap-4">
        <div><label htmlFor="path-level" className="font-bold">Trình độ</label>
          <Select name="level" defaultValue="B1"><SelectTrigger id="path-level"><SelectValue /></SelectTrigger>
            <SelectContent>{levels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><label htmlFor="path-visibility" className="font-bold">Chia sẻ</label>
          <Select name="visibility" value={visibility} onValueChange={(value) => {
            setVisibility(value);
            if (value === "public") setPicked((ids) => ids.filter((id) => sets.some((set) => set.id === id && set.visibility === "public")));
          }}>
            <SelectTrigger id="path-visibility"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="private">Riêng tư</SelectItem><SelectItem value="public">Công khai</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">Lộ trình công khai chỉ chứa bộ công khai. Khi đổi sang công khai, bộ khác sẽ bị bỏ khỏi danh sách.</p>
      <div><label htmlFor="path-add-set" className="font-bold">Thêm bộ từ</label>
        <Select value="" disabled={!available.length || picked.length >= 100} onValueChange={(id) => setPicked((ids) => [...ids, id])}>
          <SelectTrigger id="path-add-set"><SelectValue placeholder="Chọn bộ từ" /></SelectTrigger>
          <SelectContent>{available.map((set) => <SelectItem key={set.id} value={set.id}>{set.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!eligible.length && <p className="text-muted-foreground">Chưa có bộ từ phù hợp.</p>}
      <ol className="space-y-2">
        {picked.map((id, index) => (
          <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 p-3">
            <input type="hidden" name="sets" value={id} />
            <span className="font-bold">{index + 1}. {sets.find((set) => set.id === id)?.title}</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" aria-label={`Đưa bộ ${index + 1} lên`} disabled={index === 0} onClick={() => move(index, -1)}>Lên</Button>
              <Button type="button" variant="outline" size="sm" aria-label={`Đưa bộ ${index + 1} xuống`} disabled={index === picked.length - 1} onClick={() => move(index, 1)}>Xuống</Button>
              <Button type="button" variant="outline" size="sm" aria-label={`Bỏ bộ ${index + 1}`} onClick={() => setPicked((ids) => ids.filter((value) => value !== id))}>Bỏ</Button>
            </div>
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {pending ? <LogoLoader label="Đang lưu lộ trình" /> : <Button type="submit" disabled={!picked.length}>Lưu lộ trình</Button>}
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { levels } from "@/lib/paths/path-data";

export function AiPathForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/ai/paths", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: form.get("goal"), weeks: Number(form.get("weeks")), level: form.get("level") }),
      });
      const result = await response.json();
      if (response.ok && typeof result.id === "string") {
        router.push(`/paths/${result.id}`);
        return;
      }
      setError(result.error ?? "Không tạo được lộ trình.");
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    }
    setPending(false);
  }
  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border-2 p-5">
      <label className="block space-y-1 font-bold">Mục tiêu<Input name="goal" required maxLength={500} placeholder="Ví dụ: IELTS Speaking band 6.5" /></label>
      <label className="block space-y-1 font-bold">Thời gian học (tuần)<Input type="number" name="weeks" min={1} max={52} defaultValue={4} required /></label>
      <div><label htmlFor="ai-path-level" className="font-bold">Trình độ hiện tại</label>
        <Select name="level" defaultValue="B1"><SelectTrigger id="ai-path-level"><SelectValue /></SelectTrigger>
          <SelectContent>{levels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {pending ? <LogoLoader label="Đang gửi yêu cầu" /> : <Button type="submit">Tạo lộ trình</Button>}
    </form>
  );
}

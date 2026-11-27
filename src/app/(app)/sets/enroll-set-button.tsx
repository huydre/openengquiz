"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrollSetCards } from "./review-actions";

export function EnrollSetButton({ setId }: { setId: string }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function enroll() {
    setPending(true);
    setNotice("");
    try {
      const result = await enrollSetCards(setId);
      setNotice(result.error ?? (result.added ? `Đã thêm ${result.added} thẻ vào ôn tập.` : "Các thẻ đã nằm trong lịch ôn."));
    } catch {
      setNotice("Chưa thêm được thẻ vào ôn tập.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <Button size="lg" variant="outline" onClick={enroll} disabled={pending}>
        <CalendarPlus aria-hidden="true" /> {pending ? "Đang thêm..." : "Thêm vào ôn tập"}
      </Button>
      {notice ? <p role="status" className="text-primary-edge absolute top-full left-0 mt-2 w-max max-w-64 text-xs font-bold">{notice}</p> : null}
    </div>
  );
}

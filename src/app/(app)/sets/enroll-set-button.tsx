"use client";

import { useState } from "react";
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
    <div>
      <Button onClick={enroll} disabled={pending}>{pending ? "Đang thêm..." : "Thêm vào ôn tập"}</Button>
      {notice ? <p role="status" className="mt-2 text-sm">{notice}</p> : null}
    </div>
  );
}

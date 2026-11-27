"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoLoader } from "@/components/layout/logo-loader";
import { buttonVariants } from "@/components/ui/button";

export function PathPending({ updatedAt }: { updatedAt: string }) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const remaining = Date.parse(updatedAt) + 10 * 60_000 - Date.now();
    const poll = setInterval(() => router.refresh(), 5000);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setExpired(true);
    }, Math.max(0, remaining));
    return () => { clearInterval(poll); clearTimeout(timeout); };
  }, [router, updatedAt]);
  return expired ? (
    <div className="space-y-3">
      <p role="alert" className="text-destructive">Quá trình tạo bị gián đoạn. Bạn có thể tạo lại.</p>
      <Link href="/paths/ai" className={buttonVariants()}>Tạo lại bằng AI</Link>
    </div>
  ) : <LogoLoader label="AI đang tạo lộ trình. Bạn có thể quay lại sau." />;
}

import Link from "next/link";
import { isAiConfigured } from "@/lib/ai/client";
import { AiPathForm } from "./ai-path-form";

export default function AiPathPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/paths" className="text-primary font-bold underline">Về lộ trình</Link>
      <h1 className="text-3xl font-black">Tạo lộ trình bằng AI</h1>
      <p className="text-muted-foreground">AI đề xuất tối đa 10 bộ, mỗi bộ tối đa 30 từ. Lộ trình mới chỉ mình bạn thấy.</p>
      {isAiConfigured() ? <AiPathForm /> : <p role="status">AI chưa bật. Bạn vẫn có thể tự tạo lộ trình.</p>}
    </div>
  );
}

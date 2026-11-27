import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LogoLoader } from "@/components/layout/logo-loader";
import { CallSession } from "./call-session";
import { isAiConfigured } from "@/lib/ai/client";
import { CALL_SCENARIOS, callScenarioSchema, MAX_CALL_TURNS } from "@/lib/ai/conversation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Hội thoại AI" };
type Params = Promise<{ setId: string }>;

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<LogoLoader label="Đang tải bộ từ" />}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: Params }) {
  const id = z.uuid().safeParse((await params).setId);
  if (!id.success) notFound();
  const supabase = await createClient();
  const [set, cards, thread] = await Promise.all([
    supabase.from("study_sets").select("id, title").eq("id", id.data).maybeSingle(),
    supabase.from("cards").select("id, term").eq("set_id", id.data).order("position").order("id"),
    // Resume the most recent unfinished call for this set, if any.
    supabase.from("chat_threads").select("id, scenario, summary, chat_messages(id, role, content, created_at)")
      .eq("set_id", id.data).is("summary", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (set.error || cards.error) throw new Error("Không tải được bộ từ.");
  if (!set.data) notFound();
  // A missing chat_threads migration or RLS issue must not break the whole page.
  const threadWarning = thread.error ? "Chưa tải được cuộc gọi đang dở; bạn có thể bắt đầu cuộc gọi mới." : null;

  const messages = (thread.data?.chat_messages ?? [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const scenario = callScenarioSchema.safeParse(thread.data?.scenario);

  return (
    <CallSession
      setId={set.data.id}
      setTitle={set.data.title}
      aiEnabled={isAiConfigured()}
      scenarios={CALL_SCENARIOS.map((s) => ({ id: s.id, label: s.label }))}
      maxTurns={MAX_CALL_TURNS}
      cardCount={cards.data?.length ?? 0}
      resume={thread.data && scenario.success && messages.length
        ? { threadId: thread.data.id, scenario: scenario.data, messages }
        : null}
      warning={threadWarning}
    />
  );
}

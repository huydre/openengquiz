import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LogoLoader } from "@/components/layout/logo-loader";
import { GrammarPractice } from "@/components/grammar/grammar-practice";
import { isAiConfigured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ngữ pháp AI" };
type Params = Promise<{ setId: string }>;

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<LogoLoader label="Đang tải bộ từ" />}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: Params }) {
  const id = z.uuid().safeParse((await params).setId);
  if (!id.success) notFound();
  const supabase = await createClient();
  const [set, cards, wrong] = await Promise.all([
    supabase.from("study_sets").select("title").eq("id", id.data).maybeSingle(),
    supabase.from("cards").select("id, term, definition_vi").eq("set_id", id.data)
      .order("position").order("created_at").order("id"),
    supabase.from("grammar_attempts")
      .select("id, mode, prompt, reference, answer, score, created_at")
      .eq("set_id", id.data).lt("score", 100)
      .order("created_at", { ascending: false }).limit(15),
  ]);
  if (set.error || cards.error) throw new Error("Không tải được bộ từ.");
  if (!set.data) notFound();
  return (
    <>
      {wrong.error && <p role="alert">Chưa tải được các câu cần ôn.</p>}
    <GrammarPractice
      setId={id.data}
      setTitle={set.data.title}
      terms={cards.data ?? []}
      wrongAttempts={wrong.data ?? []}
      aiEnabled={isAiConfigured()}
    />
    </>
  );
}

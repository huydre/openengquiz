import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LogoLoader } from "@/components/layout/logo-loader";
import { SpeakingPractice } from "@/components/speaking/speaking-practice";
import { isAiConfigured } from "@/lib/ai/client";
import { isSpeechServiceConfigured } from "@/lib/speech/client";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Luyện nói" };
type Params = Promise<{ setId: string }>;

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<LogoLoader label="Đang tải bộ từ" />}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: Params }) {
  const id = z.uuid().safeParse((await params).setId);
  if (!id.success) notFound();
  const supabase = await createClient();
  const [set, cards] = await Promise.all([
    supabase.from("study_sets").select("title").eq("id", id.data).maybeSingle(),
    supabase.from("cards").select("id, term").eq("set_id", id.data).order("position").order("id"),
  ]);
  if (set.error || cards.error) throw new Error("Không tải được bộ từ.");
  if (!set.data) notFound();
  return (
    <SpeakingPractice mode="speaking" setId={id.data} setTitle={set.data.title} enabled={isSpeechServiceConfigured()} ai={isAiConfigured()}
      browserStt={!process.env.GROQ_API_KEY && !process.env.SPEECH_SERVICE_URL} cards={cards.data} />
  );
}

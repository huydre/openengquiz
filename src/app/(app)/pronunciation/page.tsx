import { Suspense } from "react";
import { z } from "zod";
import { LogoLoader } from "@/components/layout/logo-loader";
import { SpeakingPractice } from "@/components/speaking/speaking-practice";
import { isSpeechServiceConfigured } from "@/lib/speech/client";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Luyện phát âm" };
type Params = Promise<{ cardId?: string | string[] }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<LogoLoader label="Đang tải bài phát âm" />}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  const id = z.uuid().safeParse((await searchParams).cardId);
  const card = id.success ? await (await createClient()).from("cards").select("id, example_en").eq("id", id.data).maybeSingle() : null;
  return <SpeakingPractice mode="scripted" enabled={isSpeechServiceConfigured()} initialText={card?.data?.example_en ?? ""} cardId={card?.data?.id} />;
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoLoader } from "@/components/layout/logo-loader";
import { VocabLesson, type LessonCard } from "@/components/vocab/vocab-lesson";
import { isSpeechServiceConfigured } from "@/lib/speech/client";

export const metadata = { title: "Học từ mới" };

export default function VocabLessonPage({ params }: PageProps<"/study/[setId]/vocab">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang chuẩn bị bài học..." />}>
      <LessonContent params={params} />
    </Suspense>
  );
}

async function LessonContent({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase.from("study_sets").select("id, title").eq("id", setId).maybeSingle();
  if (!set) notFound();

  const { data: cards, error } = await supabase.from("cards")
    .select("id, term, ipa, part_of_speech, definition_vi, definition_en, example_en, example_vi, synonyms, image_url")
    .eq("set_id", setId).order("position").order("created_at").order("id");
  if (error) throw new Error("Không tải được thẻ.");

  return (
    <VocabLesson
      setId={set.id}
      title={set.title}
      cards={(cards ?? []) as LessonCard[]}
      speechEnabled={isSpeechServiceConfigured()}
    />
  );
}

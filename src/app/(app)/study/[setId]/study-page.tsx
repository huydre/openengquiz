import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudyRunner } from "@/components/study/study-runner";
import type { StudyCard, StudyMode } from "@/lib/study/study-types";
import { LogoLoader } from "@/components/layout/logo-loader";

export function StudyPage({ params, mode }: {
  params: Promise<{ setId: string }>;
  mode: StudyMode;
}) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải bài học..." />}>
      <StudyContent params={params} mode={mode} />
    </Suspense>
  );
}

async function StudyContent({ params, mode }: {
  params: Promise<{ setId: string }>;
  mode: StudyMode;
}) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase.from("study_sets")
    .select("id, title").eq("id", setId).maybeSingle();
  if (!set) notFound();
  const { data: cards, error } = await supabase.from("cards")
    .select("id, term, definition_vi, definition_en, example_en, ipa")
    .eq("set_id", setId).order("position").order("created_at").order("id");
  if (error) throw new Error("Không tải được thẻ.");
  let highScore = 0;
  if (mode === "game") {
    const { data: sessions } = await supabase.from("study_sessions")
      .select("score").eq("set_id", setId).eq("mode", "game").not("finished_at", "is", null)
      .order("score", { ascending: false }).limit(1);
    highScore = sessions?.[0]?.score ?? 0;
  }
  return (
    <StudyRunner setId={set.id} title={set.title} mode={mode}
      cards={(cards ?? []) as StudyCard[]} highScore={highScore} />
  );
}

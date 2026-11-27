import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LogoLoader } from "@/components/layout/logo-loader";
import { ReadingPractice, type ReadingPassageData } from "@/components/reading/reading-practice";
import { isAiConfigured } from "@/lib/ai/client";
import { cefrLevelSchema, type CefrLevel } from "@/lib/ai/reading";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Đọc hiểu AI" };
type Params = Promise<{ setId: string }>;

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<LogoLoader label="Đang tải bộ từ" />}><Content params={params} /></Suspense>;
}

async function Content({ params }: { params: Params }) {
  const id = z.uuid().safeParse((await params).setId);
  if (!id.success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [set, profile] = await Promise.all([
    supabase.from("study_sets").select("id, title").eq("id", id.data).maybeSingle(),
    user
      ? supabase.from("profiles").select("level").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (set.error || profile.error) throw new Error("Không tải được bộ từ.");
  if (!set.data) notFound();

  const level: CefrLevel = cefrLevelSchema.safeParse(profile.data?.level).data ?? "B1";
  // Latest visible passage for this set at the learner's level (own rows + shared cache).
  const { data: passage } = await supabase
    .from("reading_passages")
    .select("id, level, content, questions, target_terms")
    .eq("set_id", id.data)
    .eq("level", level)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ReadingPractice
      setId={id.data}
      title={set.data.title}
      aiEnabled={isAiConfigured()}
      defaultLevel={level}
      initialPassage={(passage as unknown as ReadingPassageData | null) ?? null}
    />
  );
}

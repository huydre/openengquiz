import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashcardViewer } from "@/app/(app)/sets/flashcard-viewer";
import type { CardRecord } from "@/app/(app)/sets/card-record";
import { LogoLoader } from "@/components/layout/logo-loader";

export default function SharedSetPage({ params }: PageProps<"/shared/[id]">) {
  return <Suspense fallback={<LogoLoader label="Đang tải bộ từ..." />}><SharedSetContent params={params} /></Suspense>;
}

async function SharedSetContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase.from("study_sets")
    .select("id, title, description, visibility")
    .eq("id", id).in("visibility", ["unlisted", "public"]).maybeSingle();
  if (!set) notFound();
  const { data: cards, error } = await supabase.from("cards")
    .select("id, position, term, definition_vi, definition_en, part_of_speech, ipa, example_en, example_vi, synonyms")
    .eq("set_id", id).order("position").order("created_at").order("id");

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-8 p-4 md:p-8">
      <p className="text-primary text-lg font-black">OpenEngQuiz</p>
      <div><p className="text-muted-foreground text-sm font-bold uppercase">Bộ từ được chia sẻ</p><h1 className="text-3xl font-black">{set.title}</h1>{set.description ? <p className="text-muted-foreground mt-2">{set.description}</p> : null}</div>
      {error ? <p role="alert" className="text-destructive">Không tải được thẻ.</p> : null}
      {!error && !cards?.length ? <p>Bộ từ này chưa có thẻ.</p> : null}
      {cards?.length ? <FlashcardViewer setId={id} userId="guest" cards={cards as CardRecord[]} /> : null}
    </main>
  );
}

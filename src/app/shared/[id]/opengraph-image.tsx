import { createClient } from "@/lib/supabase/server";
import { OG_SIZE, renderOgImage } from "@/lib/og/og-image";

export const alt = "Bộ từ vựng trên OpenEngQuiz";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Link preview of a shared set: its title, card count and a few of its words. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase.from("study_sets").select("title, cards(count)")
    .eq("id", id).in("visibility", ["unlisted", "public"]).maybeSingle();
  if (!set) {
    return renderOgImage({ eyebrow: "Bộ từ vựng", title: "OpenEngQuiz", subtitle: "Học từ vựng tiếng Anh và luyện nói với AI, miễn phí.", card: { term: "vocabulary", meaning: "từ vựng", label: "noun" } });
  }
  const { data: cards } = await supabase.from("cards").select("term, definition_vi, part_of_speech").eq("set_id", id).order("position").limit(5);
  const count = (set.cards as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
  return renderOgImage({
    eyebrow: `Bộ từ vựng · ${count} thẻ`,
    title: set.title,
    subtitle: "Học bằng thẻ, trắc nghiệm, nghe chép và luyện nói với AI. Miễn phí.",
    chips: (cards ?? []).slice(1).map((card) => card.term).filter((term) => term.length <= 22).slice(0, 3),
    card: {
      term: cards?.[0]?.term ?? set.title,
      meaning: cards?.[0]?.definition_vi ?? undefined,
      label: cards?.[0]?.part_of_speech?.slice(0, 18) || "từ vựng",
    },
  });
}

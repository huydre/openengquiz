import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { SetManagement } from "../set-management";
import { CardList } from "../card-list";
import { CardEditor } from "../card-editor";
import { BulkImport } from "../bulk-import";
import { FlashcardViewer } from "../flashcard-viewer";
import { EnrollSetButton } from "../enroll-set-button";
import type { CardRecord } from "../card-record";
import { LogoLoader } from "@/components/layout/logo-loader";

const studyModes = [
  { slug: "vocab", label: "Học từ mới" },
  { slug: "learn", label: "Học từng bước" },
  { slug: "quiz", label: "Trắc nghiệm" },
  { slug: "dictation", label: "Nghe chép" },
  { slug: "writing", label: "Luyện viết" },
  { slug: "game", label: "Trò chơi" },
  { slug: "worksheet", label: "Phiếu luyện tập" },
  { slug: "speaking", label: "Luyện nói" },
  { slug: "grammar", label: "Ngữ pháp AI" },
  { slug: "reading", label: "Đọc hiểu AI" },
  { slug: "call", label: "Hội thoại AI" },
];

export default function SetDetailPage({ params }: PageProps<"/sets/[id]">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải bộ từ..." />}>
      <SetDetail params={params} />
    </Suspense>
  );
}

async function SetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: set } = await supabase.from("study_sets")
    .select("id, owner_id, title, description, visibility").eq("id", id).maybeSingle();
  if (!set) notFound();
  const { data: cards, error } = await supabase.from("cards")
    .select("id, position, term, definition_vi, definition_en, part_of_speech, ipa, example_en, example_vi, synonyms")
    .eq("set_id", id).order("position").order("created_at").order("id");
  const owner = set.owner_id === user!.id;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href="/sets" className="text-sm font-bold underline">← Bộ từ của tôi</Link>
      <div>
        <p className="text-muted-foreground text-xs font-bold uppercase">
          {set.visibility === "private" ? "Riêng tư" : set.visibility === "unlisted" ? "Có link" : "Công khai"}
        </p>
        <h1 className="text-3xl font-black">{set.title}</h1>
        {set.description ? <p className="text-muted-foreground mt-2">{set.description}</p> : null}
      </div>
      {owner ? <SetManagement id={id} visibility={set.visibility as "private" | "unlisted" | "public"} /> : null}
      {error ? <p role="alert" className="text-destructive">Không tải được thẻ.</p> : null}
      {cards?.length ? (
        <section className="space-y-4 rounded-3xl border-2 p-5">
          <div>
            <h2 className="text-xl font-extrabold">Học bộ từ này</h2>
            <p className="text-muted-foreground text-sm">Chọn cách học phù hợp với bạn.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/study/${id}/learn`} className="bg-primary text-primary-foreground rounded-2xl px-5 py-3 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)]">
              Học tiếp
            </Link>
            <EnrollSetButton setId={id} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {studyModes.map((mode) => (
              <Link key={mode.slug} href={`/study/${id}/${mode.slug}`} className="rounded-2xl border-2 p-3 font-bold hover:border-primary focus-visible:outline-2">
                {mode.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {cards?.length ? (
        <FlashcardViewer
          key={cards.map((card) => `${card.id}:${card.position}`).join(":")}
          setId={id}
          userId={user!.id}
          cards={cards as CardRecord[]}
        />
      ) : null}
      {owner ? (
        <>
          <CardList setId={id} cards={(cards ?? []) as CardRecord[]} />
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold">Thêm thẻ</h2>
            <Link href={`/sets/new/ai?target=${id}`} className={buttonVariants({ variant: "outline" })}>
              Thêm thẻ bằng AI
            </Link>
            <CardEditor setId={id} />
          </section>
          <BulkImport setId={id} />
        </>
      ) : null}
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { SetMenu, SetSettings } from "../set-management";
import { CardList } from "../card-list";
import { CardEditor } from "../card-editor";
import { VocabImport } from "@/components/sets/vocab-import";
import { FlashcardViewer } from "../flashcard-viewer";
import { EnrollSetButton } from "../enroll-set-button";
import type { CardRecord } from "../card-record";
import { SetProgress } from "../set-progress";
import { cardMastery, type CardMastery } from "@/lib/srs/card-mastery";
import { LogoLoader } from "@/components/layout/logo-loader";
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Brain, FileText, Gamepad2, Headphones, ListChecks, MessageCircle,
  Mic, PenLine, Phone, Sparkles, type LucideIcon,
} from "lucide-react";

type StudyMode = { slug: string; label: string; detail: string; icon: LucideIcon; tone: string };

/** Study modes grouped the way learners pick them: learn the words, practise, then use AI. */
const MODE_GROUPS: { title: string; modes: StudyMode[] }[] = [
  {
    title: "Học từ",
    modes: [
      { slug: "vocab", label: "Học từ mới", detail: "Thẻ, phát âm, ví dụ", icon: Sparkles, tone: "bg-primary/15 text-primary-edge" },
      { slug: "learn", label: "Học từng bước", detail: "Nhớ dần theo vòng", icon: BookOpenCheck, tone: "bg-primary/15 text-primary-edge" },
    ],
  },
  {
    title: "Luyện tập",
    modes: [
      { slug: "quiz", label: "Trắc nghiệm", detail: "Chọn nghĩa đúng", icon: ListChecks, tone: "bg-secondary/15 text-secondary-edge" },
      { slug: "dictation", label: "Nghe chép", detail: "Nghe rồi gõ lại", icon: Headphones, tone: "bg-secondary/15 text-secondary-edge" },
      { slug: "writing", label: "Luyện viết", detail: "Gõ từ theo nghĩa", icon: PenLine, tone: "bg-secondary/15 text-secondary-edge" },
      { slug: "game", label: "Trò chơi", detail: "Ghép thẻ tính giờ", icon: Gamepad2, tone: "bg-secondary/15 text-secondary-edge" },
      { slug: "worksheet", label: "Phiếu luyện tập", detail: "In ra giấy", icon: FileText, tone: "bg-secondary/15 text-secondary-edge" },
    ],
  },
  {
    title: "Luyện với AI",
    modes: [
      { slug: "speaking", label: "Luyện nói", detail: "Trả lời, được chấm", icon: Mic, tone: "bg-brand-grape/15 text-brand-grape" },
      { slug: "call", label: "Hội thoại AI", detail: "Gọi điện với gia sư", icon: Phone, tone: "bg-brand-grape/15 text-brand-grape" },
      { slug: "grammar", label: "Ngữ pháp AI", detail: "Đặt câu, được sửa", icon: Brain, tone: "bg-brand-grape/15 text-brand-grape" },
      { slug: "reading", label: "Đọc hiểu AI", detail: "Đoạn văn dùng từ", icon: MessageCircle, tone: "bg-brand-grape/15 text-brand-grape" },
    ],
  },
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
    .select("id, position, term, definition_vi, definition_en, part_of_speech, ipa, example_en, example_vi, synonyms, image_url")
    .eq("set_id", id).order("position").order("created_at").order("id");
  const owner = set.owner_id === user!.id;
  const { data: folderRows } = owner
    ? await supabase.from("folders").select("id, name, folder_sets(set_id)").eq("owner_id", user!.id).order("created_at")
    : { data: [] };
  const folders = (folderRows ?? []).map(({ id: folderId, name }) => ({ id: folderId, name }));
  const currentFolder = (folderRows ?? []).find((folder) => folder.folder_sets?.some((row) => row.set_id === id))?.id ?? null;
  // The learner's schedule for this set's cards drives progress and the flashcard filters.
  const cardIds = (cards ?? []).map((card) => card.id);
  const { data: states } = cardIds.length
    ? await supabase.from("review_states").select("card_id, state, reps").eq("user_id", user!.id).in("card_id", cardIds)
    : { data: [] };
  const mastery: Record<string, CardMastery> = {};
  for (const row of states ?? []) mastery[row.card_id] = cardMastery(row);
  const counts: Record<CardMastery, number> = { new: 0, learning: 0, mastered: 0 };
  for (const id of cardIds) counts[mastery[id] ?? "new"] += 1;

  const visibilityLabel = set.visibility === "private" ? "Riêng tư" : set.visibility === "unlisted" ? "Có link" : "Công khai";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="from-sidebar-accent/60 to-card space-y-5 rounded-3xl border-2 bg-gradient-to-br p-5 shadow-[0_4px_0_var(--border)] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <Link href="/sets" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-bold">
            <ArrowLeft aria-hidden="true" className="size-4" /> Bộ từ của tôi
          </Link>
          {owner ? <SetMenu id={id} visibility={set.visibility as "private" | "unlisted" | "public"} /> : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
            <span className="bg-card rounded-full border-2 px-2.5 py-0.5">{visibilityLabel}</span>
            <span className="bg-card rounded-full border-2 px-2.5 py-0.5">{cardIds.length} thẻ</span>
          </div>
          <h1 className="text-3xl font-black sm:text-4xl">{set.title}</h1>
          {set.description ? <p className="text-muted-foreground font-semibold">{set.description}</p> : null}
        </div>
        {owner ? <SetSettings id={id} visibility={set.visibility as "private" | "unlisted" | "public"} folders={folders} folderId={currentFolder} /> : null}
        <SetProgress counts={counts} />
        {cards?.length ? (
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={`/study/${id}/learn`} className={buttonVariants({ size: "lg" })}>
              Học tiếp <ArrowRight aria-hidden="true" />
            </Link>
            <EnrollSetButton setId={id} />
          </div>
        ) : null}
      </section>

      {error ? <p role="alert" className="text-destructive">Không tải được thẻ.</p> : null}

      {cards?.length ? (
        <section aria-labelledby="modes-title" className="space-y-4">
          <h2 id="modes-title" className="text-xl font-black">Cách học</h2>
          {MODE_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="text-muted-foreground text-xs font-extrabold tracking-wide uppercase">{group.title}</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {group.modes.map((mode) => (
                  <Link
                    key={mode.slug}
                    href={`/study/${id}/${mode.slug}`}
                    className="bg-card flex items-center gap-3 rounded-2xl border-2 p-3 shadow-[0_3px_0_var(--border)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2"
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${mode.tone}`}>
                      <mode.icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{mode.label}</span>
                      <span className="text-muted-foreground block truncate text-xs font-semibold">{mode.detail}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      {cards?.length ? (
        <FlashcardViewer
          key={cards.map((card) => `${card.id}:${card.position}`).join(":")}
          setId={id}
          userId={user!.id}
          cards={cards as CardRecord[]}
          mastery={mastery}
        />
      ) : null}
      {owner ? (
        <>
          <CardList setId={id} cards={(cards ?? []) as CardRecord[]} />
          <section className="space-y-3" aria-labelledby="add-card-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="add-card-title" className="text-xl font-black">Thêm thẻ</h2>
              <Link href={`/sets/new/ai?target=${id}`} className={buttonVariants({ variant: "outline" })}>
                <Sparkles aria-hidden="true" /> Thêm thẻ bằng AI
              </Link>
            </div>
            <CardEditor setId={id} />
          </section>
          <VocabImport setId={id} />
        </>
      ) : null}
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { previewIntervals, type StoredReviewState } from "@/lib/srs/fsrs";
import { vietnamDay } from "@/lib/srs/activity";
import { ReviewSession } from "@/components/review/review-session";
import type { ReviewItem } from "@/components/review/review-types";
import { addDays, dayStartUtc } from "@/components/review/vietnam-day";
import { NewCardLimitSetting } from "./new-card-limit-setting";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Ôn tập" };

type Search = Promise<{ set?: string | string[] }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD_SELECT = "card_id,state,fsrs,due_at,reps,lapses,last_review_at,version,cards!inner(id,set_id,term,ipa,part_of_speech,definition_vi,definition_en,example_en,example_vi,study_sets!inner(id,title))";

export default function ReviewPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải thẻ ôn..." />}>
      <ReviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewContent({ searchParams }: { searchParams: Search }) {
  const { set: setParam } = await searchParams;
  const rawSetId = Array.isArray(setParam) ? setParam[0] : setParam;
  // "all" comes from the filter select (Radix items cannot have an empty value).
  const setId = rawSetId === "all" ? undefined : rawSetId;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/review");

  if (setId && !UUID.test(setId)) {
    return <QueueError message="Mã bộ từ không hợp lệ." />;
  }

  const now = new Date();
  const today = vietnamDay(now);
  const [{ data: profile, error: profileError }, { count: usedNew, error: countError }] = await Promise.all([
    supabase.from("profiles").select("new_cards_per_day").eq("id", user.id).maybeSingle(),
    supabase.from("review_logs").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("was_new", true)
      .gte("reviewed_at", dayStartUtc(today))
      .lt("reviewed_at", dayStartUtc(addDays(today, 1))),
  ]);
  if (profileError || countError) return <QueueError message="Không tải được giới hạn thẻ mới." />;
  const newCardLimit = profile?.new_cards_per_day ?? 20;
  const newRemaining = Math.max(0, newCardLimit - (usedNew ?? 0));

  function dueQuery(state: "new" | "learned") {
    let query = supabase.from("review_states").select(CARD_SELECT)
      .eq("user_id", user!.id).lte("due_at", now.toISOString())
      .order("due_at", { ascending: true });
    query = state === "new" ? query.eq("state", "new") : query.neq("state", "new");
    if (setId) query = query.eq("cards.set_id", setId);
    return query.limit(state === "new" ? newRemaining : 1000);
  }

  const [{ data: learned, error: learnedError }, newResult, { data: setRows, error: setsError }] = await Promise.all([
    dueQuery("learned"),
    newRemaining ? dueQuery("new") : Promise.resolve({ data: [], error: null }),
    supabase.from("review_states")
      .select("cards!inner(set_id,study_sets!inner(id,title))")
      .eq("user_id", user.id).limit(1000),
  ]);
  if (learnedError || newResult.error || setsError) return <QueueError message="Không tải được thẻ ôn. Vui lòng thử lại." />;

  const rows = [...(learned ?? []), ...(newResult.data ?? [])];
  type CardJoin = {
    set_id: string; term: string; ipa: string | null; part_of_speech: string | null;
    definition_vi: string | null; definition_en: string | null;
    example_en: string | null; example_vi: string | null;
    study_sets: { id: string; title: string } | { id: string; title: string }[];
  };
  const items: ReviewItem[] = rows.flatMap((row) => {
    const card = (Array.isArray(row.cards) ? row.cards[0] : row.cards) as CardJoin | undefined;
    const set = Array.isArray(card?.study_sets) ? card.study_sets[0] : card?.study_sets;
    if (!card || !set) return [];
    return [{
      cardId: row.card_id,
      setId: card.set_id,
      setTitle: set.title,
      term: card.term,
      ipa: card.ipa,
      partOfSpeech: card.part_of_speech,
      definitionVi: card.definition_vi,
      definitionEn: card.definition_en,
      exampleEn: card.example_en,
      exampleVi: card.example_vi,
      isNew: row.state === "new",
      intervals: previewIntervals(row as StoredReviewState, now),
    }];
  });
  const setPairs = (setRows ?? []).flatMap((row) => {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    const set = Array.isArray(card?.study_sets) ? card.study_sets[0] : card?.study_sets;
    return card && set ? [[card.set_id, set.title] as [string, string]] : [];
  });
  const sets = [...new Map([...setPairs, ...items.map((item) => [item.setId, item.setTitle] as [string, string])]).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], "vi"));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-black">Ôn tập</h1>
        <p className="text-muted-foreground">Nhớ lại trước khi lật thẻ, rồi chọn mức độ bạn nhớ.</p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/review" className="flex items-center gap-2">
          <label htmlFor="review-set" className="font-bold">Bộ từ</label>
          <Select name="set" defaultValue={setId ?? "all"}>
            <SelectTrigger id="review-set" className="max-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả bộ từ</SelectItem>
              {setId && !sets.some(([id]) => id === setId) ? (
                <SelectItem value={setId}>Bộ đã chọn</SelectItem>
              ) : null}
              {sets.map(([id, title]) => (
                <SelectItem key={id} value={id}>{title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="submit" className="rounded-2xl border-2 px-3 py-2 font-bold">Lọc</button>
        </form>
        <Link href="/stats" className="font-bold text-primary underline underline-offset-4">Xem thống kê</Link>
      </div>
      <NewCardLimitSetting currentLimit={newCardLimit} />
      <ReviewSession
        key={`${setId ?? "all"}:${newCardLimit}`}
        items={items}
        newRemaining={newRemaining}
      />
    </div>
  );
}

function QueueError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-3xl font-black">Ôn tập</h1>
      <p role="alert" className="text-destructive">{message}</p>
      <Link href="/review" className="font-bold text-primary underline">Thử lại với tất cả bộ từ</Link>
    </div>
  );
}

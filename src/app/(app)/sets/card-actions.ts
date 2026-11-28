"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cardTermKey, MAX_GENERATED_CARDS, readSetTerms } from "@/lib/ai/generated-card-data";
import { createClient } from "@/lib/supabase/server";
import { cardSchema, type CardInput } from "@/lib/vocab/card-schema";

type Result = { error?: string };

async function ownedSet(setId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: set } = await supabase.from("study_sets").select("id")
    .eq("id", setId).eq("owner_id", user.id).maybeSingle();
  return set ? supabase : null;
}

export async function addCard(setId: string, input: CardInput): Promise<Result> {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await ownedSet(setId);
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  const { data: last, error: orderError } = await supabase.from("cards")
    .select("position").eq("set_id", setId).order("position", { ascending: false }).limit(1).maybeSingle();
  if (orderError) return { error: "Không đọc được thứ tự thẻ." };
  const { error } = await supabase.from("cards").insert({
    ...parsed.data, set_id: setId, position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: "Không thêm được thẻ." };
  revalidatePath(`/sets/${setId}`);
  return {};
}

export async function updateCard(setId: string, cardId: string, input: CardInput): Promise<Result> {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await ownedSet(setId);
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  const { data, error } = await supabase.from("cards").update(parsed.data)
    .eq("id", cardId).eq("set_id", setId).select("id").maybeSingle();
  if (error || !data) return { error: "Không sửa được thẻ." };
  revalidatePath(`/sets/${setId}`);
  return {};
}

export async function deleteCard(setId: string, cardId: string): Promise<Result> {
  const supabase = await ownedSet(setId);
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  const { data, error } = await supabase.from("cards").delete()
    .eq("id", cardId).eq("set_id", setId).select("id").maybeSingle();
  if (error || !data) return { error: "Không xoá được thẻ." };
  revalidatePath(`/sets/${setId}`);
  return {};
}

export async function moveCard(setId: string, cardId: string, direction: -1 | 1): Promise<Result> {
  if (direction !== -1 && direction !== 1) return { error: "Hướng sắp xếp không hợp lệ." };
  const supabase = await ownedSet(setId);
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  const { data: cards, error } = await supabase.from("cards")
    .select("id, position").eq("set_id", setId).order("position").order("created_at").order("id");
  if (error || !cards) return { error: "Không đọc được thứ tự thẻ." };
  const index = cards.findIndex((card) => card.id === cardId);
  const neighbor = cards[index + direction];
  if (index < 0 || !neighbor) return { error: "Không thể chuyển thẻ theo hướng này." };
  const current = cards[index];
  const temporary = Math.min(...cards.map((card) => card.position)) - 1;
  const first = await supabase.from("cards").update({ position: temporary }).eq("id", current.id).eq("set_id", setId);
  if (first.error) return { error: "Không sắp xếp được thẻ." };
  const second = await supabase.from("cards").update({ position: current.position }).eq("id", neighbor.id).eq("set_id", setId);
  if (second.error) {
    await supabase.from("cards").update({ position: current.position }).eq("id", current.id).eq("set_id", setId);
    return { error: "Không sắp xếp được thẻ." };
  }
  const third = await supabase.from("cards").update({ position: neighbor.position }).eq("id", current.id).eq("set_id", setId);
  if (third.error) {
    await supabase.from("cards").update({ position: neighbor.position }).eq("id", neighbor.id).eq("set_id", setId);
    await supabase.from("cards").update({ position: current.position }).eq("id", current.id).eq("set_id", setId);
    return { error: "Không sắp xếp được thẻ." };
  }
  revalidatePath(`/sets/${setId}`);
  return {};
}

export async function bulkAddCards(setId: string, cards: CardInput[]): Promise<Result> {
  const parsed = z.array(cardSchema).min(1, "Chưa có thẻ để thêm.")
    .max(MAX_GENERATED_CARDS, "Mỗi lần thêm tối đa 50 thẻ.").safeParse(cards);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = issue.path[0];
    return { error: typeof index === "number" ? `Thẻ ${index + 1}: ${issue.message}` : issue.message };
  }
  const supabase = await ownedSet(setId);
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  // Catches duplicates against the saved set; two concurrent saves could still race (would need a transactional RPC).
  let existingTerms: string[];
  try {
    existingTerms = await readSetTerms(supabase, setId);
  } catch {
    return { error: "Không kiểm tra được thẻ trùng. Hãy thử lại." };
  }
  const seen = new Set(existingTerms.map(cardTermKey));
  for (const card of parsed.data) {
    const term = cardTermKey(card.term);
    if (seen.has(term)) return { error: `Từ "${card.term}" bị trùng. Hãy sửa hoặc bỏ chọn thẻ.` };
    seen.add(term);
  }
  const { data: last, error: orderError } = await supabase.from("cards")
    .select("position").eq("set_id", setId).order("position", { ascending: false }).limit(1).maybeSingle();
  if (orderError) return { error: "Không đọc được thứ tự thẻ." };
  const start = (last?.position ?? -1) + 1;
  const { error } = await supabase.from("cards").insert(parsed.data.map((card, index) => ({
    ...card, set_id: setId, position: start + index,
  })));
  if (error) return { error: "Không thêm được thẻ. Hãy thử lại." };
  revalidatePath(`/sets/${setId}`);
  return {};
}

const vocabImportSchema = z.object({
  setId: z.uuid("Mã bộ từ không hợp lệ.").optional(),
  title: z.string().trim().max(200, "Tên bộ từ tối đa 200 ký tự.").optional(),
  cards: z.array(cardSchema).min(1, "Chưa có thẻ để nhập.").max(500, "Mỗi lần nhập tối đa 500 thẻ."),
});

export async function importVocabCards(input: { setId?: string; title?: string; cards: CardInput[] }): Promise<
  { setId: string; added: number; duplicates: string[] } | { error: string }
> {
  const parsed = vocabImportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { setId, title, cards } = parsed.data;

  const supabase = setId ? await ownedSet(setId) : await createClient();
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  const seen = new Set<string>();
  let start = 0;
  if (setId) {
    try {
      for (const term of await readSetTerms(supabase, setId)) seen.add(cardTermKey(term));
    } catch {
      return { error: "Không kiểm tra được thẻ trùng. Hãy thử lại." };
    }
  }
  // ponytail: Same concurrent-write ceiling as bulkAddCards; use an RPC if imports must serialize.
  const duplicates: string[] = [];
  const unique = cards.filter((card) => {
    const key = cardTermKey(card.term);
    if (seen.has(key)) {
      duplicates.push(card.term);
      return false;
    }
    seen.add(key);
    return true;
  });

  let targetId: string;
  let newSetOwner: string | undefined;
  if (setId) {
    if (!unique.length) return { setId, added: 0, duplicates };
    const { data: last, error } = await supabase.from("cards")
      .select("position").eq("set_id", setId).order("position", { ascending: false }).limit(1).maybeSingle();
    if (error) return { error: "Không đọc được thứ tự thẻ." };
    start = (last?.position ?? -1) + 1;
    targetId = setId;
  } else {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Vui lòng đăng nhập lại." };
    const { data: set, error } = await supabase.from("study_sets").insert({
      owner_id: user.id, title: title || "Bộ từ nhập từ file", description: "", visibility: "private",
    }).select("id").single();
    if (error) return { error: "Không tạo được bộ từ. Hãy thử lại." };
    targetId = set.id;
    newSetOwner = user.id;
  }

  const { error } = await supabase.from("cards").insert(unique.map((card, index) => ({
    ...card, set_id: targetId, position: start + index,
  })));
  if (error) {
    if (newSetOwner) {
      const { data: removed, error: rollbackError } = await supabase.from("study_sets").delete()
        .eq("id", targetId).eq("owner_id", newSetOwner).select("id").maybeSingle();
      if (rollbackError || !removed) {
        revalidatePath("/sets");
        return { error: "Không nhập được thẻ và không xoá được bộ từ vừa tạo. Kiểm tra danh sách bộ từ." };
      }
    }
    return { error: "Không nhập được thẻ. Hãy thử lại." };
  }
  revalidatePath("/sets");
  revalidatePath(`/sets/${targetId}`);
  return { setId: targetId, added: unique.length, duplicates };
}

const imageUrlSchema = z.url({ protocol: /^https$/ }).max(1000).nullable();

/** Sets (or clears, with null) the illustration of one card in the learner's own set. */
export async function setCardImage(setId: string, cardId: string, imageUrl: string | null): Promise<Result> {
  const parsed = imageUrlSchema.safeParse(imageUrl);
  if (!parsed.success) return { error: "Link ảnh không hợp lệ." };
  const supabase = await ownedSet(setId);
  if (!supabase) return { error: "Bạn không có quyền sửa bộ từ này." };
  const { data, error } = await supabase.from("cards").update({ image_url: parsed.data })
    .eq("id", cardId).eq("set_id", setId).select("id").maybeSingle();
  if (error || !data) return { error: "Không lưu được ảnh." };
  revalidatePath(`/sets/${setId}`);
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const setSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên bộ từ.").max(200),
  description: z.string().trim().max(2000),
  visibility: z.enum(["private", "unlisted", "public"]),
});

export type SetInput = z.input<typeof setSchema>;
type ActionResult = { error?: string; id?: string };

async function signedInClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function createSet(input: SetInput): Promise<ActionResult> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const context = await signedInClient();
  if (!context) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await context.supabase.from("study_sets").insert({
    ...parsed.data,
    owner_id: context.user.id,
  }).select("id").single();
  if (error) return { error: "Không tạo được bộ từ. Thử lại nhé." };
  revalidatePath("/sets");
  return { id: data.id };
}

export async function updateSet(id: string, input: SetInput): Promise<ActionResult> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const context = await signedInClient();
  if (!context) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await context.supabase.from("study_sets")
    .update(parsed.data).eq("id", id).eq("owner_id", context.user.id).select("id").maybeSingle();
  if (error || !data) return { error: "Không sửa được bộ từ. Kiểm tra quyền truy cập." };
  revalidatePath("/sets");
  revalidatePath(`/sets/${id}`);
  return { id };
}

export async function changeVisibility(id: string, visibility: SetInput["visibility"]): Promise<ActionResult> {
  const parsed = setSchema.shape.visibility.safeParse(visibility);
  if (!parsed.success) return { error: "Chế độ chia sẻ không hợp lệ." };
  const context = await signedInClient();
  if (!context) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await context.supabase.from("study_sets")
    .update({ visibility: parsed.data }).eq("id", id).eq("owner_id", context.user.id)
    .select("id").maybeSingle();
  if (error || !data) return { error: "Không đổi được chế độ chia sẻ." };
  revalidatePath("/sets");
  revalidatePath(`/sets/${id}`);
  return { id };
}

export async function deleteSet(id: string): Promise<ActionResult> {
  const context = await signedInClient();
  if (!context) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await context.supabase.from("study_sets")
    .delete().eq("id", id).eq("owner_id", context.user.id).select("id").maybeSingle();
  if (error || !data) return { error: "Không xoá được bộ từ." };
  revalidatePath("/sets");
  return {};
}

export async function duplicateSet(id: string): Promise<ActionResult> {
  const context = await signedInClient();
  if (!context) return { error: "Vui lòng đăng nhập lại." };
  const { supabase, user } = context;
  const { data: source, error: sourceError } = await supabase.from("study_sets")
    .select("title, description, tags, cover_url").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (sourceError || !source) return { error: "Không tìm thấy bộ từ của bạn." };
  const { data: cards, error: cardsError } = await supabase.from("cards")
    .select("position, term, part_of_speech, ipa, definition_vi, definition_en, example_en, example_vi, synonyms, image_url, audio_url")
    .eq("set_id", id).order("position");
  if (cardsError) return { error: "Không đọc được thẻ để nhân bản." };
  const { data: copy, error: copyError } = await supabase.from("study_sets").insert({
    owner_id: user.id,
    title: `${source.title.slice(0, 200 - " (bản sao)".length)} (bản sao)`,
    description: source.description,
    tags: source.tags,
    cover_url: source.cover_url,
    visibility: "private",
  }).select("id").single();
  if (copyError) return { error: "Không nhân bản được bộ từ." };
  if (cards?.length) {
    const { error } = await supabase.from("cards").insert(cards.map((card) => ({ ...card, set_id: copy.id })));
    if (error) {
      await supabase.from("study_sets").delete().eq("id", copy.id).eq("owner_id", user.id);
      return { error: "Không sao chép được thẻ. Hãy thử lại." };
    }
  }
  revalidatePath("/sets");
  return { id: copy.id };
}

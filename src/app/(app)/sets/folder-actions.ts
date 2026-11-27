"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type FolderResult = { error?: string; id?: string };

const nameSchema = z.string().trim().min(1, "Nhập tên thư mục.").max(100, "Tên thư mục tối đa 100 ký tự.");
const idSchema = z.uuid();

async function signedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Creates a folder for the signed-in learner. */
export async function createFolder(name: string): Promise<FolderResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tên thư mục không hợp lệ." };
  const { supabase, user } = await signedIn();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.from("folders").insert({ owner_id: user.id, name: parsed.data }).select("id").single();
  if (error) return { error: "Chưa tạo được thư mục. Thử lại nhé." };
  revalidatePath("/sets");
  return { id: data.id };
}

/** Deletes a folder; its sets stay and simply leave the folder. */
export async function deleteFolder(id: string): Promise<FolderResult> {
  if (!idSchema.safeParse(id).success) return { error: "Dữ liệu không hợp lệ." };
  const { supabase, user } = await signedIn();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const { error } = await supabase.from("folders").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { error: "Chưa xoá được thư mục. Thử lại nhé." };
  revalidatePath("/sets");
  return {};
}

/** Puts one of the learner's sets in a folder (or no folder). A set lives in at most one folder. */
export async function moveSetToFolder(setId: string, folderId: string | null): Promise<FolderResult> {
  if (!idSchema.safeParse(setId).success || (folderId !== null && !idSchema.safeParse(folderId).success)) {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const { supabase, user } = await signedIn();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const { data: owned } = await supabase.from("study_sets").select("id").eq("id", setId).eq("owner_id", user.id).maybeSingle();
  if (!owned) return { error: "Bạn không thể sắp xếp bộ từ này." };

  // RLS limits both statements to the learner's own folders.
  const { data: mine } = await supabase.from("folders").select("id").eq("owner_id", user.id);
  const myFolders = (mine ?? []).map((folder) => folder.id);
  if (folderId && !myFolders.includes(folderId)) return { error: "Không tìm thấy thư mục." };
  if (myFolders.length) {
    const { error } = await supabase.from("folder_sets").delete().eq("set_id", setId).in("folder_id", myFolders);
    if (error) return { error: "Chưa chuyển được bộ từ. Thử lại nhé." };
  }
  if (folderId) {
    const { error } = await supabase.from("folder_sets").insert({ folder_id: folderId, set_id: setId });
    if (error) return { error: "Chưa chuyển được bộ từ. Thử lại nhé." };
  }
  revalidatePath("/sets");
  revalidatePath(`/sets/${setId}`);
  return {};
}

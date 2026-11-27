"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { DELETE_CONFIRMATION } from "./delete-confirmation";

export type DeleteAccountState = { error: string | null };

/**
 * Self-service account deletion: removes the learner's uploaded card images, then the auth
 * user (every table cascades from profiles), then signs out. The account that owns the shared
 * course content is refused, because deleting it would delete every course for everyone.
 */
export async function deleteAccount(_previous: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  if (formData.get("confirm") !== DELETE_CONFIRMATION) return { error: `Gõ đúng "${DELETE_CONFIRMATION}" để xác nhận.` };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  if (process.env.SEED_CONTENT_OWNER_ID && user.id === process.env.SEED_CONTENT_OWNER_ID) {
    return { error: "Tài khoản này đang sở hữu nội dung khoá học chung nên không thể tự xoá. Hãy chuyển nội dung sang tài khoản khác trước." };
  }
  const admin = createAdminClient();
  if (!admin) return { error: "Chưa xoá được tài khoản lúc này. Thử lại sau nhé." };

  // Uploaded images live under "<user id>/" in the card-images bucket.
  const storage = admin.storage.from("card-images");
  for (let page = 0; page < 50; page += 1) {
    const { data: files, error } = await storage.list(user.id, { limit: 100 });
    if (error || !files?.length) break;
    const { error: removeError } = await storage.remove(files.map((file) => `${user.id}/${file.name}`));
    if (removeError) return { error: "Chưa xoá được ảnh của bạn. Thử lại sau nhé." };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Account deletion failed", error.message);
    return { error: "Chưa xoá được tài khoản lúc này. Thử lại sau nhé." };
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

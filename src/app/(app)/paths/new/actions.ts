"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { pathFields } from "@/lib/paths/path-data";
import { createClient } from "@/lib/supabase/server";

const schema = pathFields.extend({ visibility: z.enum(["private", "public"]), sets: z.array(z.uuid()).min(1).max(100) });

export async function createPath(_: string | null, form: FormData) {
  const parsed = schema.safeParse({
    title: form.get("title"), description: form.get("description"), level: form.get("level"),
    tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    visibility: form.get("visibility"), sets: form.getAll("sets"),
  });
  if (!parsed.success) return "Kiểm tra tên, trình độ, thẻ và danh sách bộ từ (1 đến 100 bộ).";
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/paths/new");
  const { title, description, tags, level, visibility, sets } = parsed.data;
  const { data, error } = await db.rpc("create_learning_path", {
    p_title: title, p_description: description, p_tags: [...new Set(tags)], p_level: level,
    p_visibility: visibility, p_set_ids: sets,
  });
  if (error || !data) return "Không lưu được. Lộ trình công khai chỉ dùng bộ từ công khai.";
  redirect(`/paths/${data}`);
}

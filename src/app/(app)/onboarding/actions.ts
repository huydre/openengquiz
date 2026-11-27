"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  goal: z.enum(["ielts", "toeic", "thpt", "communication", "work"]),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

export async function saveOnboarding(
  _previousError: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = onboardingSchema.safeParse({
    goal: formData.get("goal"),
    level: formData.get("level"),
  });
  if (!parsed.success) return "Hãy chọn mục tiêu và trình độ của bạn.";

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/onboarding");

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return "Chưa lưu được. Bạn thử lại nhé.";

  redirect("/home");
}

export async function skipOnboarding(
  previousError: string | null,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/onboarding");

  const { error } = await supabase.auth.updateUser({
    data: { onboarding_skipped: true },
  });
  if (error) return previousError ?? "Chưa bỏ qua được. Bạn thử lại nhé.";

  redirect("/home");
}

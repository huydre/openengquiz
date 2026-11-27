"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export type NewsletterState = { status: "idle" | "success" | "error"; message: string };

const emailSchema = z.email().max(254);

/**
 * Stores a newsletter sign-up. The hidden "website" field is a honeypot: people never fill it,
 * simple bots do, and those requests are acknowledged without being saved. Signing up twice is
 * reported as success so the form does not reveal which addresses are already on the list.
 */
export async function subscribeNewsletter(_previous: NewsletterState, formData: FormData): Promise<NewsletterState> {
  if (formData.get("website")) return { status: "success", message: "Đã đăng ký. Cảm ơn bạn!" };
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { status: "error", message: "Email chưa đúng định dạng." };

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Chưa đăng ký được lúc này. Thử lại sau nhé." };
  const { error } = await admin.from("newsletter_subscribers").insert({ email: parsed.data });
  if (error && error.code !== "23505") {
    console.error("Newsletter sign-up failed", error.message);
    return { status: "error", message: "Chưa đăng ký được lúc này. Thử lại sau nhé." };
  }
  return { status: "success", message: "Đã đăng ký. Cảm ơn bạn!" };
}

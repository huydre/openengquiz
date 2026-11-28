import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";

/** OAuth / magic-link redirect target: exchanges the one-time code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Supabase sends expired or already-used email links back with error params instead of a code.
  const linkFailed = searchParams.get("error_code") === "otp_expired" || searchParams.has("error_description");
  return NextResponse.redirect(`${origin}/login?error=${linkFailed ? "link" : "auth"}`);
}

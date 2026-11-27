import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/** Supabase client for Server Components, Server Actions and Route Handlers (acts as the signed-in user). */
export async function createClient() {
  // Supabase reads the clock (session expiry) while validating the user; mark the work as
  // request-time so Cache Components never treats it as prerenderable.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only; proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { systemSetIds } from "@/lib/courses/course-sets";
import { LookupForm } from "./lookup-form";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Tra từ" };

export default function LookupPage({ searchParams }: PageProps<"/lookup">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải bộ từ..." />}>
      <LookupPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LookupPageContent({ searchParams }: { searchParams: PageProps<"/lookup">["searchParams"] }) {
  // ?q= opens the page with that word looked up (used by the global search).
  const query = (await searchParams).q;
  const initialTerm = typeof query === "string" ? query.trim().slice(0, 80) : "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: sets }, courseSets] = await Promise.all([
    supabase.from("study_sets").select("id, title").eq("owner_id", user!.id).order("updated_at", { ascending: false }),
    systemSetIds(supabase),
  ]);

  return <LookupForm initialTerm={initialTerm} sets={(sets ?? []).filter((set) => !courseSets.has(set.id))} />;
}

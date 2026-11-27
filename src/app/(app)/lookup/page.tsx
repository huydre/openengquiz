import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LookupForm } from "./lookup-form";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Tra từ" };

export default function LookupPage() {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải bộ từ..." />}>
      <LookupPageContent />
    </Suspense>
  );
}

async function LookupPageContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: sets } = await supabase
    .from("study_sets")
    .select("id, title")
    .eq("owner_id", user!.id)
    .order("updated_at", { ascending: false });

  return <LookupForm sets={sets ?? []} />;
}

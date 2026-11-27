import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai/client";
import { AiCardGenerator } from "./ai-card-generator";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Tạo thẻ bằng AI" };

export default function AiCardPage() {
  return (
    <Suspense fallback={<LogoLoader />}>
      <AiCardPageContent />
    </Suspense>
  );
}

async function AiCardPageContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("level")
    .eq("id", user.id)
    .maybeSingle();

  const { data: sets } = await supabase
    .from("study_sets")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-3xl font-black">Tạo thẻ bằng AI</h1>
      <AiCardGenerator
        userLevel={profile?.level ?? "B1"}
        existingSets={sets ?? []}
        aiEnabled={isAiConfigured()}
      />
    </div>
  );
}

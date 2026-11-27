import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Bắt đầu học" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LogoLoader />}>
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("goal, level")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Không thể tải hồ sơ của bạn.");

  return <OnboardingForm initialGoal={profile?.goal ?? null} initialLevel={profile?.level ?? null} />;
}

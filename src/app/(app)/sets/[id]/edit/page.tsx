import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetForm } from "../../set-form";
import { LogoLoader } from "@/components/layout/logo-loader";

export const metadata = { title: "Sửa bộ từ" };

export default function EditSetPage({ params }: PageProps<"/sets/[id]/edit">) {
  return <Suspense fallback={<LogoLoader />}><EditContent params={params} /></Suspense>;
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: set } = await supabase.from("study_sets").select("title, description, visibility")
    .eq("id", id).eq("owner_id", user!.id).maybeSingle();
  if (!set) notFound();
  return <div className="mx-auto max-w-5xl space-y-6"><h1 className="text-3xl font-black">Sửa bộ từ</h1><SetForm id={id} initial={{ title: set.title, description: set.description ?? "", visibility: set.visibility as "private" | "unlisted" | "public" }} /></div>;
}

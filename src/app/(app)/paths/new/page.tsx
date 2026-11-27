import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoLoader } from "@/components/layout/logo-loader";
import { createClient } from "@/lib/supabase/server";
import { PathForm } from "./path-form";

export default function NewPathPage() {
  return <Suspense fallback={<LogoLoader />}><NewPath /></Suspense>;
}

async function NewPath() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/paths/new");
  const { data, error } = await db.from("study_sets").select("id,title,visibility")
    .or(`owner_id.eq.${user.id},visibility.eq.public`).order("title").order("id");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-black">Tự tạo lộ trình</h1>
      {error ? <p role="alert">Không tải được bộ từ.</p> : <PathForm sets={data} />}
    </div>
  );
}

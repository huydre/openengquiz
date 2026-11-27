import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoLoader } from "@/components/layout/logo-loader";

export default function Page({ params }: PageProps<"/study/[setId]/worksheet">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải phiếu học..." />}>
      <WorksheetContent params={params} />
    </Suspense>
  );
}

async function WorksheetContent({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase.from("study_sets")
    .select("id, title").eq("id", setId).maybeSingle();
  if (!set) notFound();
  const { count } = await supabase.from("cards")
    .select("id", { count: "exact", head: true }).eq("set_id", setId);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/sets/${setId}`} className="text-sm font-bold underline">← {set.title}</Link>
      <div className="rounded-3xl border-2 bg-card p-6 shadow-[0_4px_0_var(--border)]">
        <h1 className="text-3xl font-black">Phiếu luyện viết</h1>
        <p className="mt-3 text-muted-foreground">
          Bảng từ, dòng kẻ luyện viết và bài điền từ cho {count ?? 0} thẻ.
        </p>
        {count ? (
          <a href={`/api/worksheet/${setId}`} className="mt-6 inline-flex rounded-2xl bg-primary px-6 py-3 font-extrabold text-primary-foreground">
            Tải PDF
          </a>
        ) : <p className="mt-6">Bộ từ chưa có thẻ để in.</p>}
      </div>
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { systemSetIds } from "@/lib/courses/course-sets";
import { LogoLoader } from "@/components/layout/logo-loader";
import { FolderBar, type FolderOption } from "./folder-bar";

export const metadata = { title: "Bộ từ của tôi" };

export default function SetsPage({ searchParams }: PageProps<"/sets">) {
  return <Suspense fallback={<LogoLoader label="Đang tải bộ từ..." />}><SetsContent searchParams={searchParams} /></Suspense>;
}

async function SetsContent({ searchParams }: { searchParams: PageProps<"/sets">["searchParams"] }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const requested = (await searchParams).folder;
  const [{ data: ownSets, error }, { data: folderRows }, courseSets] = await Promise.all([
    supabase.from("study_sets")
      .select("id, title, description, visibility, cards(count)")
      .eq("owner_id", user!.id).order("updated_at", { ascending: false }),
    supabase.from("folders").select("id, name, folder_sets(set_id)").eq("owner_id", user!.id).order("created_at"),
    systemSetIds(supabase),
  ]);
  // Only the learner's own sets: course lesson sets live under Khoá học.
  const allSets = ownSets?.filter((set) => !courseSets.has(set.id));
  const folders: FolderOption[] = (folderRows ?? []).map((folder) => ({ id: folder.id, name: folder.name, count: folder.folder_sets?.length ?? 0 }));
  const activeFolder = (folderRows ?? []).find((folder) => folder.id === requested) ?? null;
  const inFolder = new Set(activeFolder?.folder_sets?.map((row) => row.set_id) ?? []);
  const sets = activeFolder ? allSets?.filter((set) => inFolder.has(set.id)) : allSets;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black">Bộ từ của tôi</h1><p className="text-muted-foreground">Gom từ mới và học theo cách của bạn.</p></div>
        <Link href="/sets/new" className="bg-primary text-primary-foreground rounded-2xl px-5 py-3 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)] focus-visible:outline-2 focus-visible:outline-offset-2">Tạo bộ từ</Link>
      </div>
      {error ? <p role="alert" className="text-destructive">Không tải được bộ từ. Vui lòng thử lại.</p> : null}
      {allSets?.length ? <FolderBar folders={folders} active={activeFolder?.id ?? null} total={allSets.length} /> : null}
      {!error && activeFolder && !sets?.length ? (
        <p className="text-muted-foreground rounded-3xl border-2 border-dashed p-8 text-center font-semibold">
          Thư mục này chưa có bộ từ. Mở một bộ từ và chọn thư mục ở phần quản lý.
        </p>
      ) : null}
      {!error && !allSets?.length ? (
        <div className="rounded-3xl border-2 p-8 text-center shadow-[0_4px_0_var(--border)]">
          <p className="text-xl font-extrabold">Bắt đầu với bộ từ đầu tiên nhé!</p>
          <p className="text-muted-foreground mt-2">Bạn có thể thêm từng thẻ hoặc dán nhiều từ một lần.</p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sets?.map((set) => (
          <Link key={set.id} href={`/sets/${set.id}`} className="hover:border-primary focus-visible:border-primary rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)] outline-none transition-colors">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-muted-foreground text-xs font-bold uppercase">{set.visibility === "private" ? "Riêng tư" : set.visibility === "unlisted" ? "Có link" : "Công khai"}</span><span className="text-sm font-bold">{set.cards?.[0]?.count ?? 0} thẻ</span></div>
            <h2 className="text-xl font-extrabold">{set.title}</h2>
            {set.description ? <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{set.description}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

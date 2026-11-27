import { Suspense } from "react";
import Link from "next/link";
import { Map } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSuggestedPaths } from "@/lib/paths/path-data";
import { LogoLoader } from "@/components/layout/logo-loader";
import { PathCard, tagLabel } from "@/components/paths/path-cards";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lộ trình" };

const FILTERS = ["ielts", "toeic", "thpt", "communication"];

export default function PathsPage({ searchParams }: PageProps<"/paths">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải lộ trình..." />}>
      <PathsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PathsContent({ searchParams }: { searchParams: PageProps<"/paths">["searchParams"] }) {
  const tag = (await searchParams).tag;
  const active = typeof tag === "string" && FILTERS.includes(tag) ? tag : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("goal").eq("id", user!.id).maybeSingle();
  const all = await getSuggestedPaths(supabase, profile?.goal ?? null, 60);
  const paths = active ? all.filter((path) => path.tags.includes(active)) : all;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="bg-primary/15 text-primary grid size-14 place-items-center rounded-3xl"><Map className="size-7" aria-hidden="true" /></span>
        <div>
          <h1 className="text-3xl font-black">Lộ trình</h1>
          <p className="text-muted-foreground font-semibold">Các gói bộ từ soạn sẵn theo mục tiêu. Học lần lượt từng bộ, tiến độ được lưu lại.</p>
        </div>
      </div>

      <nav aria-label="Lọc theo mục tiêu" className="flex flex-wrap gap-2">
        {[null, ...FILTERS].map((value) => (
          <Link
            key={value ?? "all"}
            href={value ? `/paths?tag=${value}` : "/paths"}
            aria-current={active === value ? "page" : undefined}
            className={cn(
              "h-10 rounded-2xl border-2 px-4 text-sm leading-9 font-extrabold transition-colors",
              active === value ? "border-primary bg-primary/12 text-primary-edge" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {value ? tagLabel(value) : "Tất cả"}
          </Link>
        ))}
      </nav>

      {paths.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path, index) => <PathCard key={path.id} path={path} index={index} />)}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-3xl border-2 border-dashed p-10 text-center font-semibold">Chưa có lộ trình cho mục tiêu này. Quay lại sau nhé.</p>
      )}
    </div>
  );
}

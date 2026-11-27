import { Suspense } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Khoá học" };

export default function CoursesPage() {
  return <Suspense fallback={<LogoLoader />}><Catalog /></Suspense>;
}

async function Catalog() {
  const db = await createClient();
  const { data, error } = await db.from("courses").select("slug,title,course_levels(id)").order("title");
  if (error) console.error("Course catalog unavailable", error);
  return <main className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-3xl font-black">Khoá học</h1>
    <p className="text-muted-foreground">Học từ mới, luyện nói rồi dùng trong hội thoại.</p>
    {error ? <p role="alert">Chưa tải được danh mục khoá học. Vui lòng thử lại sau.</p> : data.length ? <ul className="grid gap-4 sm:grid-cols-2">{data.map((course) => <li key={course.slug}>
      <Link href={`/courses/${course.slug}`} className="flex items-center gap-4 rounded-3xl border-2 bg-card p-6 shadow-[0_4px_0_var(--border)] hover:border-primary">
        <BookOpen className="size-8 text-primary" aria-hidden /><div><strong className="text-xl">{course.title}</strong><p className="text-sm text-muted-foreground">{course.course_levels.length} cấp độ</p></div>
      </Link>
    </li>)}</ul> : <p>Chưa có khoá học được xuất bản.</p>}
  </main>;
}

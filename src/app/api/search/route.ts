import { NextResponse } from "next/server";
import { systemSetIds } from "@/lib/courses/course-sets";
import { escapeIlike, normalizeSearchQuery } from "@/lib/search/search-query";
import { createClient } from "@/lib/supabase/server";

type SetRow = { id: string; title: string; cards: { count: number }[] };
type PathRow = { slug: string; title: string; level: string; path_items: { count: number }[] };
type LessonRow = { id: string; title: string; course_parts: { course_levels: { title: string; courses: { slug: string } } } };

export async function GET(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const query = normalizeSearchQuery(new URL(request.url).searchParams.get("q"));
  if (!query) return NextResponse.json({ error: "q phải có từ 2 đến 80 ký tự." }, { status: 400 });
  const pattern = `%${escapeIlike(query)}%`;

  try {
    const ownSets = async () => {
      const excluded = await systemSetIds(db);
      let own = db.from("study_sets").select("id,title,cards(count)").eq("owner_id", user.id).ilike("title", pattern)
        .order("updated_at", { ascending: false }).order("id").limit(5);
      if (excluded.size) own = own.not("id", "in", `(${[...excluded].join(",")})`);
      return own.overrideTypes<SetRow[], { merge: false }>();
    };
    const pathQuery = () => db.from("learning_paths").select("slug,title,level,path_items(count)")
      .eq("visibility", "public").eq("status", "ready").not("slug", "is", null).order("title").order("id").limit(5);
    const [own, publicSets, paths, taggedPaths, lessons] = await Promise.all([
      ownSets(),
      db.from("study_sets").select("id,title,cards(count),profiles(display_name)").eq("visibility", "public").neq("owner_id", user.id)
        .ilike("title", pattern).order("updated_at", { ascending: false }).order("id").limit(5)
        .overrideTypes<(SetRow & { profiles: { display_name: string | null } | null })[], { merge: false }>(),
      pathQuery().ilike("title", pattern).overrideTypes<PathRow[], { merge: false }>(),
      /^[a-z]+$/i.test(query)
        ? pathQuery().contains("tags", [query.toLowerCase()]).overrideTypes<PathRow[], { merge: false }>()
        : { data: [], error: null },
      db.from("course_lessons").select("id,title,course_parts!inner(course_levels!inner(title,courses!inner(slug)))")
        .ilike("title", pattern).order("title").order("id").limit(5).overrideTypes<LessonRow[], { merge: false }>(),
    ]);
    if (own.error || publicSets.error || paths.error || taggedPaths.error || lessons.error) {
      throw own.error ?? publicSets.error ?? paths.error ?? taggedPaths.error ?? lessons.error;
    }
    const matches = new Map(paths.data.map((path) => [path.slug, path]));
    for (const path of taggedPaths.data) matches.set(path.slug, path);
    return NextResponse.json({
      sets: own.data.map(({ id, title, cards }) => ({ id, title, cardCount: cards[0]?.count ?? 0 })),
      publicSets: publicSets.data.map(({ id, title, cards, profiles }) => ({ id, title, cardCount: cards[0]?.count ?? 0,
        ownerName: profiles?.display_name?.trim() || "Người học" })),
      paths: [...matches.values()].slice(0, 5).map(({ slug, title, level, path_items }) => ({ slug, title, level, setCount: path_items[0]?.count ?? 0 })),
      lessons: lessons.data.map(({ id, title, course_parts: { course_levels: level } }) => ({
        href: `/courses/${level.courses.slug}/lessons/${id}`, title, levelTitle: level.title,
      })),
    });
  } catch (error) {
    console.error("Search failed", error);
    return NextResponse.json({ error: "Không thể tìm kiếm lúc này." }, { status: 500 });
  }
}

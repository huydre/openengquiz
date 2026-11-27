import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CourseMap, type NotebookCard } from "@/components/courses/course-map";
import { LogoLoader } from "@/components/layout/logo-loader";
import { courseMap, getCourse } from "@/lib/courses/course-data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Khoá học" };
type Props = { params: Promise<{ course: string }> };

export default function CoursePage({ params }: Props) {
  return <Suspense fallback={<LogoLoader />}><CourseContent params={params} /></Suspense>;
}

async function CourseContent({ params }: Props) {
  const { course: slug } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const [profile, courses] = await Promise.all([
    db.from("profiles").select("level").eq("id", user.id).maybeSingle(),
    db.from("courses").select("slug,title").order("title"),
  ]);
  if (profile.error || courses.error) throw new Error("Không tải được khoá học.");
  const current = await getCourse(db, slug, profile.data?.level);
  if (!current?.level) notFound();
  const map = await courseMap(db, current.level.id, user.id);
  const notebook: NotebookCard[] = [];
  for (let start = 0; ; start += 250) {
    const { data: rows, error } = await db.rpc("course_notebook", { p_course: current.course.id }).range(start, start + 249);
    if (error) throw error;
    notebook.push(...rows);
    if (rows.length < 250) break;
  }
  return <CourseMap course={slug} courses={courses.data} level={current.level} levels={current.levels}
    parts={map.parts} completed={[...map.completed]} next={map.next} notebook={notebook} activityByLesson={map.activityByLesson} />;
}

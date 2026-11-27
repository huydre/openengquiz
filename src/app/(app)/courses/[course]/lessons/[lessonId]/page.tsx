import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CourseLesson } from "@/components/courses/course-lesson";
import { LogoLoader } from "@/components/layout/logo-loader";
import { isAiConfigured } from "@/lib/ai/client";
import { getCourseLesson, getLessonPlayerState } from "@/lib/courses/course-data";
import { isSpeechServiceConfigured } from "@/lib/speech/client";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bài học" };
type Props = { params: Promise<{ course: string; lessonId: string }> };

export default function LessonPage({ params }: Props) {
  return <Suspense fallback={<LogoLoader />}><LessonContent params={params} /></Suspense>;
}

async function LessonContent({ params }: Props) {
  const { course, lessonId } = await params;
  if (!z.uuid().safeParse(lessonId).success) notFound();
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) notFound();
  const current = await getCourseLesson(db, lessonId);
  if (!current || current.lesson.course_parts.course_levels.courses.slug !== course) notFound();
  if (!current.open) return <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-black">Bài học chưa mở</h1><p>Hoàn thành các bài trước theo thứ tự để mở bài này.</p><Link href={`/courses/${course}`} className="font-bold text-primary underline">Về bản đồ khoá học</Link></div>;
  const { lesson, map } = current;
  const [{ data: cards, error }, state] = await Promise.all([
    db.from("cards").select("id,term,ipa,part_of_speech,definition_vi,definition_en,example_en,example_vi,synonyms").eq("set_id", lesson.set_id).order("position"),
    getLessonPlayerState(db, lessonId, user.id),
  ]);
  if (error) throw error;
  if (!state) notFound();
  const orderedLessons = map.parts.flatMap((part) => part.course_lessons);
  const following = orderedLessons[orderedLessons.findIndex(({ id }) => id === lessonId) + 1]?.id;
  const next = following && (following === map.next || map.completed.has(following)) ? following : undefined;
  return <CourseLesson key={lesson.id} course={course} lesson={lesson} cards={cards}
    partNumber={lesson.course_parts.position + 1} lessonNumber={lesson.position + 1}
    step={state.step} completed={state.complete} history={state.attempts} first={state.first} second={state.second}
    tone={state.tone} comparison={state.comparison} weakTerms={state.weakTerms} calling={state.calling}
    speech={isSpeechServiceConfigured()} ai={isAiConfigured()} next={next} resume={state.call} />;
}

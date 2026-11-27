import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CourseActivityLesson } from "@/components/courses/course-activity-lesson";
import { CourseLesson } from "@/components/courses/course-lesson";
import { LogoLoader } from "@/components/layout/logo-loader";
import { isAiConfigured } from "@/lib/ai/client";
import { getCourseLesson, getLessonPlayerState } from "@/lib/courses/course-data";
import type { LessonFeedback } from "@/lib/courses/lesson-player-types";
import { isSpeechServiceConfigured } from "@/lib/speech/client";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bài học" };
type Props = { params: Promise<{ course: string; lessonId: string }>; searchParams: Promise<{ activity?: string | string[] }> };

export default function LessonPage(props: Props) {
  return <Suspense fallback={<LogoLoader />}><LessonContent {...props} /></Suspense>;
}

async function LessonContent({ params, searchParams }: Props) {
  const { course, lessonId } = await params;
  if (!z.uuid().safeParse(lessonId).success) notFound();
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) notFound();
  const current = await getCourseLesson(db, lessonId, user.id);
  if (!current || current.lesson.course_parts.course_levels.courses.slug !== course) notFound();
  if (!current.open) return <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-black">Bài học chưa mở</h1><p>Hoàn thành các bài trước theo thứ tự để mở bài này.</p><Link href={`/courses/${course}`} className="font-bold text-primary underline">Về bản đồ khoá học</Link></div>;
  const { lesson, map } = current;
  const [{ data: cards, error }, state] = await Promise.all([
    db.from("cards").select("id,term,ipa,part_of_speech,definition_vi,definition_en,example_en,example_vi,synonyms").eq("set_id", lesson.set_id).order("position").order("id"),
    getLessonPlayerState(db, lessonId, user.id),
  ]);
  if (error) throw error;
  if (!state) notFound();
  const orderedLessons = map.parts.flatMap((part) => part.course_lessons);
  const following = orderedLessons[orderedLessons.findIndex(({ id }) => id === lessonId) + 1]?.id;
  if (lesson.activity_content) {
    const [{ activity }, { data: attempts, error: attemptError }] = await Promise.all([
      searchParams,
      db.from("speaking_attempts").select("id,activity,activity_step,transcript,feedback")
        .eq("lesson_id", lessonId).eq("user_id", user.id).eq("mode", "speaking")
        .not("activity", "is", null).order("created_at", { ascending: false }).order("id", { ascending: false }),
    ]);
    if (attemptError) throw attemptError;
    return <CourseActivityLesson key={`${lessonId}:${typeof activity === "string" ? activity : ""}`}
      course={course} lesson={lesson} cards={cards} content={lesson.activity_content}
      partNumber={lesson.course_parts.position + 1} lessonNumber={lesson.position + 1}
      progress={map.activityByLesson.get(lessonId) ?? []}
      attempts={attempts.flatMap((row) => row.activity && row.activity_step ? [{
        id: row.id, activity: row.activity, smallStep: row.activity_step,
        transcript: row.transcript, feedback: row.feedback as LessonFeedback | null,
      }] : [])}
      initialActivity={typeof activity === "string" && /^[1-7]$/.test(activity) ? Number(activity) : undefined}
      tone={state.tone} speech={isSpeechServiceConfigured()} ai={isAiConfigured()} next={following} call={state.call} />;
  }
  const next = following && (following === map.next || map.completed.has(following)) ? following : undefined;
  return <CourseLesson key={lesson.id} course={course} lesson={lesson} cards={cards}
    partNumber={lesson.course_parts.position + 1} lessonNumber={lesson.position + 1}
    step={state.step} completed={state.complete} history={state.attempts} first={state.first} second={state.second}
    tone={state.tone} comparison={state.comparison} weakTerms={state.weakTerms} calling={state.calling}
    speech={isSpeechServiceConfigured()} ai={isAiConfigured()} next={next} resume={state.call} />;
}

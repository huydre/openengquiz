import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CourseLesson } from "@/components/courses/course-lesson";
import { LogoLoader } from "@/components/layout/logo-loader";
import { isAiConfigured } from "@/lib/ai/client";
import { getCourseLesson } from "@/lib/courses/course-data";
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
  const current = await getCourseLesson(db, lessonId);
  if (!current || current.lesson.course_parts.course_levels.courses.slug !== course) notFound();
  if (!current.open) return <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-black">Bài học chưa mở</h1><p>Hoàn thành các bài trước theo thứ tự để mở bài này.</p><Link href={`/courses/${course}`} className="font-bold text-primary underline">Về bản đồ khoá học</Link></div>;
  const { lesson, progress, map } = current;
  const { data: cards, error } = await db.from("cards").select("id,term,ipa,part_of_speech,definition_vi,definition_en,example_en,example_vi,synonyms").eq("set_id", lesson.set_id).order("position");
  if (error) throw error;
  let resume = null;
  if (progress?.step === 4 && !progress.completed_at) {
    const thread = await db.from("chat_threads").select("id,chat_messages!inner(id)").eq("set_id", lesson.set_id).eq("scenario", "course")
      .order("created_at", { ascending: false }).order("id").limit(1).maybeSingle();
    if (thread.error) throw thread.error;
    if (thread.data) {
      const messages = await db.from("chat_messages").select("role,content").eq("thread_id", thread.data.id).order("created_at").order("id");
      if (messages.error) throw messages.error;
      if (messages.data.length) resume = { threadId: thread.data.id, scenario: "course", messages: messages.data.map(({ role, content }) => ({ role: role === "user" ? "user" as const : "assistant" as const, content })) };
    }
  }
  return <CourseLesson course={course} lesson={lesson} cards={cards} step={progress?.step ?? 1} completed={Boolean(progress?.completed_at)} comparison={progress?.comparison ?? undefined}
    speech={isSpeechServiceConfigured()} ai={isAiConfigured()} next={map.next} resume={resume} />;
}

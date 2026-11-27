import { z } from "zod";

/**
 * Tutor narration lines for course lessons. Each line is a short English cue the tutor
 * speaks, plus a Vietnamese translation shown as a subtitle. Generated per lesson by the
 * LLM and cached in `lesson_narration`; fixed fallbacks below are used when AI is off or
 * generation fails. Safe to import from client components (types and constants only).
 */

export const narrationKindSchema = z.enum(["intro", "transition", "retry"]);
export type NarrationKind = z.infer<typeof narrationKindSchema>;

export const narrationLineSchema = z.object({
  en: z.string().trim().min(1).max(300), // /api/tts accepts at most 300 chars
  vi: z.string().trim().min(1).max(400),
});
export type NarrationLine = z.infer<typeof narrationLineSchema>;

export const narrationLinesSchema = z.array(narrationLineSchema).min(1).max(6);
/** Fixed intro used when AI is unavailable; names the lesson topic per the brief. */
export function introNarration(title: string): NarrationLine[] {
  return [
    {
      en: `Hi there! I'm your English tutor for "${title}".`,
      vi: `Chào bạn! Mình là gia sư tiếng Anh của bài "${title}".`,
    },
    {
      en: "Today we will practise answering a question about the topic.",
      vi: "Hôm nay chúng ta sẽ luyện trả lời một câu hỏi về chủ đề.",
    },
    {
      en: "First you will try to answer on your own, then we learn useful words to say it better.",
      vi: "Trước tiên bạn tự trả lời, sau đó mình học thêm từ để nói hay hơn.",
    },
  ];
}

export const INTRO_NARRATION: NarrationLine[] = introNarration("this lesson");

/** Fixed transition used between the speaking warm-up and the vocabulary cards. */
export const TRANSITION_NARRATION: NarrationLine[] = [
  {
    en: "Nice try! Now let's learn some words to make your answer even better.",
    vi: "Cố gắng tốt! Giờ mình học thêm vài từ để câu trả lời hay hơn.",
  },
];

/** Fixed line before the learner answers the warm-up question a second time. */
export const RETRY_NARRATION: NarrationLine[] = [
  {
    en: "Let's try the question again. You can do it!",
    vi: "Mình thử trả lời câu hỏi lần nữa nhé. Bạn làm được!",
  },
];

export const FALLBACK_NARRATION: Record<Exclude<NarrationKind, "intro">, NarrationLine[]> = {
  transition: TRANSITION_NARRATION,
  retry: RETRY_NARRATION,
};

/** Fixed lines per kind; intro names the lesson title when provided. */
export function fallbackNarration(kind: NarrationKind, title?: string): NarrationLine[] {
  if (kind === "intro") return introNarration(title?.trim() || "this lesson");
  return FALLBACK_NARRATION[kind];
}

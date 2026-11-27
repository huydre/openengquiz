import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callScenarioSchema, type CallMessage, type CallScenarioId, type CallTargetTerm } from "./conversation-types";
import { cefrSchema } from "./speaking-feedback";

export interface CallThreadRow {
  id: string;
  set_id: string;
  scenario: string;
  summary: unknown;
}

export interface CallContext {
  scenario: CallScenarioId;
  level: string;
  terms: CallTargetTerm[];
  /** Course calls: the lesson's call scenario (v2) or warmup question; undefined for standalone scenarios. */
  topic?: string;
  /** Persisted chat history in display order (created_at, id). */
  messages: CallMessage[];
}

export async function loadCallThread(supabase: SupabaseClient, threadId: string, signal: AbortSignal) {
  const { data, error } = await supabase.from("chat_threads")
    .select("id, set_id, scenario, summary").eq("id", threadId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return data as CallThreadRow | null;
}

/**
 * Loads everything an AI call turn or assist request needs: scenario, learner
 * level, the set's target terms, lesson topic (course calls) and persisted
 * message history. Shared by the turn and assist routes so message indexing
 * stays consistent.
 */
export async function loadCallContext(
  supabase: SupabaseClient,
  thread: CallThreadRow,
  userId: string,
  signal: AbortSignal,
): Promise<CallContext> {
  const [cards, profile, messages] = await Promise.all([
    supabase.from("cards").select("term, definition_vi").eq("set_id", thread.set_id)
      .order("position").order("created_at").order("id").limit(60).abortSignal(signal),
    supabase.from("profiles").select("level").eq("id", userId).abortSignal(signal).maybeSingle(),
    supabase.from("chat_messages").select("role, content").eq("thread_id", thread.id)
      .order("created_at").order("id").limit(200).abortSignal(signal),
  ]);
  signal.throwIfAborted();
  if (cards.error || profile.error || messages.error) throw new Error("Could not load call context");
  const scenario = callScenarioSchema.safeParse(thread.scenario);
  if (!scenario.success) throw new Error("Unknown scenario");
  const level = cefrSchema.safeParse(profile.data?.level).data ?? "B1";
  const terms: CallTargetTerm[] = (cards.data ?? []).map((c) => ({ term: c.term, definition_vi: c.definition_vi }));
  const history: CallMessage[] = (messages.data ?? []).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));
  let topic: string | undefined;
  if (scenario.data === "course") {
    // v2 lessons carry a written call scenario; older lessons fall back to the warmup question.
    const lesson = await supabase.from("course_lessons").select("warmup_question, activity_content")
      .eq("set_id", thread.set_id).abortSignal(signal).single();
    if (lesson.error) throw lesson.error;
    const content = lesson.data.activity_content as { conversation?: unknown } | null;
    topic = typeof content?.conversation === "string" && content.conversation.trim()
      ? content.conversation.trim()
      : lesson.data.warmup_question;
  }
  return { scenario: scenario.data, level, terms, messages: history, topic };
}

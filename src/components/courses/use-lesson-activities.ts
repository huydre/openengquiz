"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Shared POST helper for POST /api/courses/lessons/[lessonId]/activities.
 * Sends JSON `{action, activity, smallStep, ...fields}` or multipart FormData
 * when `audio` is provided (used by the `pronunciation` action). Throws an
 * Error carrying the server's message on failure.
 *
 * `busy` is true only while a progress write (checkpoint/complete/start_call)
 * is in flight; answer/feedback/pronunciation/word_question/ideas calls do not
 * block it, so a slow AI call never freezes navigation.
 */
export type ActivityPostFn = <T>(
  action: string,
  activity: number,
  smallStep: number,
  fields?: Record<string, unknown>,
  audio?: Blob,
) => Promise<T>;

/** Actions that move the learner forward and therefore flip `busy`. */
const PROGRESS_ACTIONS: Record<string, true> = {
  checkpoint: true,
  complete: true,
  start_call: true,
};

export function useLessonActivities(lessonId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(0);
  const seq = useRef(0);

  const post = useCallback<ActivityPostFn>(async (action, activity, smallStep, fields = {}, audio) => {
    const id = ++seq.current;
    const isProgress = PROGRESS_ACTIONS[action] === true;
    if (isProgress) {
      pending.current += 1;
      setBusy(true);
    }
    setError("");
    try {
      let body: BodyInit;
      let headers: Record<string, string> | undefined;
      if (audio) {
        const form = new FormData();
        form.set("action", action);
        form.set("activity", String(activity));
        form.set("smallStep", String(smallStep));
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null) form.set(key, String(value));
        }
        form.set("audio", audio, "recording.wav");
        body = form;
      } else {
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({ action, activity, smallStep, ...fields });
      }
      const response = await fetch(`/api/courses/lessons/${lessonId}/activities`, {
        method: "POST",
        headers,
        body,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        throw new Error(result?.error ?? "Chưa lưu được hoạt động. Hãy thử lại.");
      }
      return result as never;
    } catch (cause) {
      // Only the latest request may surface an error; stale failures are dropped.
      if (id === seq.current) {
        setError(cause instanceof Error ? cause.message : "Chưa lưu được hoạt động.");
      }
      throw cause;
    } finally {
      if (isProgress) {
        pending.current = Math.max(0, pending.current - 1);
        if (pending.current === 0) setBusy(false);
      }
    }
  }, [lessonId]);

  const clearError = useCallback(() => setError(""), []);

  return { post, busy, error, clearError };
}

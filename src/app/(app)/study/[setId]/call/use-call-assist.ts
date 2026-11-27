"use client";

import { useState } from "react";
import type { CallAssistAction } from "@/lib/ai/conversation-types";
import { cleanCallText, postCallJson } from "./call-client";

export type CallAssistState = {
  result: Partial<Record<CallAssistAction, string>>;
  request: (action: CallAssistAction) => Promise<void>;
  busy: boolean;
  error: string;
};

export function useCallAssist(threadId: string, index: number): CallAssistState {
  const [result, setResult] = useState<CallAssistState["result"]>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function request(action: CallAssistAction) {
    if (result[action] || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await postCallJson<{ text: string }>(`/api/conversation/${threadId}/assist`, { action, messageIndex: index });
      setResult((old) => ({ ...old, [action]: cleanCallText(data.text) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tải được trợ giúp.");
    } finally {
      setBusy(false);
    }
  }
  return { result, request, busy, error };
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { CallSummary } from "@/lib/ai/conversation-types";
import { createCallReplyAudio, type CallReplyAudio } from "@/lib/speech/call-reply-audio";
import { useCallMic } from "@/lib/speech/use-call-mic";
import { cleanCallText, postCallJson, readCallReply } from "./call-client";

export type CallView = "call" | "chat";
export type CallMessage = { role: "user" | "assistant"; content: string; terms?: string[] };
export type CallScenarioOption = { id: string; label: string };
export type CallSessionOptions = {
  setId: string;
  aiEnabled: boolean;
  scenarios: CallScenarioOption[];
  cardCount: number;
  maxTurns: number;
  resume: { threadId: string; scenario: string; messages: CallMessage[]; finished?: boolean } | null;
  onComplete?: (threadId: string) => Promise<void>;
};

export type CallSessionState = {
  threadId: string;
  scenario: string;
  setScenario: (scenario: string) => void;
  messages: CallMessage[];
  userTurns: number;
  assistantIndex: number;
  assistant: CallMessage | undefined;
  summary: CallSummary | undefined;
  finished: boolean;
  ended: boolean;
  canFinish: boolean;
  view: CallView;
  keyboard: boolean;
  typed: string;
  setTyped: (text: string) => void;
  busy: "start" | "turn" | "finish" | undefined;
  streaming: string;
  pendingText: string | undefined;
  error: string;
  state: "idle" | "listening" | "speaking" | "thinking";
  speaking: boolean;
  micActive: boolean;
  micLevel: number;
  canTalk: boolean;
  silence: boolean;
  guided: boolean;
  offerGuide: boolean;
  consent: boolean;
  paused: boolean;
  startCall: () => Promise<void>;
  changeView: (view: CallView, showKeyboard?: boolean) => void;
  sendTurn: (input: Blob | string) => Promise<void>;
  talk: () => void;
  replay: (text: string, listenAfter?: boolean) => void;
  allowMic: () => void;
  finishCall: () => Promise<void>;
  pauseCall: () => void;
  resumeCall: () => void;
  newCall: () => void;
  enableGuide: () => void;
  dismissGuide: () => void;
  toggleKeyboard: () => void;
};

export function useCallSession({ setId, aiEnabled, scenarios, maxTurns, cardCount, resume, onComplete }: CallSessionOptions): CallSessionState {
  const [threadId, setThreadId] = useState(resume?.threadId ?? "");
  const [scenario, setScenario] = useState(resume?.scenario ?? scenarios[0]?.id ?? "");
  const [messages, setMessages] = useState<CallMessage[]>(resume?.messages ?? []);
  const [summary, setSummary] = useState<CallSummary>();
  const [finished, setFinished] = useState(resume?.finished ?? false);
  const [view, setView] = useState<CallView>("call");
  const [keyboard, setKeyboard] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"start" | "turn" | "finish">();
  const [streaming, setStreaming] = useState("");
  const [pendingText, setPendingText] = useState<string>();
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  // A reply is queued for speech but its audio has not started yet (TTS still generating).
  const [voicePending, setVoicePending] = useState(false);
  const [silence, setSilence] = useState(false);
  const [guided, setGuided] = useState(false);
  const [offerGuide, setOfferGuide] = useState(false);
  const [paused, setPaused] = useState(false);
  const [consent, setConsent] = useState(false);
  const queue = useRef<CallReplyAudio | null>(null);
  const mode = useRef<CallView>("call");
  const request = useRef<AbortController | null>(null);
  const deferredAudio = useRef<Blob | null>(null);
  const micAllowed = useRef(false);
  const userTurns = messages.filter(({ role }) => role === "user").length;
  const ended = finished || userTurns >= maxTurns;
  const assistantIndex = messages.findLastIndex(({ role }) => role === "assistant");
  const assistant = messages[assistantIndex];

  const mic = useCallMic({
    onAudio(audio) {
      if (request.current) deferredAudio.current = audio;
      else void sendTurn(audio);
    },
    onSilence() {
      setSilence(true);
      if (!guided) setOfferGuide(true);
    },
    onError: (reason) => setError(reason === "mic-denied"
      ? "Bạn chưa cấp quyền micro. Hãy kiểm tra quyền trong trình duyệt hoặc dùng bàn phím."
      : "Không mở được micro. Hãy kiểm tra thiết bị hoặc dùng bàn phím."),
  });

  useEffect(() => () => {
    request.current?.abort();
    deferredAudio.current = null;
    queue.current?.stop();
  }, []);

  function stopSpeech() {
    const previous = queue.current;
    queue.current = null;
    previous?.stop();
    setSpeaking(false);
    setVoicePending(false);
  }

  function openQueue() {
    stopSpeech();
    setVoicePending(true);
    const audio = createCallReplyAudio({
      onSpeaking: (value) => {
        setSpeaking(value);
        setVoicePending(false);
      },
      onError: () => setError("Chưa phát được giọng gia sư. Bạn có thể nghe lại hoặc xem câu hỏi."),
    });
    queue.current = audio;
    return audio;
  }

  function listen(clearError = true) {
    if (!micAllowed.current) {
      try { micAllowed.current = localStorage.getItem("openengquiz:mic-consent-v2") === "1"; } catch { /* Storage unavailable. */ }
    }
    if (!micAllowed.current) { setConsent(true); return; }
    setSilence(false);
    setOfferGuide(false);
    if (clearError) setError("");
    mic.start();
  }

  async function drain(audio: CallReplyAudio, listenAfter: boolean) {
    await audio.finish();
    if (queue.current !== audio) return;
    queue.current = null;
    setVoicePending(false);
    if (listenAfter && mode.current === "call") listen(false);
  }

  function replay(text: string, listenAfter = false) {
    mic.cancel();
    const audio = openQueue();
    audio.push(text);
    void drain(audio, listenAfter);
  }

  function changeView(next: CallView, showKeyboard = false) {
    mode.current = next;
    setView(next);
    setKeyboard(next === "chat" && showKeyboard);
    setConsent(false);
    mic.cancel();
    stopSpeech();
    deferredAudio.current = null;
    setSilence(false);
    setOfferGuide(false);
  }

  async function startCall() {
    if (request.current || busy || assistant || !aiEnabled || !cardCount) return;
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setBusy("start");
    try {
      const id = threadId || (await postCallJson<{ threadId: string }>("/api/conversation", { setId, scenario }, controller.signal)).threadId;
      setThreadId(id);
      const data = await postCallJson<{ greeting: string; terms?: string[] }>(`/api/conversation/${id}/turn`, { mode: "text", start: true, expectedTurns: 0 }, controller.signal);
      controller.signal.throwIfAborted();
      const text = cleanCallText(data.greeting);
      setMessages([{ role: "assistant", content: text, terms: data.terms }]);
      if (mode.current === "call") replay(text, true);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tạo được cuộc gọi.");
    } finally {
      request.current = null;
      setBusy(undefined);
    }
  }

  async function sendTurn(input: Blob | string, expected = userTurns) {
    if (!threadId || !assistant || request.current || paused || finished || expected >= maxTurns) return;
    const controller = new AbortController();
    request.current = controller;
    mic.cancel();
    stopSpeech();
    setError("");
    setSilence(false);
    setOfferGuide(false);
    setBusy("turn");
    let text = typeof input === "string" ? input : "";
    setPendingText(text || "Đang chép lời…");
    setTyped("");
    setStreaming("");
    let options: RequestInit;
    if (input instanceof Blob) {
      const form = new FormData();
      form.set("mode", "audio");
      form.set("audio", input, "recording.wav");
      form.set("expectedTurns", String(expected));
      options = { body: form };
    } else {
      options = { headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "text", text, expectedTurns: expected }) };
    }
    const audio = mode.current === "call" ? openQueue() : null;
    let saved = false;
    let streamed = false;
    try {
      const response = await fetch(`/api/conversation/${threadId}/turn`, { ...options, method: "POST", signal: controller.signal });
      const reply = await readCallReply(response, (event) => {
        if (event.type === "transcript") {
          text = event.text;
          setPendingText(text);
        } else if (event.type === "delta") {
          streamed = true;
          setStreaming((previous) => previous + event.text);
          if (audio && queue.current === audio) audio.push(event.text);
        }
      });
      saved = true;
      setMessages((previous) => [...previous, { role: "user", content: text }, { role: "assistant", content: cleanCallText(reply.text), terms: reply.terms }]);
      if (audio && queue.current === audio) {
        if (!streamed) audio.push(reply.text);
        void drain(audio, expected + 1 < maxTurns);
      }
    } catch (cause) {
      if (audio && queue.current === audio) stopSpeech();
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Chưa gửi được lượt nói.");
        if (text) setTyped(text);
      }
    } finally {
      request.current = null;
      setPendingText(undefined);
      setStreaming("");
      setBusy(undefined);
      const next = deferredAudio.current;
      deferredAudio.current = null;
      if (saved && next && expected + 1 < maxTurns) void sendTurn(next, expected + 1);
    }
  }

  function talk() {
    if (paused || consent || busy === "finish" || busy === "start" || !assistant) return;
    if (ended || (busy === "turn" && userTurns + 1 >= maxTurns)) { if (speaking) stopSpeech(); return; }
    if (mic.active) { mic.stop(); return; }
    if (busy === "turn" && !speaking) return;
    stopSpeech();
    listen();
  }

  async function finishCall() {
    if (!threadId || request.current || busy || summary || userTurns < (onComplete ? 4 : 1)) return;
    const controller = new AbortController();
    request.current = controller;
    mic.cancel();
    stopSpeech();
    setError("");
    setBusy("finish");
    try {
      if (finished && onComplete) { await onComplete(threadId); return; }
      const data = await postCallJson<{ summary: CallSummary }>(`/api/conversation/${threadId}/finish`, {}, controller.signal);
      controller.signal.throwIfAborted();
      setFinished(true);
      if (onComplete) await onComplete(threadId);
      else setSummary(data.summary);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa tạo được tổng kết.");
    } finally {
      request.current = null;
      setBusy(undefined);
    }
  }

  function pauseCall() {
    if (busy === "start" || busy === "finish") return;
    mic.cancel();
    stopSpeech();
    deferredAudio.current = null;
    setConsent(false);
    setPaused(true);
  }

  function newCall() {
    setThreadId("");
    setMessages([]);
    setSummary(undefined);
    setFinished(false);
    setPaused(false);
    setGuided(false);
    setError("");
    changeView("call");
  }

  const state = mic.active ? "listening" : speaking ? "speaking" : busy === "turn" || busy === "start" || voicePending ? "thinking" : "idle";
  const canTalk = !paused && !consent && !!assistant && (speaking || (!ended && (mic.active || !busy)));

  function allowMic() {
    micAllowed.current = true;
    try { localStorage.setItem("openengquiz:mic-consent-v2", "1"); } catch { /* Storage unavailable. */ }
    setConsent(false);
    listen();
  }

  return {
    threadId, scenario, setScenario, messages, userTurns, assistantIndex, assistant,
    summary, finished, ended, canFinish: !paused && !busy && !summary && userTurns >= (onComplete ? 4 : 1),
    view, keyboard, typed, setTyped, busy, streaming, pendingText, error, state,
    speaking, micActive: mic.active, micLevel: mic.level, canTalk,
    silence, guided, offerGuide, consent, paused,
    startCall, changeView, sendTurn, talk, replay, allowMic, finishCall, pauseCall, newCall,
    resumeCall: () => setPaused(false),
    enableGuide: () => { setGuided(true); setOfferGuide(false); },
    dismissGuide: () => setOfferGuide(false),
    toggleKeyboard: () => { mic.cancel(); stopSpeech(); deferredAudio.current = null; setKeyboard(!keyboard); },
  };
}

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playTts } from "@/lib/speech/play-tts";
import type { CallSummary } from "@/lib/ai/conversation-types";

type ScenarioOption = { id: string; label: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type Resume = { threadId: string; scenario: string; messages: ChatMessage[]; finished?: boolean };
type Props = {
  setId: string;
  setTitle: string;
  aiEnabled: boolean;
  scenarios: ScenarioOption[];
  cardCount: number;
  maxTurns: number;
  resume: Resume | null;
  warning?: string | null;
  onComplete?: (threadId: string) => Promise<void>;
};

const panel = "space-y-4 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]";
const area = "w-full rounded-2xl border-2 bg-background p-3 focus-visible:outline-2 focus-visible:outline-ring";

async function postJson<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Yêu cầu chưa thành công. Hãy thử lại.");
  return data;
}

/** Reads the NDJSON stream from the turn endpoint and returns the final reply text. */
async function readTurnStream(response: Response, onDelta: (text: string) => void): Promise<string> {
  if (!response.body) throw new Error("Không đọc được phản hồi.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let saved = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { type: string; text?: string; error?: string };
      if (event.type === "delta" && event.text) {
        text += event.text;
        onDelta(event.text);
      } else if (event.type === "done" && event.text) {
        text = event.text;
        saved = true;
      } else if (event.type === "stale") {
        throw new Error("Cuộc gọi đã thay đổi ở nơi khác. Hãy tải lại trang.");
      } else if (event.type === "error") {
        throw new Error(event.error ?? "Chưa tạo được câu trả lời.");
      }
    }
  }
  if (!saved || !text.trim()) throw new Error("Chưa xác nhận được lượt nói. Hãy tải lại trang để tiếp tục.");
  return text;
}

export function CallSession({ setId, setTitle, aiEnabled, scenarios, maxTurns, cardCount, resume, warning, onComplete }: Props) {
  const [threadId, setThreadId] = useState(resume?.threadId ?? "");
  const [scenario, setScenario] = useState(resume?.scenario ?? scenarios[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>(resume?.messages ?? []);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [finished, setFinished] = useState(resume?.finished ?? false);
  const [inputMode, setInputMode] = useState<"voice" | "text">(onComplete ? "text" : "voice");
  const [typed, setTyped] = useState("");
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [busy, setBusy] = useState<"start" | "turn" | "finish">();
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const remaining = maxTurns - userTurns;
  const ended = finished || Boolean(summary) || remaining <= 0;

  function scrollDown() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  function resetForNewCall() {
    setThreadId("");
    setMessages([]);
    setSummary(null);
    setFinished(false);
    setRecording(null);
    setTyped("");
    setError("");
  }

  async function startCall() {
    if (busy || !aiEnabled || !cardCount) return;
    setError("");
    setBusy("start");
    try {
      const id = threadId || (await postJson<{ threadId: string }>("/api/conversation", { setId, scenario })).threadId;
      setThreadId(id);
      // Second step: ask the turn endpoint for the opening greeting.
      const greeting = await postJson<{ greeting: string }>(`/api/conversation/${id}/turn`, {
        mode: "text",
        start: true,
        expectedTurns: 0,
      });
      setMessages([{ role: "assistant", content: greeting.greeting }]);
      setSummary(null);
      setFinished(false);
      void playTts(greeting.greeting);
      scrollDown();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được cuộc gọi.");
    } finally {
      setBusy(undefined);
    }
  }

  async function sendTurn() {
    if (!threadId || busy || ended) return;
    const expected = userTurns;
    let body: FormData | object;
    if (inputMode === "text") {
      const text = typed.trim();
      if (!text) return;
      body = { mode: "text", text, expectedTurns: expected };
    } else {
      if (!recording) return;
      const form = new FormData();
      form.set("mode", "audio");
      form.set("audio", recording.audio, "recording.wav");
      if (recording.transcript.trim()) form.set("transcript", recording.transcript.trim());
      form.set("expectedTurns", String(expected));
      body = form;
    }

    const optimistic: ChatMessage = {
      role: "user",
      content: inputMode === "text" ? typed.trim() : (recording?.transcript.trim() || "(đang chép giọng nói)"),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTyped("");
    setRecording(null);
    setError("");
    setBusy("turn");
    setStreaming("");
    scrollDown();

    try {
      const response = await fetch(`/api/conversation/${threadId}/turn`, body instanceof FormData
        ? { method: "POST", body }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Chưa gửi được lượt nói.");
      }
      const text = await readTurnStream(response, (delta) => {
        setStreaming((prev) => prev + delta);
      });
      setStreaming("");
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      void playTts(text);
      scrollDown();
    } catch (cause) {
      setStreaming("");
      setMessages((prev) => prev.slice(0, -1));
      setError(cause instanceof Error ? cause.message : "Chưa gửi được lượt nói.");
    } finally {
      setBusy(undefined);
    }
  }

  async function finishCall() {
    if (!threadId || busy || summary) return;
    setError("");
    setBusy("finish");
    try {
      if (finished && onComplete) {
        await onComplete(threadId);
        return;
      }
      const data = await postJson<{ summary: CallSummary }>(`/api/conversation/${threadId}/finish`, {});
      setFinished(true);
      if (onComplete) await onComplete(threadId);
      else setSummary(data.summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tạo được tổng kết.");
    } finally {
      setBusy(undefined);
    }
  }

  const canStart = messages.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {onComplete ? <h2 className="text-2xl font-black">Hội thoại theo chủ đề</h2> : <>
          <div>
            <Link href={`/sets/${setId}`} className="text-sm font-bold underline">← {setTitle}</Link>
            <h1 className="text-3xl font-black">Hội thoại AI</h1>
          </div>
          <Link href="/history" className={buttonVariants({ variant: "outline" })}>Lịch sử</Link>
        </>}
      </header>

      {warning && <p role="status" className="rounded-2xl border-2 bg-card p-3 text-sm font-bold">{warning}</p>}
      {!aiEnabled && <p role="status">AI chưa được bật. Bạn chưa thể bắt đầu cuộc gọi.</p>}
      {!cardCount && <p role="status">Bộ từ chưa có thẻ để luyện hội thoại.</p>}

      {canStart && (
        <section className={panel}>
          <h2 className="text-xl font-extrabold">Chọn kịch bản</h2>
          <div className="space-y-2">
            <label htmlFor="call-scenario" className="font-extrabold">Tình huống</label>
            <Select value={scenario} onValueChange={setScenario} disabled={!!busy}>
              <SelectTrigger id="call-scenario" className="max-w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            AI sẽ nhập vai và trò chuyện tiếng Anh theo bộ từ của bạn, tối đa {maxTurns} lượt.
          </p>
          <Button type="button" disabled={!aiEnabled || !cardCount || !!busy} onClick={startCall}>
            Bắt đầu cuộc gọi
          </Button>
          {busy === "start" && <LogoLoader size="sm" label="Đang mở cuộc gọi" />}
        </section>
      )}

      {threadId && !canStart && (
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">{ended ? "Cuộc gọi đã kết thúc" : "Đang gọi"}</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-muted-foreground">Còn {Math.max(remaining, 0)}/{maxTurns} lượt</span>
              {ended && !onComplete && (
                <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={resetForNewCall}>
                  Cuộc gọi mới
                </Button>
              )}
            </div>
          </div>
          <ol className="max-h-[50vh] space-y-3 overflow-y-auto rounded-2xl border-2 bg-background p-4">
            {messages.map((message, index) => (
              <li key={index} className={message.role === "user" ? "text-right" : "text-left"}>
                <span className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-left ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border-2"
                }`}>
                  <span className="mb-1 block text-xs font-extrabold opacity-70">
                    {message.role === "user" ? "Bạn" : "AI"}
                  </span>
                  <span lang="en" className="whitespace-pre-wrap">{message.content}</span>
                </span>
              </li>
            ))}
            {streaming && (
              <li className="text-left">
                <span className="inline-block max-w-[85%] rounded-2xl border-2 bg-card px-4 py-2 text-left">
                  <span className="mb-1 block text-xs font-extrabold opacity-70">AI</span>
                  <span lang="en" className="whitespace-pre-wrap">{streaming}</span>
                </span>
              </li>
            )}
            <div ref={bottomRef} />
          </ol>

          {!ended && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["voice", "text"] as const).map((mode) => (
                  <Button key={mode} type="button" variant={inputMode === mode ? "default" : "outline"}
                    disabled={!!busy} onClick={() => setInputMode(mode)}>
                    {mode === "voice" ? "Nói" : "Gõ chữ"}
                  </Button>
                ))}
              </div>
              {inputMode === "voice" ? (
                <AudioRecorder disabled={!!busy} transcribe={false} onRecording={(next) => {
                  setRecording(next);
                  setError("");
                }} />
              ) : (
                <textarea className={area} lang="en" rows={2} maxLength={2000} value={typed}
                  disabled={!!busy} placeholder="Nhập câu tiếng Anh của bạn..."
                  onChange={(e) => setTyped(e.target.value)} />
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={!!busy || (inputMode === "voice" ? !recording : !typed.trim())}
                  onClick={sendTurn}>
                  {busy === "turn" ? "Đang xử lý..." : "Gửi lượt nói"}
                </Button>
                <Button type="button" variant="outline" disabled={!!busy || userTurns < (onComplete ? 4 : 1)} onClick={finishCall}>
                  Kết thúc cuộc gọi
                </Button>
              </div>
              {busy === "turn" && <LogoLoader size="sm" label="AI đang trả lời" />}
              {busy === "finish" && <LogoLoader size="sm" label="Đang tổng kết" />}
            </div>
          )}
          {ended && !summary && userTurns > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">Bạn đã hết lượt hoặc đã kết thúc cuộc gọi.</p>
              <Button type="button" variant="outline" disabled={!!busy} onClick={finishCall}>
                {busy === "finish" ? "Đang tổng kết..." : "Xem tổng kết"}
              </Button>
              {busy === "finish" && <LogoLoader size="sm" label="Đang tổng kết" />}
            </div>
          )}
        </section>
      )}

      {summary && (
        <section className={panel}>
          <h2 className="text-xl font-extrabold">Tổng kết cuộc gọi</h2>
          <p className="whitespace-pre-wrap">{summary.note_vi}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-extrabold">Từ đã dùng ({summary.used_terms.length})</h3>
              <p lang="en" className="text-sm">{summary.used_terms.join(", ") || "Chưa có"}</p>
            </div>
            <div>
              <h3 className="font-extrabold">Từ chưa dùng ({summary.unused_terms.length})</h3>
              <p lang="en" className="text-sm">{summary.unused_terms.join(", ") || "Đã dùng hết"}</p>
            </div>
          </div>
          {summary.errors.length > 0 && (
            <div>
              <h3 className="font-extrabold">Lỗi hay gặp</h3>
              <ul className="space-y-2 text-sm">
                {summary.errors.map((item, index) => (
                  <li key={index} className="rounded-2xl border-2 p-3">
                    <p lang="en"><span className="line-through opacity-60">{item.original}</span> → <strong>{item.correction}</strong></p>
                    <p className="text-muted-foreground">{item.explanation_vi}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
    </div>
  );
}

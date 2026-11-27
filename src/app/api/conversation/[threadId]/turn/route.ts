import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAiConfigured } from "@/lib/ai/client";
import {
  callScenarioSchema,
  generateCallGreeting,
  MAX_CALL_TURNS,
  streamCallReply,
  type CallMessage,
  type CallScenarioId,
  type CallTargetTerm,
} from "@/lib/ai/conversation";
import { COURSE_CALL_TURNS } from "@/lib/ai/conversation-types";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { cefrSchema } from "@/lib/ai/speaking-feedback";
import { transcribeRecording } from "@/lib/speech/transcribe";
import { MAX_AUDIO_BYTES, wavDuration } from "@/lib/speech/speaking-wav";
import { parseMultipart, readBoundedBody } from "@/lib/http/multipart";
import { createClient } from "@/lib/supabase/server";

const maxBody = MAX_AUDIO_BYTES + 32_768;
const textSchema = z.string().trim().min(1).max(2000);

const turnFields = {
  expectedTurns: z.number().int().min(0).max(MAX_CALL_TURNS),
};
const jsonTurnSchema = z.object({ mode: z.literal("text"), text: textSchema, ...turnFields });
const audioTurnSchema = z.object({
  mode: z.literal("audio"),
  transcript: textSchema.nullable().optional(),
  ...turnFields,
});
const turnSchema = z.discriminatedUnion("mode", [jsonTurnSchema, audioTurnSchema]);
/** Opening request on a fresh thread: no user text, just generates the greeting. */
const startSchema = z.object({ mode: z.literal("text"), start: z.literal(true), expectedTurns: z.literal(0) });

type TurnInput = z.infer<typeof turnSchema> | z.infer<typeof startSchema>;
type AudioTurnInput = Extract<TurnInput, { mode: "audio" }> & { wav?: Blob };

interface ThreadRow {
  id: string;
  set_id: string;
  scenario: string;
  summary: unknown;
}

interface CallContext {
  scenario: CallScenarioId;
  level: string;
  terms: CallTargetTerm[];
  history: CallMessage[];
  topic?: string;
}

async function loadThread(supabase: SupabaseClient, threadId: string, signal: AbortSignal) {
  const { data, error } = await supabase.from("chat_threads")
    .select("id, set_id, scenario, summary").eq("id", threadId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return data as ThreadRow | null;
}

async function loadContext(supabase: SupabaseClient, thread: ThreadRow, userId: string, signal: AbortSignal): Promise<CallContext> {
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
    const lesson = await supabase.from("course_lessons").select("warmup_question").eq("set_id", thread.set_id).abortSignal(signal).single();
    if (lesson.error) throw lesson.error;
    topic = lesson.data.warmup_question;
  }
  return { scenario: scenario.data, level, terms, history, topic };
}

/**
 * One turn of an AI call. Accepts JSON (typed text) or multipart WAV audio
 * (transcribed via Groq when no transcript is supplied). With `start: true` on
 * an empty thread it returns the opening greeting as JSON; otherwise it streams
 * the assistant reply as NDJSON lines: {"type":"delta"} then {"type":"done"}.
 * The user+assistant pair is persisted via append_ai_call_turn before "done" is
 * sent, so the client only finalizes (and plays TTS for) stored replies.
 */
export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
  if (signal.aborted) return new Response(null, { status: 408 });
  try {
    return await handleTurn(request, signal, context);
  } catch (error) {
    if (signal.aborted) return Response.json({ error: "Lượt nói quá lâu. Hãy thử lại." }, { status: 504 });
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof RangeError) return Response.json({ error: "Bản ghi quá lớn." }, { status: 413 });
    console.error("AI call turn failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Chưa trả lời được. Hãy thử lại." }, { status: 502 });
  }
}

async function handleTurn(request: Request, signal: AbortSignal, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  if (!z.uuid().safeParse(threadId).success) return Response.json({ error: "Cuộc gọi không hợp lệ." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập để luyện hội thoại." }, { status: 401 });
  if (!isAiConfigured()) return Response.json({ error: "AI chưa được bật. Hãy thử lại sau." }, { status: 503 });

  const thread = await loadThread(supabase, threadId, signal);
  if (!thread) return Response.json({ error: "Không tìm thấy cuộc gọi." }, { status: 404 });
  if (thread.summary) return Response.json({ error: "Cuộc gọi này đã kết thúc." }, { status: 409 });

  const input = await readTurnInput(request, signal);
  if (input instanceof Response) return input;

  const ctx = await loadContext(supabase, thread, user.id, signal);
  const userTurns = ctx.history.filter((m) => m.role === "user").length;

  // First request on a fresh thread: generate and store the opening greeting.
  if ("start" in input && input.start) {
    if (ctx.history.length !== 0 || input.expectedTurns !== 0) {
      return Response.json({ error: "Cuộc gọi đã được mở. Hãy tải lại trang." }, { status: 409 });
    }
    await assertQuota(supabase, user.id, "conversation");
    signal.throwIfAborted();
    const greeting = await generateCallGreeting({ ...ctx, signal });
    signal.throwIfAborted();
    const { data: saved, error } = await supabase.rpc("start_ai_call", {
      p_thread_id: thread.id,
      p_assistant_text: greeting,
    }).abortSignal(signal);
    if (error) throw error;
    if (saved !== true) return Response.json({ error: "Cuộc gọi đã được mở ở nơi khác." }, { status: 409 });
    await recordUsage(supabase, user.id, "conversation");
    return Response.json({ greeting });
  }

  const maxTurns = ctx.scenario === "course" ? COURSE_CALL_TURNS : MAX_CALL_TURNS;
  if (userTurns >= maxTurns) {
    return Response.json({ error: "Cuộc gọi đã đạt số lượt tối đa. Hãy kết thúc và xem tổng kết." }, { status: 409 });
  }
  if (input.expectedTurns !== userTurns) {
    return Response.json({ error: "Trạng thái cuộc gọi không khớp. Hãy tải lại trang." }, { status: 409 });
  }

  // Quota covers every AI operation in this turn, including Groq transcription.
  await assertQuota(supabase, user.id, "conversation");
  if (!("text" in input) && !("transcript" in input)) return Response.json({ error: "Dữ liệu lượt nói không hợp lệ." }, { status: 400 });
  const userText = input.mode === "text" ? input.text : await resolveTranscript(input, signal);
  if (!userText) {
    return Response.json({ error: "Chưa có bản chép. Hãy nhập câu bạn đã nói rồi thử lại." }, { status: 422 });
  }
  signal.throwIfAborted();

  const remainingTurns = maxTurns - userTurns - 1;
  const result = streamCallReply({
    scenario: ctx.scenario,
    level: ctx.level,
    terms: ctx.terms,
    topic: ctx.topic,
    messages: [...ctx.history, { role: "user", content: userText }],
    remainingTurns,
    signal,
  });

  const encoder = new TextEncoder();
  let fullText = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const delta of result.textStream) {
          fullText += delta;
          send({ type: "delta", text: delta });
        }
        const reply = fullText.trim().slice(0, 2000);
        if (!reply) throw new Error("Empty reply");

        // Persist before signalling done so the client only finalizes stored turns.
        const { data: saved, error } = await supabase.rpc("append_ai_call_turn", {
          p_thread_id: thread.id,
          p_expected_turns: userTurns,
          p_user_text: userText.slice(0, 2000),
          p_assistant_text: reply,
        }).abortSignal(signal);
        if (error) throw error;
        if (saved !== true) {
          // Context went stale (another tab appended); tell the client to reload.
          send({ type: "stale" });
        } else {
          await recordUsage(supabase, user.id, "conversation");
          send({ type: "done", text: reply });
        }
      } catch (error) {
        // Never rethrow here: the finally must close the controller even on abort.
        if (!signal.aborted) {
          console.error("AI call stream failed", error instanceof Error ? error.message : error);
          try { send({ type: "error", error: "Chưa tạo được câu trả lời. Hãy thử lại." }); } catch { /* closed */ }
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      void result.textStream.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readTurnInput(request: Request, signal: AbortSignal): Promise<TurnInput | Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    const bytes = await readBoundedBody(request, maxBody, signal);
    if (!bytes) return Response.json({ error: "Yêu cầu cần có bản ghi WAV." }, { status: 400 });
    const form = await parseMultipart(bytes, contentType);
    const audio = form?.get("audio");
    const transcriptField = form?.get("transcript");
    const expected = Number(form?.get("expectedTurns"));
    const parsed = audioTurnSchema.safeParse({
      mode: "audio",
      transcript: typeof transcriptField === "string" && transcriptField.trim() ? transcriptField.trim().slice(0, 2000) : null,
      expectedTurns: Number.isFinite(expected) ? expected : -1,
    });
    if (!parsed.success || !(audio instanceof File)) {
      return Response.json({ error: "Bản ghi hoặc dữ liệu không hợp lệ." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) throw new RangeError("Oversize WAV");
    const duration = wavDuration(await audio.arrayBuffer());
    if (!duration) return Response.json({ error: "Cần bản ghi WAV PCM 16 kHz mono." }, { status: 400 });
    if (duration > 60) return Response.json({ error: "Bản ghi tối đa 60 giây." }, { status: 413 });
    const wav = audio.slice(0, audio.size, "audio/wav");
    return { ...parsed.data, wav } as AudioTurnInput;
  }
  const raw = await request.json().catch(() => null);
  const parsed = (raw && typeof raw === "object" && (raw as { start?: unknown }).start === true
    ? startSchema
    : turnSchema).safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Dữ liệu lượt nói không hợp lệ." }, { status: 400 });
  return parsed.data;
}

async function resolveTranscript(input: AudioTurnInput, signal: AbortSignal): Promise<string | null> {
  if (input.transcript) return input.transcript;
  if (!input.wav) return null;
  return transcribeRecording(input.wav, signal);
}

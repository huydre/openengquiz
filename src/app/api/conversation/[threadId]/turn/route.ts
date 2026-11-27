import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import {
  cleanCallText,
  generateCallGreeting,
  generateCallTerms,
  MAX_CALL_TURNS,
  selectCallTerms,
  streamCallReply,
} from "@/lib/ai/conversation";
import { loadCallContext, loadCallThread } from "@/lib/ai/conversation-context";
import { COURSE_CALL_TURNS } from "@/lib/ai/conversation-types";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
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


/**
 * One turn of an AI call. Accepts JSON (typed text) or multipart WAV audio
 * (transcribed via Groq when no transcript is supplied). With `start: true` on
 * an empty thread it returns {greeting, terms} as JSON; otherwise it streams
 * NDJSON lines: {"type":"transcript"} once the user text is resolved, then
 * {"type":"delta"} chunks and a final {"type":"done", text, terms}.
 * The user+assistant pair (plus suggested terms) is persisted via
 * append_ai_call_turn before "done" is sent, so the client only finalizes
 * (and plays TTS for) stored replies.
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
    console.error("AI call turn failed", error instanceof Error ? error.name : "Unknown");
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

  const thread = await loadCallThread(supabase, threadId, signal);
  if (!thread) return Response.json({ error: "Không tìm thấy cuộc gọi." }, { status: 404 });
  if (thread.summary) return Response.json({ error: "Cuộc gọi này đã kết thúc." }, { status: 409 });

  const input = await readTurnInput(request, signal);
  if (input instanceof Response) return input;

  const ctx = await loadCallContext(supabase, thread, user.id, signal);
  const userTurns = ctx.messages.filter((m) => m.role === "user").length;

  // First request on a fresh thread: generate and store the opening greeting.
  if ("start" in input && input.start) {
    if (ctx.messages.length !== 0 || input.expectedTurns !== 0) {
      return Response.json({ error: "Cuộc gọi đã được mở. Hãy tải lại trang." }, { status: 409 });
    }
    await assertQuota(supabase, user.id, "conversation");
    signal.throwIfAborted();
    const greeting = await generateCallGreeting({ ...ctx, signal });
    signal.throwIfAborted();
    const terms = selectCallTerms(greeting.terms, ctx.terms);
    const { data: saved, error } = await supabase.rpc("start_ai_call", {
      p_thread_id: thread.id,
      p_assistant_text: greeting.greeting,
      p_terms: terms,
    }).abortSignal(signal);
    if (error) throw error;
    if (saved !== true) return Response.json({ error: "Cuộc gọi đã được mở ở nơi khác." }, { status: 409 });
    await recordUsage(supabase, user.id, "conversation");
    return Response.json({ greeting: greeting.greeting, terms });
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
  const turnMessages = [...ctx.messages, { role: "user" as const, content: userText }];
  // Chips are generated in parallel with the reply stream; a terms failure
  // only costs the chips, never the turn (one quota unit covers both).
  const termsPromise = generateCallTerms({
    level: ctx.level,
    terms: ctx.terms,
    topic: ctx.topic,
    messages: turnMessages,
    signal,
  }).catch(() => [] as string[]);
  const result = streamCallReply({
    scenario: ctx.scenario,
    level: ctx.level,
    terms: ctx.terms,
    topic: ctx.topic,
    messages: turnMessages,
    remainingTurns,
    signal,
  });

  const encoder = new TextEncoder();
  let fullText = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        // Confirm the resolved transcript before the first model delta so the
        // client can swap its "transcribing" placeholder for the real text.
        send({ type: "transcript", text: userText });

        for await (const delta of result.textStream) {
          fullText += delta;
          send({ type: "delta", text: delta });
        }
        const reply = cleanCallText(fullText).slice(0, 2000);
        if (!reply) throw new Error("Empty reply");
        const terms = selectCallTerms(await termsPromise, ctx.terms);

        // Persist before signalling done so the client only finalizes stored turns.
        const { data: saved, error } = await supabase.rpc("append_ai_call_turn", {
          p_thread_id: thread.id,
          p_expected_turns: userTurns,
          p_user_text: userText.slice(0, 2000),
          p_assistant_text: reply,
          p_terms: terms,
        }).abortSignal(signal);
        if (error) throw error;
        if (saved !== true) {
          // Context went stale (another tab appended); tell the client to reload.
          send({ type: "stale" });
        } else {
          await recordUsage(supabase, user.id, "conversation");
          send({ type: "done", text: reply, terms });
        }
      } catch (error) {
        // Never rethrow here: the finally must close the controller even on abort.
        if (!signal.aborted) {
          console.error("AI call stream failed", error instanceof Error ? error.name : "Unknown");
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
    const expectedField = form?.get("expectedTurns");
    const expected = typeof expectedField === "string" && expectedField.trim() !== "" ? Number(expectedField) : NaN;
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

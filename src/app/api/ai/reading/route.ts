import { NextResponse } from "next/server";
import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { QuotaExceededError, assertQuota, recordUsage } from "@/lib/ai/quota";
import {
  copyPassageForUser,
  findCachedPassage,
  generateReadingPassage,
  listTargetTerms,
  savePassage,
  type StoredPassage,
} from "@/lib/ai/reading-generate";
import { cefrLevelSchema } from "@/lib/ai/reading";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  setId: z.uuid(),
  level: cefrLevelSchema.optional(),
  /** Bypass the cache and generate a fresh passage. */
  fresh: z.boolean().optional(),
});

function passagePayload(passage: StoredPassage) {
  return {
    id: passage.id,
    level: passage.level,
    content: passage.content,
    questions: passage.questions,
    target_terms: passage.target_terms,
    shared: passage.shared,
    created_at: passage.created_at,
  };
}

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
  if (signal.aborted) return new Response(null, { status: 408 });
  const timeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  try {
    return await Promise.race([handle(request, signal), timeout]);
  } catch (error) {
    if (signal.aborted) {
      return NextResponse.json({ error: "Tạo bài đọc quá lâu. Hãy thử lại." }, { status: 504 });
    }
    throw error;
  }
}

async function handle(request: Request, signal: AbortSignal) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để luyện đọc." }, { status: 401 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI chưa được bật." }, { status: 503 });
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Bộ từ hoặc trình độ không hợp lệ." }, { status: 400 });
  }
  const { setId, fresh } = body.data;

  const [set, profile] = await Promise.all([
    supabase.from("study_sets").select("id, visibility").eq("id", setId).maybeSingle(),
    supabase.from("profiles").select("level").eq("id", user.id).maybeSingle(),
  ]);
  signal.throwIfAborted();
  if (set.error || profile.error) throw new Error("Could not load reading input");
  if (!set.data) return NextResponse.json({ error: "Không tìm thấy bộ từ." }, { status: 404 });
  const level = body.data.level ?? cefrLevelSchema.safeParse(profile.data?.level).data ?? "B1";

  try {
    if (!fresh) {
      const cached = await findCachedPassage(supabase, setId, level);
      signal.throwIfAborted();
      if (cached) {
        // Shared rows belong to another user: copy into this user's history.
        const passage = cached.user_id === user.id
          ? cached
          : await copyPassageForUser(supabase, cached, user.id);
        return NextResponse.json({ passage: passagePayload(passage), cached: true });
      }
    }

    const terms = await listTargetTerms(supabase, setId, user.id);
    signal.throwIfAborted();
    if (terms.length < 5) {
      return NextResponse.json({ error: "Cần ít nhất 5 từ khác nhau trong bộ để luyện đọc." }, { status: 422 });
    }

    await assertQuota(supabase, user.id, "reading");
    signal.throwIfAborted();
    const { passage } = await generateReadingPassage(terms, level, signal);
    signal.throwIfAborted();
    const saved = await savePassage(supabase, createAdminClient(), {
      userId: user.id,
      setId,
      setPublic: set.data.visibility === "public",
      level,
      passage,
      targetTerms: terms,
    });
    await recordUsage(supabase, user.id, "reading");
    return NextResponse.json({ passage: passagePayload(saved), cached: false });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
      return NextResponse.json({ error: "AI trả kết quả sai định dạng. Hãy thử lại." }, { status: 502 });
    }
    console.error("Reading generation failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Chưa tạo được bài đọc đủ từ mục tiêu. Hãy thử lại." },
      { status: 502 },
    );
  }
}

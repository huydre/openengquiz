"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cardSchema } from "@/lib/vocab/card-schema";
import { lookupResultSchema } from "@/lib/vocab/lookup-term";

export type SaveLookupState = { error: string | null; savedSetId?: string; savedTerm?: string };

export async function saveLookupCard(
  _previous: SaveLookupState,
  formData: FormData,
): Promise<SaveLookupState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Vui lòng đăng nhập lại." };

  const setId = formData.get("setId");
  const rawResult = formData.get("result");
  if (typeof setId !== "string" || !/^[0-9a-f-]{36}$/i.test(setId)
    || typeof rawResult !== "string" || rawResult.length > 10000) {
    return { error: "Dữ liệu không hợp lệ." };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawResult);
  } catch {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const lookup = lookupResultSchema.safeParse(decoded);
  if (!lookup.success) return { error: "Dữ liệu không hợp lệ." };
  const card = cardSchema.safeParse(lookup.data);
  if (!card.success) return { error: "Dữ liệu không hợp lệ." };

  const { data: ownedSet, error: setError } = await supabase
    .from("study_sets")
    .select("id")
    .eq("id", setId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (setError || !ownedSet) return { error: "Bạn không thể lưu vào bộ từ này." };

  const { data: lastCard, error: positionError } = await supabase
    .from("cards")
    .select("position")
    .eq("set_id", setId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) return { error: "Chưa lưu được thẻ. Thử lại nhé." };

  const { error: insertError } = await supabase.from("cards").insert({
    ...card.data,
    set_id: setId,
    position: (lastCard?.position ?? -1) + 1,
  });
  if (insertError) {
    console.error("Lookup card save failed", insertError);
    return { error: "Chưa lưu được thẻ. Thử lại nhé." };
  }

  revalidatePath(`/sets/${setId}`);
  return { error: null, savedSetId: setId, savedTerm: card.data.term };
}

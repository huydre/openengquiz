import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { cardMastery } from "../srs/card-mastery";

export type SuggestedPath = { id: string; slug: string; title: string; description: string; level: string; tags: string[]; setCount: number; wordCount: number };
type PathRow = Omit<SuggestedPath, "setCount" | "wordCount" | "description"> & { description: string | null };
type CardRow = { id: string };
type SetRow = { id: string; title: string; cards: CardRow[] };
type StateRow = { state: string; reps: number };
type RecentRow = { id: string; title: string; last_studied_at: string };

export function summarizeSet(set: SetRow, states: ReadonlyMap<string, StateRow>) {
  let mastered = 0;
  let learning = 0;
  for (const { id } of set.cards) {
    const status = cardMastery(states.get(id));
    if (status === "mastered") mastered++;
    if (status === "learning") learning++;
  }
  return { id: set.id, title: set.title, cardCount: set.cards.length, mastered, learning };
}

export async function getSuggestedPaths(supabase: SupabaseClient, goal: string | null, limit = 6): Promise<SuggestedPath[]> {
  const query = () => supabase.from("learning_paths")
    .select("id,slug,title,description,level,tags,path_items(set_id)")
    .eq("visibility", "public").eq("status", "ready").not("slug", "is", null).order("title").order("id");
  if (limit <= 0) return [];
  type SuggestionRow = PathRow & { path_items: { set_id: string }[] };
  const preferred = goal ? await query().contains("tags", [goal]).limit(limit).overrideTypes<SuggestionRow[], { merge: false }>() : null;
  if (preferred?.error) throw preferred.error;
  const paths = preferred?.data ?? [];
  if (paths.length < limit) {
    let rest = query().limit(limit - paths.length);
    if (paths.length) rest = rest.filter("id", "not.in", `(${paths.map(({ id }) => id).join(",")})`);
    const { data, error } = await rest.overrideTypes<SuggestionRow[], { merge: false }>();
    if (error) throw error;
    paths.push(...data);
  }
  return Promise.all(paths.map(async ({ path_items, description, ...path }) => {
    const ids = path_items.map(({ set_id }) => set_id);
    const result = ids.length ? await supabase.from("cards").select("id", { count: "exact", head: true }).in("set_id", ids) : null;
    if (result?.error) throw result.error;
    return { ...path, description: description ?? "", setCount: ids.length, wordCount: result?.count ?? 0 };
  }));
}

async function setProgress(supabase: SupabaseClient, sets: { id: string; title: string }[], userId: string) {
  return Promise.all(sets.map(async (set) => {
    const cards: CardRow[] = [];
    const states = new Map<string, StateRow>();
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await supabase.from("cards").select("id,review_states(state,reps)")
        .eq("set_id", set.id).eq("review_states.user_id", userId).order("id").range(offset, offset + 199)
        .overrideTypes<{ id: string; review_states: StateRow[] }[], { merge: false }>();
      if (error) throw error;
      for (const { id, review_states } of data) {
        cards.push({ id });
        if (review_states[0]) states.set(id, review_states[0]);
      }
      if (data.length < 200) break;
    }
    return summarizeSet({ ...set, cards }, states);
  }));
}

export async function getPath(supabase: SupabaseClient, slugOrId: string, userId: string) {
  const field = z.uuid().safeParse(slugOrId).success ? "id" : "slug";
  const { data: path, error } = await supabase.from("learning_paths")
    .select("id,slug,title,description,level,tags,path_items(position,study_sets(id,title))")
    .eq(field, slugOrId).eq("status", "ready").maybeSingle()
    .overrideTypes<Omit<PathRow, "slug"> & { slug: string | null; path_items: { position: number; study_sets: { id: string; title: string } | null }[] }, { merge: false }>();
  if (error) throw error;
  if (!path) return null;
  const { path_items, ...details } = path;
  const ordered = path_items.sort((a, b) => a.position - b.position).flatMap(({ study_sets }) => study_sets ? [study_sets] : []);
  const sets = await setProgress(supabase, ordered, userId);
  let cardCount = 0, mastered = 0, learning = 0;
  for (const set of sets) {
    cardCount += set.cardCount;
    mastered += set.mastered;
    learning += set.learning;
  }
  return { ...details, sets, cardCount, mastered, learning, progress: cardCount ? mastered / cardCount : 0 };
}

export async function getRecentSets(supabase: SupabaseClient, userId: string, limit = 4) {
  if (limit <= 0) return [];
  const { data, error } = await supabase.rpc("recent_path_study_sets", { p_limit: limit });
  if (error) throw error;
  const sessions: RecentRow[] = data ?? [];
  const sets = await setProgress(supabase, sessions, userId);
  return sets.map(({ id, title, cardCount, mastered }, index) => ({ id, title, cardCount,
    masteredPercent: cardCount ? Math.round(mastered / cardCount * 100) : 0, lastStudiedAt: sessions[index].last_studied_at }));
}

import { z } from "zod";

export const cefrLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type CefrLevel = z.infer<typeof cefrLevelSchema>;

export const readingQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(5),
  answer_index: z.number().int().min(0),
  explanation: z.string().trim().min(1).max(500),
});
export type ReadingQuestion = z.infer<typeof readingQuestionSchema>;

export const readingPassageSchema = z.object({
  content: z.string().trim().min(1).max(12000),
  questions: z.array(readingQuestionSchema).min(3).max(5),
});
export type ReadingPassage = z.infer<typeof readingPassageSchema>;

export interface ReadingTerm {
  term: string;
  definition_vi: string | null;
}

export interface ReadingSegment {
  text: string;
  /** Set when this segment is a highlighted target term. */
  term: ReadingTerm | null;
}

/** Minimum number of target terms a passage must contain. */
export const MIN_TARGET_TERMS = 5;
/** Maximum number of target terms a passage may contain. */
export const MAX_TARGET_TERMS = 10;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds a matcher for a term: whole words/phrases, case-insensitive, allowing
 * simple inflections (plural s/es, past -ed, -ing, -er/-est) on the final word.
 */
function termPattern(term: string): RegExp {
  const words = term.trim().split(/\s+/).filter(Boolean);
  const last = words.at(-1) ?? "";
  const stem = last.replace(/(ies|es|s|ed|ing)$/, "");
  const tail =
    last === stem
      ? `${escapeRegExp(last)}(?:s|es|ed|ing|er|est)?`
      : `(?:${escapeRegExp(last)}|${escapeRegExp(stem)}(?:s|es|ed|ing|er|est)?)`;
  const body = [...words.slice(0, -1).map(escapeRegExp), tail];
  return new RegExp(`\\b${body.join("\\s+")}\\b`, "i");
}
/**
 * Pure check: which target terms appear in the passage content.
 * Returns matched terms (deduplicated, in target order) and the missing ones.
 */
export function checkTargetTerms(
  content: string,
  targetTerms: ReadingTerm[],
): { matched: ReadingTerm[]; missing: ReadingTerm[] } {
  const matched: ReadingTerm[] = [];
  const missing: ReadingTerm[] = [];
  const seen = new Set<string>();
  for (const target of targetTerms) {
    const key = target.term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (termPattern(target.term).test(content)) matched.push(target);
    else missing.push(target);
  }
  return { matched, missing };
}

/** True when the passage satisfies the 5-10 target term requirement. */
export function hasEnoughTargetTerms(matchedCount: number): boolean {
  return matchedCount >= MIN_TARGET_TERMS && matchedCount <= MAX_TARGET_TERMS;
}

/**
 * Splits passage content into plain and highlighted segments for rendering.
 * Overlapping matches resolve to the earliest-starting, then longest match.
 */
export function splitHighlightedContent(
  content: string,
  targetTerms: ReadingTerm[],
): ReadingSegment[] {
  interface Hit { start: number; end: number; term: ReadingTerm }
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const target of targetTerms) {
    const key = target.term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pattern = termPattern(target.term);
    const global = new RegExp(pattern.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = global.exec(content)) !== null) {
      hits.push({ start: match.index, end: match.index + match[0].length, term: target });
      if (match[0].length === 0) global.lastIndex += 1;
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen: Hit[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    chosen.push(hit);
    cursor = hit.end;
  }
  const segments: ReadingSegment[] = [];
  cursor = 0;
  for (const hit of chosen) {
    if (hit.start > cursor) segments.push({ text: content.slice(cursor, hit.start), term: null });
    segments.push({ text: content.slice(hit.start, hit.end), term: hit.term });
    cursor = hit.end;
  }
  if (cursor < content.length) segments.push({ text: content.slice(cursor), term: null });
  return segments;
}

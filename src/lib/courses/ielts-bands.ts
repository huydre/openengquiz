const roundBand = (value: number) => Math.round(value * 2) / 2;

/**
 * Keeps practice bands honest: a short answer cannot show the range IELTS rewards, so bands are
 * capped by length (under 15 words at 5.5, under 30 words at 6.5) and overall is the rounded mean
 * of the three criteria instead of a model guess.
 */
export function calibrateBands(
  ielts: { overall: number; grammar: number; vocabulary: number; coherence: number },
  transcript: string,
) {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const cap = words < 15 ? 5.5 : words < 30 ? 6.5 : 9;
  const grammar = Math.min(ielts.grammar, cap);
  const vocabulary = Math.min(ielts.vocabulary, cap);
  const coherence = Math.min(ielts.coherence, cap);
  return { grammar, vocabulary, coherence, overall: roundBand((grammar + vocabulary + coherence) / 3) };
}

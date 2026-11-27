export function splitQuestion(text: string) {
  return Array.from(text.matchAll(/[\p{L}\p{M}]+(?:['’\u002d][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu), ([value]) => ({
    value,
    term: /^\p{L}/u.test(value) ? value.replaceAll("’", "'") : null,
  }));
}

export function highlightPhrases(text: string, phrases: string[]) {
  const terms = [...new Set(phrases.map((phrase) => phrase.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text, highlighted: false }];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return text.split(pattern).map((part, index) => ({ text: part, highlighted: index % 2 === 1 }));
}

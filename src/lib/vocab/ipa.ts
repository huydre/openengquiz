/**
 * Normalizes a word's IPA for display: exactly one pair of slashes (no "//x//" or "[x]"),
 * no syllable dots, and the common r symbol instead of the narrow ɹ some dictionaries use.
 * Returns null for empty input.
 */
export function formatIpa(value: string | null | undefined): string | null {
  if (!value) return null;
  const core = value
    .trim()
    .replace(/^[\s/[\]]+|[\s/[\]]+$/g, "")
    .replace(/(?<=\S)\.(?=\S)/g, "")
    .replace(/ɹ/g, "r")
    .replace(/\s+/g, " ");
  return core ? `/${core}/` : null;
}

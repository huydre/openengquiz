import { formatIpa } from "@/lib/vocab/ipa";
import { cn } from "@/lib/utils";

/**
 * A word's IPA in a font that has the phonetic symbols (ˈ ʊ ɪ ə …). The app font (Nunito)
 * lacks them, so mixed glyph fallback rendered stress marks with odd gaps ("/ ˈ kraʊdɪd/").
 */
export function Ipa({ value, className }: { value: string | null | undefined; className?: string }) {
  const text = formatIpa(value);
  if (!text) return null;
  return <span className={cn("font-ipa", className)}>{text}</span>;
}

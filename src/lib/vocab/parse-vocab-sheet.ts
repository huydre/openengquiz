import { cardTermKey } from "../ai/generated-card-data";
import { cardSchema, type CardInput } from "./card-schema";

type Column = "term" | "part_of_speech" | "ipa" | "definition_vi" | "definition_en" | "example_en" | "example_vi" | "synonyms";

export type VocabSheetResult = {
  cards: CardInput[];
  skipped: { row: number; reason: string }[];
  columns: Partial<Record<Column, string>>;
  title: string | null;
};

function cellText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function clean(value: unknown) {
  return cellText(value).replace(/\s+/g, " ");
}

function normalizeHeader(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

// Specific labels come first: "English meaning" is not Vietnamese meaning.
const headerAliases: [Column | null, RegExp][] = [
  [null, /\b(stt|so thu tu|trai nghia|antonyms?|ghi chu|notes?|index|serial number)\b/],
  ["example_vi", /\b(dich vi du|vi du tieng viet|example translation|vietnamese example|example vi)\b/],
  ["example_en", /\b(vi du|examples?|example en)\b/],
  ["synonyms", /\b(dong nghia|synonyms?)\b/],
  ["part_of_speech", /\b(loai tu|pos|part of speech)\b/],
  ["ipa", /\b(phat am|ipa|pronunciation)\b/],
  ["definition_vi", /\b(vietnamese definition|definition (vi|vietnamese)|dinh nghia tieng viet)\b/],
  ["definition_en", /\b(dinh nghia|nghia tieng anh|definitions?|english meaning)\b/],
  ["definition_vi", /\b(nghia|meanings?|vietnamese)\b/],
  ["term", /\b(tu|words?|terms?|vocabulary|phrases?)\b/],
];
const standaloneTerm = /^(tu|tu moi|tu vung|words?|terms?|vocabulary|phrases?|english word|word phrase|tu moi word phrase)$/;

export function parseVocabRows(rows: unknown[][], detectHeader = true): VocabSheetResult {
  const result: VocabSheetResult = { cards: [], skipped: [], columns: {}, title: null };
  let headerRow = -1;
  let positions: Partial<Record<Column, number>> = { term: 0, definition_vi: 1 };
  for (let i = 0; detectHeader && i < Math.min(rows.length, 10); i++) {
    const columns: VocabSheetResult["columns"] = {};
    const candidate: typeof positions = {};
    let termIsExact = false;
    let ignored = 0;
    rows[i].forEach((cell, index) => {
      const label = cellText(cell);
      const normalized = normalizeHeader(label);
      const match = headerAliases.find(([, alias]) => alias.test(normalized));
      if (match?.[0] === null) ignored++;
      const field = match?.[0];
      if (!field) return;
      const exactTerm = field === "term" && standaloneTerm.test(normalized);
      if (candidate[field] !== undefined && (!exactTerm || termIsExact)) return;
      if (field === "term") termIsExact = exactTerm;
      candidate[field] = index;
      columns[field] = label;
    });
    const termOnly = Object.keys(columns).length === 1;
    if (!columns.term || (termOnly && (!termIsExact || rows[i].filter(cellText).length !== ignored + 1))) {
      // Once positional data starts, a later pair like "word,meaning" is not a header.
      if (!ignored && cellText(rows[i][0]) && cellText(rows[i][1])) break;
      continue;
    }
    headerRow = i;
    positions = candidate;
    result.columns = columns;
    if (!termOnly || ignored) break;
  }
  for (let i = 0; i < headerRow; i++) {
    const cells = rows[i].map(clean).filter(Boolean);
    if (cells.length === 1) {
      result.title = cells[0];
      break;
    }
  }

  const seen = new Set<string>();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some(cellText)) continue;
    const get = (field: Column) => positions[field] === undefined ? undefined : row[positions[field]];
    const term = clean(get("term"));
    const definition_vi = clean(get("definition_vi")) || undefined;
    const definition_en = clean(get("definition_en")) || undefined;
    const key = cardTermKey(term);
    let reason: string;
    if (!key) reason = "Thiếu từ.";
    else if (seen.has(key)) reason = "Từ bị trùng trong file.";
    else {
      seen.add(key);
      if ((positions.definition_vi !== undefined || positions.definition_en !== undefined) && !definition_vi && !definition_en) {
        result.skipped.push({ row: i + 1, reason: "Thiếu nghĩa." });
        continue;
      }
      const synonyms = new Map<string, string>();
      for (const item of cellText(get("synonyms")).split(/[,;/]/)) {
        const value = clean(item);
        const key = cardTermKey(value);
        if (key && !synonyms.has(key)) synonyms.set(key, value);
      }
      const card = cardSchema.safeParse({
        term, definition_vi, definition_en,
        part_of_speech: clean(get("part_of_speech")) || undefined,
        ipa: cellText(get("ipa")) || undefined,
        example_en: clean(get("example_en")) || undefined,
        example_vi: clean(get("example_vi")) || undefined,
        synonyms: [...synonyms.values()],
      });
      if (card.success) {
        result.cards.push(card.data);
        continue;
      }
      reason = "Dữ liệu thẻ không hợp lệ hoặc vượt giới hạn độ dài.";
    }
    result.skipped.push({ row: i + 1, reason });
  }
  return result;
}

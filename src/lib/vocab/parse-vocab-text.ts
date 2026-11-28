import { parseVocabRows, type VocabSheetResult } from "./parse-vocab-sheet";

type TextSeparators = {
  termSeparator?: string;
  cardSeparator?: "newline" | "semicolon";
};

class DelimitedError extends Error {
  constructor(message: string, readonly row: number) {
    super(message);
  }
}

// Keep a slot for each physical line, including lines inside a quoted CSV cell.
export function parseDelimitedRows(text: string, fieldSeparator: string, cardSeparator = "newline"): string[][] {
  if (!fieldSeparator || /["\r\n]/.test(fieldSeparator) || (cardSeparator === "semicolon" && fieldSeparator.includes(";"))) {
    throw new Error("Dấu phân cách không hợp lệ.");
  }
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quote: "open" | "closed" | null = null;
  let line = 0;
  let rowStart = 0;
  const separator = cardSeparator === "semicolon" ? ";" : "\n";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote === "open") {
      if (char === '"' && source[i + 1] === '"') {
        value += char;
        i++;
      } else if (char === '"') quote = "closed";
      else value += char;
      if (char === "\n" && separator === "\n") line++;
    } else if (char === '"' && !value && quote === null) quote = "open";
    else if (char === separator) {
      row.push(value);
      rows[rowStart] = row;
      row = [];
      value = "";
      quote = null;
      rowStart = ++line;
    } else if (source.startsWith(fieldSeparator, i)) {
      row.push(value);
      value = "";
      quote = null;
      i += fieldSeparator.length - 1;
    } else if (quote === "closed") {
      if (char !== " " && char !== "\t") throw new DelimitedError("Có ký tự sau dấu ngoặc kép đóng.", rowStart + 1);
    } else value += char;
  }
  if (quote === "open") throw new DelimitedError("Ô có dấu ngoặc kép chưa đóng.", rowStart + 1);
  row.push(value);
  rows[rowStart] = row;
  return Array.from(rows, (values) => values ?? []);
}

export function parseVocabText(text: string, { termSeparator = "tab", cardSeparator = "newline" }: TextSeparators = {}): VocabSheetResult {
  const fieldSeparator = termSeparator === "tab" ? "\t" : termSeparator === "comma" ? "," : termSeparator;
  try {
    const rows = parseDelimitedRows(text, fieldSeparator, cardSeparator);
    const result = parseVocabRows(rows, fieldSeparator === "\t" && rows.some((row) => row.length > 2));
    return { ...result, title: null };
  } catch (error) {
    return { cards: [], columns: {}, title: null, skipped: [{
      row: error instanceof DelimitedError ? error.row : 1,
      reason: error instanceof Error ? error.message : "Không đọc được nội dung dán.",
    }] };
  }
}

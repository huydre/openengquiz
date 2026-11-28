"use client";

import readWorkbook from "read-excel-file/browser";
import { parseVocabRows, type VocabSheetResult } from "./parse-vocab-sheet";
import { parseDelimitedRows } from "./parse-vocab-text";

export async function readVocabFile(file: File): Promise<VocabSheetResult> {
  if (file.size > 2 * 1024 * 1024) throw new Error("File không được lớn hơn 2 MB.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!file.name.includes(".") || (extension !== "csv" && extension !== "xlsx")) {
    throw new Error("Chỉ hỗ trợ file .xlsx hoặc .csv.");
  }
  try {
    if (extension === "csv") return parseVocabRows(parseDelimitedRows(await file.text(), ","));

    const sheets = await readWorkbook(file);
    let fallback: VocabSheetResult | undefined;
    for (const sheet of sheets) {
      const result = parseVocabRows(sheet.data);
      if (result.columns.term) return result;
      if (sheet.data.length) fallback ??= result;
    }
    return fallback ?? parseVocabRows([]);
  } catch {
    throw new Error(extension === "csv" ? "Không đọc được file CSV. Kiểm tra lại định dạng file." : "Không đọc được file Excel. Kiểm tra lại định dạng file.");
  }
}

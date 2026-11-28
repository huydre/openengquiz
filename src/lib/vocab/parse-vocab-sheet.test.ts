import { describe, expect, it } from "vitest";
import { parseVocabRows } from "./parse-vocab-sheet";
import { parseVocabText } from "./parse-vocab-text";
import { readVocabFile } from "./read-vocab-file";

const headers = [
  "STT", "Từ mới (Word / Phrase)", "Loại từ (POS)", "Cách phát âm (IPA)", "Nghĩa tiếng Việt",
  "Ví dụ (Example)", "Từ đồng nghĩa (Synonyms)", "Từ trái nghĩa (Antonyms)", "Ghi chú sửa lỗi chính tả",
];

describe("parseVocabRows", () => {
  it("maps a Vietnamese workbook, ignores unsupported columns and reports original rows", () => {
    const result = parseVocabRows([
      ["  DANH SÁCH  TỪ VỰNG TIẾNG ANH  "], headers,
      [1, "  more \t than  ", " phrase / adv ", " /mɔːr  ðæn/ ", " hơn  cả ", " She is more than a teacher. ", "over, beyond; OVER / exceeding", "less than", "ignored"],
      [], [2, "MORE THAN", "", "", "hơn cả"], [3, "distant"], [4, "", "", "", "xa xôi"],
      [5, "x".repeat(201), "", "", "nghĩa"],
    ]);
    expect(result).toEqual({
      title: "DANH SÁCH TỪ VỰNG TIẾNG ANH",
      columns: { term: headers[1], part_of_speech: headers[2], ipa: headers[3], definition_vi: headers[4], example_en: headers[5], synonyms: headers[6] },
      cards: [{ term: "more than", part_of_speech: "phrase / adv", ipa: "/mɔːr  ðæn/", definition_vi: "hơn cả", example_en: "She is more than a teacher.", synonyms: ["over", "beyond", "exceeding"] }],
      skipped: [
        { row: 5, reason: "Từ bị trùng trong file." }, { row: 6, reason: "Thiếu nghĩa." },
        { row: 7, reason: "Thiếu từ." }, { row: 8, reason: "Dữ liệu thẻ không hợp lệ hoặc vượt giới hạn độ dài." },
      ],
    });
  });

  it("keeps columns A and B without a header", () => {
    expect(parseVocabRows([["apple", "quả táo"], ["word", "meaning"]])).toEqual({
      columns: {}, title: null, skipped: [],
      cards: [{ term: "apple", definition_vi: "quả táo", synonyms: [] }, { term: "word", definition_vi: "meaning", synonyms: [] }],
    });
  });

  it("does not mistake a short title for the vocabulary header", () => {
    const result = parseVocabRows([["Từ vựng"], headers, [1, "desk", "", "", "bàn"]]);
    expect(result).toMatchObject({ title: "Từ vựng", columns: { term: headers[1] }, cards: [{ term: "desk", definition_vi: "bàn" }], skipped: [] });
  });

  it("distinguishes English and Vietnamese definitions and example translations", () => {
    const result = parseVocabRows([
      ["ANTONYM", "Word Family", "Word", "English Meaning", "Vietnamese Definition", "Example Translation", "Example"],
      ["hot", "coldness", "cold", "low temperature", "lạnh", "Trời lạnh.", "It's cold."],
    ]);
    expect(result.cards).toEqual([{
      term: "cold", definition_en: "low temperature", definition_vi: "lạnh", example_vi: "Trời lạnh.", example_en: "It's cold.", synonyms: [],
    }]);
    expect(result.columns).toMatchObject({ term: "Word", definition_en: "English Meaning", definition_vi: "Vietnamese Definition", example_vi: "Example Translation" });
  });

  it("allows cards when no meaning column is mapped", () => {
    expect(parseVocabRows([["TỪ", "Phát âm"], ["desk", "/desk/"]]).cards).toEqual([
      { term: "desk", ipa: "/desk/", synonyms: [] },
    ]);
  });

  it("allows a term-only header beside an ignored index", () => {
    expect(parseVocabRows([["STT", "Word"], [1, "desk"]]).cards).toEqual([{ term: "desk", synonyms: [] }]);
  });

  it("does not replace the first occurrence with a later valid duplicate", () => {
    expect(parseVocabRows([["Word", "Meaning"], ["apple"], ["APPLE", "táo"]])).toMatchObject({
      cards: [], skipped: [{ row: 2, reason: "Thiếu nghĩa." }, { row: 3, reason: "Từ bị trùng trong file." }],
    });
  });
});

describe("readVocabFile CSV", () => {
  it("reads BOM, commas, escaped quotes and preserves physical row numbers after multiline cells", async () => {
    const csv = '\uFEFFWord,Meaning,Example\r\napple,"táo, trái cây","She said ""apple"".\r\nIt was red."\r\nApple,táo\r\n';
    const result = await readVocabFile(new File([csv], "words.CSV"));
    expect(result.cards).toEqual([{ term: "apple", definition_vi: "táo, trái cây", example_en: 'She said "apple". It was red.', synonyms: [] }]);
    expect(result.skipped).toEqual([{ row: 4, reason: "Từ bị trùng trong file." }]);
  });

  it("rejects files over 2 MiB and broken quotes", async () => {
    await expect(readVocabFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.csv"))).rejects.toThrow("2 MB");
    await expect(readVocabFile(new File(['apple,"táo'], "broken.csv"))).rejects.toThrow("Không đọc được file CSV");
  });
});

describe("parseVocabText", () => {
  it("defaults to tab and newline", () => {
    expect(parseVocabText("apple\ttáo\r\npear\tlê").cards.map((card) => card.term)).toEqual(["apple", "pear"]);
  });

  it.each([
    ["tab", "newline", "apple\ttáo\npear\tlê"],
    ["tab", "semicolon", "apple\ttáo;pear\tlê"],
    ["comma", "newline", 'apple,"quả, táo"\npear,lê'],
    ["comma", "semicolon", 'apple,"quả; táo";pear,lê'],
    [" :: ", "newline", "apple :: táo\npear :: lê"],
    [" :: ", "semicolon", "apple :: táo;pear :: lê"],
  ] as const)("reads %s and %s separators", (termSeparator, cardSeparator, text) => {
    const result = parseVocabText(text, { termSeparator, cardSeparator });
    expect(result.cards.map(({ term, definition_vi }) => [term, definition_vi])).toEqual([
      ["apple", termSeparator === "comma" ? (cardSeparator === "newline" ? "quả, táo" : "quả; táo") : "táo"], ["pear", "lê"],
    ]);
    expect(result).toMatchObject({ columns: {}, skipped: [], title: null });
  });

  it("maps multi-column clipboard data but does not use its title", () => {
    const result = parseVocabText(`DANH SÁCH TỪ VỰNG\n${headers.join("\t")}\n1\tdesk\tn\t/desk/\tbàn\tA desk.\ttable`);
    expect(result).toMatchObject({
      title: null, columns: { term: headers[1], definition_vi: headers[4] },
      cards: [{ term: "desk", definition_vi: "bàn", example_en: "A desk.", synonyms: ["table"] }],
    });
  });

  it("reports malformed quoted data on its starting row", () => {
    expect(parseVocabText('apple,táo\npear,lê\nplum,"mận"x', { termSeparator: "comma" })).toMatchObject({
      cards: [], skipped: [{ row: 3, reason: "Có ký tự sau dấu ngoặc kép đóng." }],
    });
  });
});

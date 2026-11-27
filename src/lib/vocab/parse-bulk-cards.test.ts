import { describe, expect, it } from "vitest";
import { parseBulkCards } from "./parse-bulk-cards";

describe("parseBulkCards", () => {
  it("accepts dash, tab, and quoted CSV values", () => {
    expect(parseBulkCards('apple - táo\nbook\tsách\n"hello, world","xin chào, thế giới"').cards).toEqual([
      { term: "apple", definition_vi: "táo" },
      { term: "book", definition_vi: "sách" },
      { term: "hello, world", definition_vi: "xin chào, thế giới" },
    ]);
  });

  it("reports invalid lines while keeping valid lines", () => {
    expect(parseBulkCards("wrong\n\ncat - mèo\n\"bad,quote").errors.map((error) => error.line)).toEqual([1, 4]);
  });

  it("keeps a comma in a dash-separated meaning", () => {
    expect(parseBulkCards("apple - táo, quả táo").cards).toEqual([
      { term: "apple", definition_vi: "táo, quả táo" },
    ]);
  });

  it("keeps a dash inside a quoted CSV term", () => {
    expect(parseBulkCards('"take - off",cất cánh').cards).toEqual([
      { term: "take - off", definition_vi: "cất cánh" },
    ]);
  });
});

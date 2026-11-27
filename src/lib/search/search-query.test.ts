import { describe, expect, it } from "vitest";
import { escapeIlike, normalizeSearchQuery } from "./search-query";

describe("search query helpers", () => {
  it("trims and enforces the 2 to 80 character boundary", () => {
    expect(normalizeSearchQuery("  hi  ")).toBe("hi");
    expect(normalizeSearchQuery("x")).toBeNull();
    expect(normalizeSearchQuery(` ${"x".repeat(80)} `)).toHaveLength(80);
    expect(normalizeSearchQuery("x".repeat(81))).toBeNull();
    expect(normalizeSearchQuery(null)).toBeNull();
  });

  it("escapes pattern metacharacters and backslashes", () => {
    expect(escapeIlike("100%_\\" )).toBe("100\\%\\_\\\\");
  });
});

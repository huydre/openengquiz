import { describe, expect, it } from "vitest";
import { formatIpa } from "./ipa";

describe("formatIpa", () => {
  it("keeps exactly one pair of slashes", () => {
    expect(formatIpa("//ˈkraʊdɪd//")).toBe("/ˈkraʊdɪd/");
    expect(formatIpa("ˈkraʊdɪd")).toBe("/ˈkraʊdɪd/");
    expect(formatIpa("[ˈkraʊdɪd]")).toBe("/ˈkraʊdɪd/");
    expect(formatIpa(" /weɪk ʌp/ ")).toBe("/weɪk ʌp/");
  });

  it("drops syllable dots and the narrow r symbol", () => {
    expect(formatIpa("/ˌsɛ.ɹənˈdɪp.ɪ.təs/")).toBe("/ˌsɛrənˈdɪpɪtəs/");
  });

  it("returns null for empty values", () => {
    expect(formatIpa(null)).toBeNull();
    expect(formatIpa("  //  ")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { googleTtsUrl, isShortTtsText } from "./play-tts";

describe("isShortTtsText", () => {
  it("accepts words, phrases and one sentence", () => {
    expect(isShortTtsText("resilient")).toBe(true);
    expect(isShortTtsText("look forward to")).toBe(true);
    expect(isShortTtsText("The project deadline is next Friday.")).toBe(true);
    expect(isShortTtsText("Can I borrow your pen?")).toBe(true);
  });

  it("rejects empty, multi-sentence and over-long text", () => {
    expect(isShortTtsText("   ")).toBe(false);
    expect(isShortTtsText("I agree. It saves time.")).toBe(false);
    expect(isShortTtsText("a".repeat(201))).toBe(false);
  });
});

describe("googleTtsUrl", () => {
  it("uses the British voice for en-GB and encodes the text", () => {
    expect(googleTtsUrl("look forward to", "en-GB")).toContain("tl=en-GB");
    expect(googleTtsUrl("Can I go?")).toContain("tl=en&q=Can+I+go%3F");
  });
});

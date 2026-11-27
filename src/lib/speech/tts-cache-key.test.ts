import { describe, expect, it } from "vitest";
import { ttsCacheKey, ttsHashPreimage } from "./tts-cache-key";

describe("ttsCacheKey", () => {
  it("includes voice, speed and text so different speeds never share audio", () => {
    const base = ttsCacheKey("af_heart", "hello world", 1);
    expect(ttsCacheKey("af_heart", "hello world", 0.75)).not.toBe(base);
    expect(ttsCacheKey("af_heart", "hello world", 0.9)).not.toBe(base);
    expect(ttsCacheKey("af_heart", "hello world", 0.751)).not.toBe(
      ttsCacheKey("af_heart", "hello world", 0.754),
    );
    expect(ttsCacheKey("bf_emma", "hello world", 1)).not.toBe(base);
    expect(ttsCacheKey("af_heart", "hello there", 1)).not.toBe(base);
  });

  it("keeps the legacy hash preimage at speed 1 so old cache stays valid", () => {
    expect(ttsHashPreimage("af_heart", "hello world", 1)).toBe("af_heart\nhello world");
    expect(ttsHashPreimage("af_heart", "hello world", 0.9)).toBe(
      ttsCacheKey("af_heart", "hello world", 0.9),
    );
    expect(ttsHashPreimage("af_heart", "hello world", 0.9)).not.toBe(
      ttsHashPreimage("af_heart", "hello world", 1),
    );
  });
});

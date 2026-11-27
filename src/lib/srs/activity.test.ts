import { describe, expect, it } from "vitest";
import { currentStreak, vietnamDay } from "./activity";

describe("Vietnam activity day", () => {
  it("switches day at Vietnam midnight", () => {
    expect(vietnamDay(new Date("2026-11-26T16:59:59Z"))).toBe("2026-11-26");
    expect(vietnamDay(new Date("2026-11-26T17:00:00Z"))).toBe("2026-11-27");
  });

  it("keeps yesterday's streak before the first action today", () => {
    expect(currentStreak(["2026-11-25", "2026-11-26"], new Date("2026-11-27T02:00:00Z"))).toBe(2);
    expect(currentStreak(["2026-11-25"], new Date("2026-11-27T02:00:00Z"))).toBe(0);
  });
});

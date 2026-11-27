import { describe, expect, it } from "vitest";
import { inVnWeek, vnWeekEnd, vnWeekStart, vnWeekStartMs } from "./leaderboard-week";

describe("VN leaderboard week", () => {
  it("starts Monday 00:00 VN and ends the next Monday", () => {
    // 2026-11-25 is a Wednesday; its VN week starts Mon 2026-11-23.
    const wed = new Date("2026-11-25T03:00:00Z"); // Wed 10:00 VN
    expect(vnWeekStart(wed)).toBe("2026-11-23");
    expect(vnWeekEnd(wed)).toBe("2026-11-30");
  });

  it("flips the week at Sunday 16:59:59Z vs 17:00:00Z (VN Monday midnight)", () => {
    // Sunday 2026-11-29 16:59:59Z is still Sat 23:59:59 VN; 17:00:00Z is Mon 00:00 VN.
    const before = new Date("2026-11-29T16:59:59Z");
    const after = new Date("2026-11-29T17:00:00Z");
    expect(vnWeekStart(before)).toBe("2026-11-23");
    expect(vnWeekStart(after)).toBe("2026-11-30");
    expect(inVnWeek(after, after)).toBe(true);
    expect(inVnWeek(before, after)).toBe(false);
  });

  it("handles the year boundary", () => {
    // 2026-12-31 is Thursday; VN week containing it started Mon 2026-12-28.
    // 2027-01-01 17:00Z is Fri 2027-01-01 00:00 VN, still same week.
    const newYear = new Date("2027-01-01T03:00:00Z");
    expect(vnWeekStart(newYear)).toBe("2026-12-28");
    expect(vnWeekEnd(newYear)).toBe("2027-01-04");
  });

  it("week start instant is Monday 00:00 VN = Sunday 17:00 UTC", () => {
    const wed = new Date("2026-11-25T03:00:00Z");
    expect(new Date(vnWeekStartMs(wed)).toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });
});

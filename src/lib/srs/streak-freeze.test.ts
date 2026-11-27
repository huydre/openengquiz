import { describe, expect, it } from "vitest";
import { calculateStreakFreeze } from "./streak-freeze";

const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);

describe("streak freeze", () => {
  it.each([[6, 0], [7, 1], [14, 2], [21, 2]])("awards at multiples of seven up to capacity (%i days)", (count, freezes) => {
    expect(calculateStreakFreeze(days.slice(0, count), days[count])).toEqual({
      streak: count, freezes, frozenDays: [], awarded: freezes,
    });
  });

  it("covers the whole gap or keeps both freezes and breaks the streak", () => {
    const active = days.slice(0, 14);
    expect(calculateStreakFreeze(active, days[16])).toEqual({
      streak: 16, freezes: 0, frozenDays: [days[14], days[15]], awarded: 2,
    });
    expect(calculateStreakFreeze([...active, days[17]], days[17])).toEqual({
      streak: 1, freezes: 2, frozenDays: [], awarded: 2,
    });
  });

  it("counts frozen days toward a milestone and can earn again after a break", () => {
    const active = [...days.slice(0, 7), ...days.slice(10, 16)];
    expect(calculateStreakFreeze(active, days[17])).toEqual({
      streak: 7, freezes: 1, frozenDays: [days[16]], awarded: 2,
    });
    expect(calculateStreakFreeze([...active, days[17]], days[17])).toEqual({
      streak: 8, freezes: 1, frozenDays: [days[16]], awarded: 2,
    });
  });
});

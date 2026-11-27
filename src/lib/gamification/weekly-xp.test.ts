import { describe, expect, it } from "vitest";
import {
  activityXp,
  courseActivityXp,
  speakingXp,
  totalWeeklyXp,
} from "./weekly-xp";

describe("weekly XP formula", () => {
  it("counts reviews and studied sessions at 1 XP each", () => {
    // Literal values pin the rates: 3 reviews + 2 studied + 0 + 4 = 9 XP.
    expect(activityXp([{ reviews: 3, studied: 2 }, { reviews: 0, studied: 4 }])).toBe(9);
  });

  it("counts only completed course activities at 10 XP each", () => {
    const rows = [
      { completed_at: "2026-11-25T10:00:00Z" },
      { completed_at: null },
      { completed_at: "2026-11-26T01:00:00Z" },
    ];
    expect(courseActivityXp(rows)).toBe(20);
  });

  it("counts speaking attempts at 5 XP each", () => {
    expect(speakingXp([{ created_at: "a" }, { created_at: "b" }, { created_at: "c" }])).toBe(15);
  });

  it("sums all sources", () => {
    expect(totalWeeklyXp({
      activity: [{ reviews: 10, studied: 5 }],
      courseActivities: [{ completed_at: "x" }, { completed_at: null }],
      speakingAttempts: [{ created_at: "a" }],
    })).toBe(30);
  });
});

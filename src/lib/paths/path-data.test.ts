import { expect, it } from "vitest";
import { summarizeSet } from "./path-data";

it("counts only this set's cards and distinguishes new, learning and mastered", () => {
  const states = new Map([
    ["mastered", { state: "review", reps: 3 }],
    ["review", { state: "review", reps: 2 }],
    ["relearning", { state: "relearning", reps: 9 }],
    ["other-set", { state: "review", reps: 6 }],
  ]);
  const cards = ["mastered", "review", "relearning", "new"].map((id) => ({ id }));
  expect(summarizeSet({ id: "set", title: "Study", cards }, states)).toMatchObject({ cardCount: 4, mastered: 1, learning: 2 });
});

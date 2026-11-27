import { describe, expect, it } from "vitest";
import { cardMastery } from "./card-mastery";

describe("cardMastery", () => {
  it("treats cards without a review state as new", () => {
    expect(cardMastery(null)).toBe("new");
  });
  it("needs the review phase and three repetitions to be mastered", () => {
    expect(cardMastery({ state: "review", reps: 3 })).toBe("mastered");
    expect(cardMastery({ state: "review", reps: 2 })).toBe("learning");
    expect(cardMastery({ state: "relearning", reps: 9 })).toBe("learning");
    expect(cardMastery({ state: "new", reps: 0 })).toBe("learning");
  });
});

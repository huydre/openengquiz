import { describe, expect, it } from "vitest";
import {
  ACTIVITY_COUNT,
  activityDescriptors,
  activityProgressFraction,
  buildCloze,
  courseActivityContentSchema,
  createRecallQueue,
  firstUnfinishedActivity,
  gradeMeaningLocally,
  isActivityUnlocked,
  lessonActivitiesComplete,
  isFillAnswerCorrect,
  matchVietnameseMeaning,
  nextRecallItem,
  normalizeFillAnswer,
  normalizeMeaning,
  recallMasteryCount,
  recordRecallAnswer,
  vocabStepDescriptor,
  vocabStepPlan,
  VOCAB_STEP_PLAN,
  type CourseActivityContent,
  type CourseActivityProgress,
} from "./lesson-activities";

const content: CourseActivityContent = {
  speaking: [
    { en: "What do you usually do on Sunday mornings?", vi: "Bạn thường làm gì vào sáng Chủ nhật?", part: 1 },
    { en: "Talk about a skill you would like to learn.", vi: "Hãy nói về một kỹ năng bạn muốn học.", part: 3 },
    { en: "How do you usually get to work or school?", vi: "Bạn thường đi làm hoặc đi học bằng cách nào?", part: 1 },
    { en: "Do you think technology changes how people communicate?", vi: "Bạn có nghĩ công nghệ thay đổi cách mọi người giao tiếp không?", part: 3 },
  ],
  grammar: [
    { title: "Present continuous", explanationVi: "Diễn tả hành động đang xảy ra.", exampleEn: "She is reading a novel.", exampleVi: "Cô ấy đang đọc một cuốn tiểu thuyết." },
    { title: "Comparative adjectives", explanationVi: "So sánh hai người hoặc vật.", exampleEn: "This route is faster than the old one.", exampleVi: "Tuyến này nhanh hơn tuyến cũ." },
  ],
  conversation: "Asking for directions in a new neighborhood",
};

const row = (activity: number, completed = true, smallStep = 1): CourseActivityProgress => ({
  activity,
  small_step: smallStep,
  state: null,
  completed_at: completed ? "2026-11-27T00:00:00Z" : null,
});

describe("courseActivityContentSchema", () => {
  it("accepts the shared contract shape", () => {
    expect(courseActivityContentSchema.parse(content)).toEqual(content);
  });

  it("rejects wrong array lengths and bad part values", () => {
    expect(courseActivityContentSchema.safeParse({ ...content, speaking: content.speaking.slice(0, 3) }).success).toBe(false);
    expect(courseActivityContentSchema.safeParse({ ...content, grammar: [...content.grammar, content.grammar[0]] }).success).toBe(false);
    expect(courseActivityContentSchema.safeParse({
      ...content,
      speaking: [{ ...content.speaking[0], part: 2 }, ...content.speaking.slice(1)],
    }).success).toBe(false);
  });
});

describe("activityDescriptors", () => {
  it("returns 7 ordered descriptors matching the spec layout", () => {
    const list = activityDescriptors(content);
    expect(list).toHaveLength(ACTIVITY_COUNT);
    expect(list.map((d) => d.activity)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(list.map((d) => d.kind)).toEqual(["speaking", "vocabulary", "speaking", "speaking", "vocabulary", "speaking", "call"]);
    expect(list[0].subtitle).toContain("What do you usually do on Sunday mornings?");
    expect(list[0].subtitle).toContain("IELTS Part 1");
    expect(list[1].subtitle).toBe("4 từ, 1 ngữ pháp");
    expect(list[4].subtitle).toBe("4 từ, 1 ngữ pháp");
    expect(list[6].subtitle).toBe("Gọi điện với gia sư, dùng từ của bài");
    expect(list.filter((d) => d.kind === "vocabulary").every((d) => d.smallSteps === 18)).toBe(true);
  });
});

describe("activity progress helpers", () => {
  it("firstUnfinishedActivity returns the first incomplete activity", () => {
    expect(firstUnfinishedActivity([])).toBe(1);
    expect(firstUnfinishedActivity([row(1), row(2), row(3, false)])).toBe(3);
    expect(firstUnfinishedActivity([1, 2, 3, 4, 5, 6, 7].map((n) => row(n)))).toBeNull();
  });

  it("isActivityUnlocked only checks lesson open and range", () => {
    expect(isActivityUnlocked(false, 1)).toBe(false);
    expect(isActivityUnlocked(true, 1)).toBe(true);
    expect(isActivityUnlocked(true, 7)).toBe(true);
    expect(isActivityUnlocked(true, 8)).toBe(false);
    expect(isActivityUnlocked(true, 0)).toBe(false);
  });

  it("lessonActivitiesComplete requires all seven activities", () => {
    expect(lessonActivitiesComplete([])).toBe(false);
    expect(lessonActivitiesComplete([1, 2, 3, 4, 5, 6].map((n) => row(n)))).toBe(false);
    expect(lessonActivitiesComplete([1, 2, 3, 4, 5, 6, 7].map((n) => row(n)))).toBe(true);
    expect(lessonActivitiesComplete([1, 2, 3, 4, 5, 6, 7].map((n) => row(n, n !== 7)))).toBe(false);
  });

  it("activityProgressFraction counts completed activities", () => {
    expect(activityProgressFraction([])).toBe(0);
    expect(activityProgressFraction([row(1), row(2), row(3, false)])).toBeCloseTo(2 / 7);
    expect(activityProgressFraction([1, 2, 3, 4, 5, 6, 7].map((n) => row(n)))).toBe(1);
  });
});

describe("vocabStepPlan", () => {
  it("produces exactly 18 ordered steps in the spec layout", () => {
    const plan = vocabStepPlan();
    expect(plan).toHaveLength(18);
    expect(plan.map((s) => s.step)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(plan.slice(0, 5).map((s) => s.kind)).toEqual(["review", "review", "review", "review", "review"]);
    expect(plan[4].grammarIndex).toBe(0);
    expect(plan.slice(5, 9).every((s) => s.kind === "recall")).toBe(true);
    expect(plan.slice(9, 17).map((s) => s.kind)).toEqual([
      "fill", "speak", "fill", "speak", "fill", "speak", "fill", "speak",
    ]);
    expect(plan[17]).toMatchObject({ step: 18, kind: "shadow", grammarIndex: 0 });
    expect(VOCAB_STEP_PLAN).toHaveLength(18);
    expect(vocabStepDescriptor(10)?.kind).toBe("fill");
    expect(vocabStepDescriptor(19)).toBeNull();
  });
});

describe("recall queue", () => {
  it("serves cards in order and masters after the streak threshold", () => {
    let state = createRecallQueue();
    expect(nextRecallItem(state)?.cardIndex).toBe(0);
    state = recordRecallAnswer(state, 0, true);
    expect(state.mastered).toHaveLength(0);
    state = recordRecallAnswer(state, 0, true);
    expect(state.mastered).toHaveLength(1);
    expect(nextRecallItem(state)?.cardIndex).toBe(1);
    expect(recallMasteryCount(state)).toEqual({ mastered: 1, total: 4 });
  });

  it("re-queues wrong answers at the back and resets the streak", () => {
    let state = createRecallQueue();
    state = recordRecallAnswer(state, 0, true);
    state = recordRecallAnswer(state, 0, true); // card 0 mastered
    state = recordRecallAnswer(state, 1, false); // card 1 missed, back of queue
    state = recordRecallAnswer(state, 2, true);
    state = recordRecallAnswer(state, 2, true); // card 2 mastered
    // Queue now: [3, 1] (1 was pushed behind 3).
    expect(nextRecallItem(state)?.cardIndex).toBe(3);
    state = recordRecallAnswer(state, 3, true);
    state = recordRecallAnswer(state, 3, true); // card 3 mastered
    expect(nextRecallItem(state)?.cardIndex).toBe(1);
    const missed = state.queue.find((item) => item.cardIndex === 1);
    expect(missed?.misses).toBe(1);
    expect(missed?.streak).toBe(0);
  });

  it("manual override masters immediately", () => {
    let state = createRecallQueue();
    state = recordRecallAnswer(state, 0, false);
    state = recordRecallAnswer(state, 0, true, { override: true });
    expect(state.mastered.map((item) => item.cardIndex)).toEqual([0]);
    expect(state.mastered[0].overridden).toBe(true);
  });
});

describe("matchVietnameseMeaning", () => {
  it("matches exact, punctuation and case variants", () => {
    expect(matchVietnameseMeaning("xin chào", "Xin chào!")).toBe(true);
    expect(matchVietnameseMeaning("  nhà hàng  ", "nhà hàng.")).toBe(true);
    expect(matchVietnameseMeaning("bệnh viện", "bệnh viện")).toBe(true);
  });

  it("splits stored definition delimiters into separate accepted senses", () => {
    expect(matchVietnameseMeaning("cửa hàng", "cửa hàng, cửa tiệm")).toBe(true);
    expect(matchVietnameseMeaning("cửa tiệm", "cửa hàng; cửa tiệm")).toBe(true);
    expect(matchVietnameseMeaning("shop", "cửa hàng / cửa tiệm", ["shop"])).toBe(true);
    expect(matchVietnameseMeaning("bệnh xá", "bệnh viện, phòng khám")).toBe(false);
  });

  it("accepts alternate meanings", () => {
    expect(matchVietnameseMeaning("cửa hàng", "cửa hàng", ["shop", "cửa tiệm"])).toBe(true);
  });

  it("tolerates small typos on longer meanings but rejects unrelated answers", () => {
    expect(matchVietnameseMeaning("thư viện trung tâm", "thư viện trung tâm")).toBe(true);
    expect(matchVietnameseMeaning("thư viện trung tam", "thư viện trung tâm")).toBe(true);
    expect(matchVietnameseMeaning("bệnh xá", "bệnh viện", ["phòng khám"])).toBe(false);
    expect(matchVietnameseMeaning("con mèo", "con chó")).toBe(false);
    expect(matchVietnameseMeaning("", "bất cứ điều gì")).toBe(false);
  });

  it("normalizeMeaning strips punctuation and collapses spaces", () => {
    expect(normalizeMeaning("  Xin  chào,  bạn! ")).toBe("xin chào bạn");
  });
});

describe("gradeMeaningLocally with seeded course cards", () => {
  const handoff = "Việc bàn giao công việc hoặc trách nhiệm cho người khác.";
  const backup = "Phương án dự phòng nếu kế hoạch ban đầu không thực hiện được.";
  const checklist = "Danh sách các mục cần làm hoặc kiểm tra.";
  const cucumber = "Một quả dưa chuột; một trái dưa leo.";
  const falseEconomy = "Cách tiết kiệm trước mắt nhưng cuối cùng khiến tổng chi phí tăng.";
  const bigger = "To hơn một chút.";

  it.each([
    ["bàn giao", handoff, "correct"],
    ["sự bàn giao", handoff, "correct"],
    ["BAN GIAO!", handoff, "correct"],
    ["ban giáo", handoff, "wrong"],
    ["công việc", handoff, "wrong"],
    ["phần công việc", handoff, "wrong"],
    ["người khác", handoff, "wrong"],
    ["trách nhiệm", handoff, "wrong"],
    ["bàn công", handoff, "unsure"],
    ["chuyển giao", handoff, "unsure"],
    ["không bàn giao", handoff, "unsure"],
    ["con mèo", handoff, "wrong"],
    ["?", handoff, "wrong"],
    ["x", handoff, "wrong"],
    ["phuong an du phong", backup, "correct"],
    ["kế hoạch ban đầu", backup, "wrong"],
    ["danh sách mục", checklist, "correct"],
    ["kiểm tra", checklist, "wrong"],
    ["dưa chuột", cucumber, "correct"],
    ["mot trai dua leo", cucumber, "correct"],
    ["tiết kiệm", falseEconomy, "wrong"],
    ["to hơn", bigger, "correct"],
    ["to", bigger, "unsure"],
    ["vay tiền", "Việc cho vay tiền với lãi suất.", "wrong"],
  ] as const)("grades %s against %s as %s", (answer, definition, expected) => {
    expect(gradeMeaningLocally(answer, definition)).toBe(expected);
    expect(matchVietnameseMeaning(answer, definition)).toBe(expected === "correct");
  });

  it("uses English definitions and synonyms for overlap without accepting a partial match", () => {
    expect(gradeMeaningLocally("transfer ownership", handoff, ["Transfer of work or responsibility to someone else."])).toBe("unsure");
    expect(gradeMeaningLocally("hạn chót", "Mốc cuối để nộp bài.", ["hạn nộp"])).toBe("unsure");
  });
});

describe("fill answers and cloze", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(normalizeFillAnswer("  Check-in,  please! ")).toBe("check in please");
    expect(normalizeFillAnswer("well-known")).toBe("well known");
  });

  it("accepts exact term, inflections and multiword phrases", () => {
    expect(isFillAnswerCorrect("check in", "check in")).toBe(true);
    expect(isFillAnswerCorrect("Check-in", "check in")).toBe(true);
    expect(isFillAnswerCorrect("checks in", "check in")).toBe(false); // phrase inflects last word only
    expect(isFillAnswerCorrect("walks", "walk")).toBe(true);
    expect(isFillAnswerCorrect("walked", "walk")).toBe(true);
    expect(isFillAnswerCorrect("walking", "walk")).toBe(true);
    expect(isFillAnswerCorrect("cities", "city")).toBe(true);
    expect(isFillAnswerCorrect("studies", "study")).toBe(true);
    expect(isFillAnswerCorrect("take a break", "take a break")).toBe(true);
    expect(isFillAnswerCorrect("takes a break", "take a break")).toBe(false);
    expect(isFillAnswerCorrect("took", "take")).toBe(false);
    expect(isFillAnswerCorrect("", "walk")).toBe(false);
  });

  it("tolerates one small typo on longer single-word answers", () => {
    expect(isFillAnswerCorrect("restarant", "restaurant")).toBe(true);
    expect(isFillAnswerCorrect("restaraunt", "restaurant")).toBe(true);
    expect(isFillAnswerCorrect("restaraunt", "take a break")).toBe(false); // multiword stays strict
    expect(isFillAnswerCorrect("cat", "dog")).toBe(false);
    expect(isFillAnswerCorrect("wolk", "walk")).toBe(false); // too short for typo tolerance
  });

  it("buildCloze removes the first whole-word occurrence", () => {
    const cloze = buildCloze("I usually check in early.", "check in");
    expect(cloze).toEqual({ before: "I usually", after: "early.", answer: "check in" });
    expect(buildCloze("Checking in is easy.", "check in")).toEqual({ before: "", after: "is easy.", answer: "Checking in" });
    expect(buildCloze("She works at the coffee shop.", "coffee shop")).toEqual({
      before: "She works at the", after: ".", answer: "coffee shop",
    });
    expect(buildCloze("No match here.", "absent")).toBeNull();
  });

  it("buildCloze matches inflected surface forms of the term", () => {
    expect(buildCloze("She walked to the station.", "walk")).toEqual({
      before: "She", after: "to the station.", answer: "walked",
    });
    expect(buildCloze("They are studying for exams.", "study")).toEqual({
      before: "They are", after: "for exams.", answer: "studying",
    });
    expect(buildCloze("He checks in twice a day.", "check in")).toEqual({
      before: "He", after: "twice a day.", answer: "checks in",
    });
  });
});

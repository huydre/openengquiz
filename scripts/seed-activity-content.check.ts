import assert from "node:assert/strict";
import { activityContentProblems } from "./seed-activity-content";

const input = { warmupQuestion: "When do you study?" };
const content = {
  warmupVi: "Bạn học vào lúc nào?",
  speaking: [
    { en: "Where do you do your homework?", vi: "Bạn làm bài tập ở đâu?", part: 1 },
    { en: "Do you study with friends?", vi: "Bạn có học cùng bạn bè không?", part: 1 },
    { en: "Should schools teach study skills?", vi: "Trường học có nên dạy cách học không?", part: 3 },
  ] as const,
  grammar: [],
};
const speaking = [...content.speaking];
assert.deepEqual(activityContentProblems(input, { ...content, speaking, conversation: "Tình huống: Hai bạn chọn giờ học cùng nhau." }), []);
assert.deepEqual(activityContentProblems(input, { ...content, speaking, conversation: "Mai: When are you free?\nBen: After lunch." }), ["conversation is a dialogue script, expected a scenario"]);

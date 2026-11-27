import type { PronunciationResult } from "./client";

export function pronunciationHint(issue: PronunciationResult["issues"][number]): string | null {
  const expected = issue.expected?.replace(/[/\[\]]/g, "");
  const heard = issue.heard?.replace(/[/\[\]]/g, "");
  if (issue.kind === "deletion" || issue.kind === "omission" || (expected && !heard)) {
    return issue.word ? `Đọc đủ các âm, nhất là âm cuối của từ ${issue.word}.` : "Đọc đủ các âm, nhất là âm cuối.";
  }
  if (expected === "θ") return "Đặt nhẹ đầu lưỡi giữa hai hàm răng, thổi hơi ra và không rung cổ họng.";
  if (expected === "ð") return "Đặt nhẹ đầu lưỡi giữa hai hàm răng và rung cổ họng khi đẩy hơi ra.";
  if (expected === "ʃ" && heard === "s") return "Lùi lưỡi ra sau một chút và tròn môi nhẹ để tạo âm /ʃ/.";
  if (expected === "s" && heard === "ʃ") return "Đưa lưỡi ra trước và giữ môi tự nhiên để tạo âm /s/.";
  if ((expected?.includes("ː") && !heard?.includes("ː")) ||
      (expected === "i" && heard === "ɪ") || (expected === "u" && heard === "ʊ")) {
    return "Giữ nguyên âm lâu hơn một chút, không thêm âm ở cuối.";
  }
  if ((heard?.includes("ː") && !expected?.includes("ː")) ||
      (expected === "ɪ" && heard === "i") || (expected === "ʊ" && heard === "u")) {
    return "Rút ngắn nguyên âm và thả lỏng miệng hơn.";
  }
  for (const feature of issue.features) {
    if (feature.feature === "voicing") {
      if (feature.expected === "voiced") return "Thử đặt tay lên cổ họng và phát âm sao cho thấy rung nhẹ.";
      if (feature.expected === "voiceless") return "Đẩy hơi ra mà không làm rung cổ họng.";
    }
    if (feature.feature === "backness") {
      if (feature.expected === "front") return "Đưa thân lưỡi về phía trước khi đọc nguyên âm.";
      if (feature.expected === "back") return "Lùi thân lưỡi về phía sau khi đọc nguyên âm.";
      if (feature.expected === "central") return "Giữ thân lưỡi ở giữa khoang miệng.";
    }
  }
  return null;
}

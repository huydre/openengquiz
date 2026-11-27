import { BookCheck, Gamepad2, Headphones, ListChecks, PenLine, type LucideIcon } from "lucide-react";
import type { StudyMode } from "@/lib/study/study-types";

/** Names, blurbs and colours of the card-based study modes; the names match the set page. */
export const STUDY_MODE_META: Record<StudyMode, { label: string; description: string; icon: LucideIcon; tone: string }> = {
  learn: {
    label: "Học từng bước",
    description: "Học theo đợt 6 thẻ: nhận ra nghĩa trước, rồi tự gõ lại từ. Thẻ sai sẽ quay lại cho đến khi bạn nhớ.",
    icon: BookCheck,
    tone: "bg-primary/15 text-primary",
  },
  quiz: {
    label: "Trắc nghiệm",
    description: "Tự kiểm tra với nhiều dạng câu hỏi. Chọn số câu và dạng câu bạn muốn.",
    icon: ListChecks,
    tone: "bg-secondary/15 text-secondary",
  },
  dictation: {
    label: "Nghe chép",
    description: "Nghe phát âm rồi gõ lại từ hoặc câu ví dụ bạn nghe được.",
    icon: Headphones,
    tone: "bg-secondary/15 text-secondary",
  },
  writing: {
    label: "Luyện viết",
    description: "Nhìn nghĩa, gõ từ tiếng Anh. Từ viết sai sẽ quay lại ở cuối lượt.",
    icon: PenLine,
    tone: "bg-secondary/15 text-secondary",
  },
  game: {
    label: "Trò chơi",
    description: "15 giây cho mỗi câu. Trả lời đúng liên tiếp để nhân điểm.",
    icon: Gamepad2,
    tone: "bg-brand-orange/15 text-brand-orange",
  },
};

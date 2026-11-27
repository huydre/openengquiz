import { OG_SIZE, renderOgImage } from "@/lib/og/og-image";

export const alt = "OpenEngQuiz: Học từ nào, nói từ đó";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Default link preview for every page without its own. */
export default async function Image() {
  return renderOgImage({
    eyebrow: "Học tiếng Anh miễn phí",
    title: "Học từ nào, nói từ đó.",
    highlight: "nói",
    subtitle: "Thẻ từ vựng, luyện nói được AI chấm và gọi điện với gia sư AI, bằng chính những từ bạn vừa học.",
    chips: ["Lộ trình IELTS", "Luyện nói AI", "Ôn tập ngắt quãng"],
    card: { term: "commute", meaning: "đi làm hằng ngày", label: "verb", badge: true },
  });
}

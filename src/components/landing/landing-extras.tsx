import Link from "next/link";
import { Faq5, type FaqCategory } from "@/components/ui/faq-5";
import Newsletter2 from "@/components/ui/newsletter-2";
import Testimonials2, { type Testimonial } from "@/components/ui/testimonials-2";
import { subscribeNewsletter } from "@/lib/newsletter/subscribe-newsletter";

/**
 * Learner quotes for the landing. Only add real quotes, with the learner's permission; while the
 * list is empty the section is not shown.
 */
const TESTIMONIALS: Testimonial[] = [];

export function LandingTestimonials() {
  return (
    <Testimonials2
      heading="Người học nói gì"
      description="Chia sẻ từ những người đang học với OpenEngQuiz."
      testimonials={TESTIMONIALS}
    />
  );
}

export function LandingNewsletter() {
  return (
    <Newsletter2
      action={subscribeNewsletter}
      heading="Nhận tin khi có bài học mới"
      description="Một email ngắn khi có cấp độ, bài học hoặc tính năng mới. Không spam."
      label="Email của bạn"
      placeholder="ban@email.com"
      buttonText="Đăng ký"
      disclaimer={<>Khi đăng ký, bạn đồng ý với <Link href="/privacy" className="font-bold underline">Chính sách bảo mật</Link>.</>}
    />
  );
}

const FAQ: FaqCategory[] = [
  {
    title: "Câu hỏi thường gặp",
    description: (
      <>
        Chưa thấy câu trả lời bạn cần? Gửi câu hỏi qua{" "}
        <a href="https://github.com/huydre/openengquiz/issues" className="text-primary-edge font-bold underline">GitHub</a>.
      </>
    ),
    items: [
      { question: "OpenEngQuiz có miễn phí không?", answer: "Có. Mọi tính năng đều miễn phí và không có quảng cáo. Các tính năng AI có giới hạn lượt dùng mỗi ngày để giữ dịch vụ miễn phí cho mọi người." },
      { question: "Tôi nên bắt đầu từ cấp độ nào?", answer: "Lộ trình IELTS bắt đầu từ cấp Lấy gốc, dành cho người mới. Nếu đã có nền tảng, bạn có thể chọn cấp cao hơn trên trang Khoá học." },
      { question: "Điểm band AI chấm có giống điểm thi thật không?", answer: "Không. Đây là ước lượng để bạn luyện tập và thấy mình tiến bộ, không phải điểm IELTS chính thức." },
      { question: "App có lưu giọng nói của tôi không?", answer: "Không lưu tệp ghi âm. Bản ghi được gửi đi để chép lời và chấm điểm, chỉ văn bản và điểm số được lưu vào lịch sử của bạn." },
      { question: "Học trên điện thoại được không?", answer: "Được. OpenEngQuiz chạy trên trình duyệt của điện thoại và máy tính, không cần cài đặt. Hãy cho phép dùng micro để luyện nói." },
      { question: "Tôi có tạo bộ từ riêng được không?", answer: "Có. Bạn tự thêm thẻ hoặc để AI tạo thẻ từ danh sách từ, đoạn văn, chủ đề hay ảnh chụp, gắn ảnh hoặc GIF cho thẻ và chia sẻ bộ từ bằng link." },
    ],
  },
];

export function LandingFaq() {
  return (
    <div id="cau-hoi" className="scroll-mt-24 border-t-2">
      <Faq5 categories={FAQ} />
    </div>
  );
}

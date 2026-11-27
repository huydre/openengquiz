import Link from "next/link";

export const metadata = { title: "Điều khoản sử dụng", description: "Điều khoản khi sử dụng OpenEngQuiz." };

export default function TermsPage() {
  return (
    <article className="space-y-3">
      <h1>Điều khoản sử dụng</h1>
      <p className="text-muted-foreground text-sm">Cập nhật ngày 27/11/2026</p>
      <p>Khi dùng OpenEngQuiz, bạn đồng ý với các điều khoản dưới đây.</p>

      <h2>Dịch vụ miễn phí</h2>
      <p>OpenEngQuiz miễn phí và được cung cấp &ldquo;nguyên trạng&rdquo;. Các tính năng AI có giới hạn lượt dùng mỗi ngày để giữ dịch vụ miễn phí cho mọi người. Chúng tôi có thể thay đổi hoặc tạm dừng tính năng khi cần.</p>

      <h2>Nội dung do AI tạo</h2>
      <p>Nghĩa từ, ví dụ, câu hỏi, nhận xét và điểm band do AI tạo có thể sai. Điểm band chỉ là ước lượng để luyện tập, không phải điểm thi IELTS chính thức.</p>

      <h2>Nội dung của bạn</h2>
      <ul>
        <li>Bạn giữ quyền với bộ từ và ảnh bạn tạo. Khi đặt bộ từ ở chế độ công khai hoặc có link, người khác có thể xem nó.</li>
        <li>Không tải lên nội dung vi phạm pháp luật, xúc phạm, khiêu dâm hoặc vi phạm bản quyền.</li>
        <li>Không dùng dịch vụ để gửi tự động số lượng lớn yêu cầu hoặc tìm cách vượt giới hạn lượt dùng.</li>
      </ul>

      <h2>Tài khoản</h2>
      <p>Bạn chịu trách nhiệm giữ an toàn tài khoản của mình. Bạn có thể xoá tài khoản bất cứ lúc nào tại trang <Link href="/account" className="text-primary-edge font-bold underline">Tài khoản</Link>. Chúng tôi có thể khoá tài khoản vi phạm các điều khoản này.</p>

      <h2>Quyền riêng tư</h2>
      <p>Cách chúng tôi xử lý dữ liệu được mô tả trong <Link href="/privacy" className="text-primary-edge font-bold underline">Chính sách bảo mật</Link>.</p>
    </article>
  );
}

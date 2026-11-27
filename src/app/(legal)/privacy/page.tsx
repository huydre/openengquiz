import Link from "next/link";

export const metadata = { title: "Chính sách bảo mật", description: "Cách OpenEngQuiz thu thập, sử dụng và xoá dữ liệu của bạn." };

export default function PrivacyPage() {
  return (
    <article className="space-y-3">
      <h1>Chính sách bảo mật</h1>
      <p className="text-muted-foreground text-sm">Cập nhật ngày 27/11/2026</p>
      <p>OpenEngQuiz là ứng dụng học tiếng Anh miễn phí. Trang này giải thích dữ liệu nào được lưu, dùng vào việc gì và cách bạn xoá chúng.</p>

      <h2>Dữ liệu chúng tôi lưu</h2>
      <ul>
        <li><strong>Tài khoản:</strong> email, tên hiển thị, mục tiêu và trình độ bạn chọn khi bắt đầu.</li>
        <li><strong>Nội dung học:</strong> bộ từ, thẻ, ảnh bạn gắn vào thẻ, thư mục, tiến độ ôn tập, kết quả bài học và lịch sử luyện nói (dạng văn bản và điểm số).</li>
        <li><strong>Ảnh bạn tải lên:</strong> lưu trong kho riêng gắn với tài khoản của bạn; ảnh trong bộ từ công khai có thể được người khác xem.</li>
        <li><strong>Số lượt dùng AI:</strong> đếm theo ngày để giới hạn chi phí, không chứa nội dung câu hỏi.</li>
      </ul>

      <h2>Giọng nói</h2>
      <p>Khi bạn luyện nói, bản ghi âm được gửi đến dịch vụ chép lời (Groq hoặc máy chủ giọng nói của chúng tôi) và dịch vụ chấm phát âm để tạo văn bản và điểm. <strong>Chúng tôi không lưu tệp ghi âm.</strong> Chỉ văn bản chép lời và điểm số được lưu vào lịch sử của bạn. Micro chỉ bật khi bạn bấm nói hoặc khi đang trong cuộc gọi với gia sư AI.</p>

      <h2>Dịch vụ AI và bên thứ ba</h2>
      <ul>
        <li><strong>DeepSeek và Groq:</strong> nhận văn bản (câu trả lời, từ cần tra, hội thoại) để tạo nhận xét, nghĩa từ, câu hỏi và trả lời của gia sư.</li>
        <li><strong>Giọng đọc:</strong> câu cần đọc được gửi tới dịch vụ tạo giọng; tệp âm thanh được lưu lại để dùng chung cho mọi người.</li>
        <li><strong>Ảnh và GIF:</strong> từ khoá tìm ảnh được gửi tới GIPHY, Pixabay hoặc Openverse.</li>
        <li><strong>Supabase:</strong> lưu cơ sở dữ liệu, đăng nhập và tệp. <strong>Vercel:</strong> chạy trang web.</li>
      </ul>
      <p>Chúng tôi không bán dữ liệu và không dùng dữ liệu của bạn cho quảng cáo.</p>

      <h2>Xoá dữ liệu</h2>
      <p>Bạn có thể xoá tài khoản bất cứ lúc nào tại trang <Link href="/account" className="text-primary-edge font-bold underline">Tài khoản</Link>. Việc xoá là vĩnh viễn: tài khoản, bộ từ, thẻ, tiến độ, lịch sử và ảnh bạn tải lên đều bị xoá.</p>

      <h2>Liên hệ</h2>
      <p>Nếu có câu hỏi về dữ liệu của bạn, hãy liên hệ chúng tôi qua trang GitHub của dự án.</p>
    </article>
  );
}

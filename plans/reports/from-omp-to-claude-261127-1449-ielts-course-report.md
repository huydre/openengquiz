# Báo cáo: Khoá học IELTS thay Lộ trình

## Đã làm

- `content/courses/ielts.yaml`: 7 cấp, 42 phần, 210 bài tự soạn. Mỗi bài có tên tiếng Anh, icon Lucide, câu hỏi nói và phạm vi từ. Mục tiêu 1.980 thẻ sau seed.
- `scripts/seed-courses.ts`, `src/lib/courses/course-catalog.ts`, `src/lib/courses/course-progress.ts`: kiểm giáo trình, sinh danh sách từ qua DeepSeek, bỏ từ trùng toàn khoá và bổ sung dữ liệu thẻ qua pipeline hiện có. Seed từng cấp hoặc mọi cấp còn thiếu; ghi mỗi cấp nguyên tử.
- `src/app/(app)/courses/`, `src/components/courses/`, `src/app/api/courses/`: danh mục, bản đồ, chọn cấp, mục tiêu, sổ từ và bài học 4 bước. Tái dùng `VocabLesson` và AI Call; so sánh hai lượt nói, đếm từ mục tiêu và lưu phát âm. Bài kế tiếp chỉ mở sau khi đủ bốn bước.
- Trang chủ, sidebar và `/review`: Học tiếp theo khoá/cấp đã chọn hoặc gợi ý IELTS theo CEFR; bỏ tuyến Lộ trình và lọc theo lộ trình. Giữ lọc theo bộ từ.
- Lỗi runtime Supabase `PGRST205` xác nhận trong log: `public.courses` và `public.course_choices` chưa có trên DB đang kết nối. Trang chủ cô lập phần Học tiếp; danh mục báo không tải được thay vì ném lỗi runtime. Đây không thay thế migration.

## Kiểm thực tế

- `pnpm test && pnpm typecheck && pnpm lint`: 66 test đậu; không lỗi kiểu/lint; 5 cảnh báo vendor có sẵn.
- PostgreSQL tạm: chạy toàn bộ migration; kiểm seed không nhân đôi, rollback khi trùng từ, chặn chuyển bước sớm, mở bài sau, lưu khoá đang học, RLS và sổ từ. Không chạm Supabase.
- Dev 3100: ba trang mới trả 307 về đăng nhập, hai API trả 401 khi chưa đăng nhập. Log ghi biên dịch thành công và lỗi schema đã được bắt sau sửa; log phiên trình duyệt vẫn có cảnh báo hydration riêng. Preview Chromium dùng giáo trình thật với tiến độ mẫu, không phải phiên học đăng nhập. Route preview đã xoá, trả 404.
- Ảnh: [bản đồ](ielts-course-map.webp), [chọn cấp](ielts-course-levels.webp), [mục tiêu](ielts-course-goals.webp).

## Migration và seed

- Cần áp `supabase/migrations/20261127160000_courses.sql`: thêm 6 bảng có RLS, RPC và liên kết `speaking_attempts.lesson_id`; xoá metadata/liên kết Lộ trình. `study_sets` và `cards` không bị xoá, gồm cả 10 bộ riêng tư và 122 thẻ được báo cáo từ lần nhập trước.
- Chưa chạy seed. Ước lượng khoảng 420 lượt DeepSeek nếu mỗi bài cần một lượt chọn từ và một lượt bổ sung, không retry và không trúng cache. Cache đủ có thể giảm lượt bổ sung. Trần lý thuyết 3.780 lượt nếu cả 210 bài đều dùng 6 batch, mỗi batch một lượt chọn và hai lượt bổ sung; quota 1.500/ngày có thể dừng sớm hơn.
- Duyệt từ, IPA và ví dụ trên DB thử trước khi seed môi trường thật, vì mỗi cấp xuất bản công khai khi lưu. Sau migration và seed, thử toàn bộ bốn bước khi đăng nhập với mic, dịch vụ phát âm, DeepSeek và sổ từ thật. Chưa có kết quả cho luồng này.
- Câu hỏi mở: chưa có DB thử được chỉ định để duyệt nội dung trước khi xuất bản.

Status: DONE_WITH_CONCERNS
Summary: Đã viết Khoá học IELTS 7 cấp và kiểm SQL cục bộ, HTTP khách, giao diện preview; cần áp migration, seed, duyệt từ và kiểm luồng học đăng nhập với dịch vụ thật.

# Bàn giao Phase 06: Luyện nói và phát âm

## File thay đổi

- `src/components/audio/{audio-recorder.tsx,pcm-capture-worklet.ts,wav-encoder.ts,wav-encoder.test.ts}`: consent trước khi mở mic, thời lượng và mức âm, ghi WAV PCM 16 kHz mono 16-bit tối đa 60 giây, nghe lại và xóa bản ghi cục bộ. Nhận dạng tiếng Anh `en-US` trên trình duyệt khi không dùng Groq.
- `src/app/(app)/pronunciation/page.tsx`, `src/app/(app)/study/[setId]/speaking/page.tsx`, `src/components/speaking/{speaking-practice,speaking-result}.tsx`: câu tự nhập hoặc ví dụ thẻ, câu hỏi từ mục tiêu, bản chép sửa được, nghe mẫu bằng `playTts`, điểm theo từ/âm vị và góp ý tiếng Việt. Dùng Watermelon Select và LogoLoader.
- `src/app/api/speaking/{question,assess}/route.ts`, `src/lib/ai/speaking-feedback.ts`, `src/lib/speech/{speaking-wav,pronunciation-hints}{,.test}.ts`: auth, quota, trần upload 5 MB/60 giây và timeout 30 giây, chấm theo câu mẫu hoặc bản chép, phản hồi DeepSeek có schema. Chưa bật DeepSeek vẫn chấm phát âm; câu hỏi có mẫu dự phòng. Không cache câu hỏi.
- `src/app/(app)/speaking/history/page.tsx`, `supabase/migrations/20261127120100_speaking_attempts.sql`: hiển thị 20 lượt gần nhất; chỉ lưu văn bản và kết quả, RLS giới hạn cho chủ sở hữu. API báo `saved: false` khi insert lỗi.
- `src/app/(app)/sets/[id]/page.tsx`, `src/app/(app)/sets/card-list.tsx`, `src/components/layout/{nav-items.ts,app-sidebar.tsx}`, `src/lib/supabase/proxy.ts`: lối vào bộ từ, câu ví dụ, sidebar và bảo vệ route.
- `README.md`, `.env.example`, `phase-06-ai-speaking-pronunciation.md`, `plan.md`: hướng dẫn cấu hình, quyền riêng tư và trạng thái.

## Kiểm tra đã chạy

- `pnpm test && pnpm typecheck && pnpm lint`: 47 test qua, typecheck qua, lint 0 lỗi và 5 cảnh báo vendor có sẵn. Không chạy build.
- PostgreSQL 14 tạm: áp migration, chủ sở hữu đọc/thêm được; người dùng khác không đọc hoặc thêm giả chủ sở hữu được. Không đẩy migration.
- Chromium desktop bằng fixture cục bộ: consent, meter, ghi WAV hợp lệ, nghe lại qua trình phát, xóa bản ghi; chọn từ bằng Watermelon Select; gửi bản chép tay và hiện điểm, IPA, phần gạch/thay «can handles» thành «can handle». API trong smoke UI dùng dữ liệu fixture, không phải kết quả DeepSeek thật. Đã dọn fixture.
- Cổng 3100: `/pronunciation`, `/study/[setId]/speaking` và `/speaking/history` trả 307 đến đăng nhập; hai POST `/api/speaking/{question,assess}` trả 401 khi chưa có phiên. UI fixture render trên cùng dev server; chưa render được trang bảo vệ với phiên đăng nhập.
- WAV giọng mẫu thật 2,542625 giây qua parser và `assessPronunciation` tới Pronunciada: HTTP 200, điểm 0,993, độ trễ 1.714 ms cho một lần gọi downstream. Không phải benchmark p95 hay kết quả từ route có phiên. WAV và AIFF tạm đã xóa.

## Việc còn lại và câu hỏi mở

1. Đẩy `20261127120100_speaking_attempts.sql`, đăng nhập Chrome và thử cả hai chế độ qua API thật, gồm lưu/đọc lịch sử. Chrome lúc smoke chuyển về đăng nhập; không có phiên sẵn để dùng.
2. Bật Groq nếu muốn STT server. Môi trường thử chưa bật Groq hoặc DeepSeek. Cần thử Web Speech thật, kiểm tra DeepSeek sửa ngữ pháp và nhận biết câu không dùng từ mục tiêu.
3. Thử trên Chrome Android, Safari iOS và đo p95 cho câu trả lời dài 20 giây. Mục tiêu dưới 8 giây chưa được xác minh.

OpenEngQuiz không lưu audio. Groq hoặc dịch vụ nhận dạng của trình duyệt có thể xử lý audio để tạo bản chép; DeepSeek chỉ nhận dữ liệu văn bản.

Status: DONE_WITH_CONCERNS
Summary: Hai chế độ luyện đã có code và qua smoke Chromium với fixture; Pronunciada thật và RLS cục bộ đã kiểm tra. Còn đẩy migration và xác minh toàn luồng với phiên đăng nhập, dịch vụ AI thật và thiết bị di động.

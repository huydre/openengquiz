# Bàn giao: Player Khoá học IELTS 7 bước

## Thay đổi

- `src/app/(app)/courses/[course]/lessons/[lessonId]/page.tsx`, `src/components/courses/{course-lesson,course-speaking,course-vocabulary}.tsx`: player 7 bước, lịch sử theo bài, tra từng từ, câu trả lời gõ hoặc WAV, góp ý CEFR, thẻ, phát âm, so sánh hai lần, hội thoại và tổng kết. Hoàn thành bài mở bài kế tiếp. Thu âm người dùng không được lưu thành tệp trên server.
- `src/components/tutor/tutor-narration.tsx`, `src/app/globals.css`, `src/components/ui/popover.tsx`, `src/components/audio/audio-recorder.tsx`: gia sư đọc từng câu, tốc độ, phụ đề, tạm dừng, nghe lại, bỏ qua; popover Watermelon dùng Radix; nhãn thu âm theo ngữ cảnh.
- `src/app/api/courses/lessons/[lessonId]/route.ts`, `src/lib/courses/{course-data,course-feedback,course-progress,course-question,lesson-player-state,lesson-player-types}.ts`: tải và lưu tiến độ, structured output với quota, gợi ý và bản dịch, giọng góp ý theo tài khoản. Lịch sử bài gồm các lần trả lời câu hỏi; lượt luyện từng từ vẫn tra theo thẻ qua API phát âm.
- `src/app/api/courses/lessons/[lessonId]/narration/route.ts`, `src/lib/courses/{narration,narration-server}.ts`, `src/lib/ai/{narration,quota-rules}.ts`, `src/app/api/tts/route.ts`, `src/lib/speech/{play-tts,tts-cache-key}.ts`: lời dẫn LLM cache theo bài và loại đoạn, câu mẫu dự phòng, tốc độ đọc phân biệt theo cache và khóa 1x tương thích cũ.
- `src/app/(app)/study/[setId]/call/call-session.tsx`, `src/app/api/conversation/route.ts`, `src/app/api/conversation/[threadId]/finish/route.ts`: dùng lại hội thoại gõ hoặc nói; tiếp tục phiên đã lưu; 4 đến 5 lượt trả lời; hoàn thành bài chỉ sau khi server chốt hội thoại.
- Test: `src/lib/courses/{course-question,lesson-player}.test.ts`, `src/lib/speech/tts-cache-key.test.ts`. Tài liệu: `docs/code-standards.md`, `plans/261126-2202-english-learning-web-mvp/{plan,phase-08-learning-paths}.md`.

## Migration cần áp theo thứ tự

1. [`20261127170000_lesson_narration.sql`](../../supabase/migrations/20261127170000_lesson_narration.sql): bảng cache lời dẫn, RLS đọc cho người đăng nhập, server ghi.
2. [`20261127170100_lesson_player.sql`](../../supabase/migrations/20261127170100_lesson_player.sql): chuyển tiến độ từ 4 sang 7 bước, giữ bài đã hoàn thành và lịch sử, lưu giọng góp ý, cho phép lượt gõ không có điểm phát âm, cập nhật RPC chuyển bước và chốt cuộc gọi.

Chưa đẩy migration. Kiểm chỉ đọc xác nhận Supabase đang thiếu `course_lessons.warmup_question_vi`, `profiles.feedback_tone` và bảng `lesson_narration`. Đây là nguyên nhân lỗi `42703` khi mở bài thật trên schema cũ. Không có thay đổi proxy, không commit, không chạy `pnpm build`; dev server 3100 vẫn hoạt động.

## Ảnh preview

Dùng câu hỏi và 8 thẻ thật của bài `After waking`, cấp `foundations`. Điểm, lịch sử, hội thoại và giọng đọc trong ảnh dùng dữ liệu mô phỏng. Đã xóa route `/shared/tmp-lesson-player-261127` và đóng tab preview.

1. [Gia sư mở đầu](lesson-player-01-intro.png)
2. [Nói trước](lesson-player-02-speak.png)
3. [Nhận xét lần 1](lesson-player-03-feedback.png)
4. [Gia sư chuyển đoạn](lesson-player-04-transition.png)
5. [Thẻ từ](lesson-player-05-review-cards.png)
6. [Phân tích phát âm](lesson-player-06-pronunciation.png)
7. [Nói lại](lesson-player-07-speak-again.png) · [So sánh](lesson-player-07-second-feedback.png) · [Hội thoại](lesson-player-07-call.png) · [Tổng kết](lesson-player-07-summary.png)

## Xác minh

- `pnpm test && pnpm typecheck && pnpm lint`: 78 test qua, typecheck qua, lint 0 lỗi, 5 cảnh báo có sẵn ở `text-effect.tsx`, `sidebar.tsx`, `tooltip-animated.tsx`. Chạy lại 12 test player, token và cache sau khi xóa helper trùng, tất cả qua.
- PostgreSQL cô lập: áp đủ chuỗi migration với dữ liệu tiến độ cũ. Smoke qua chuyển bước, retry giữ lịch sử, điểm phát âm null khi gõ, gate SRS, yêu cầu dấu chốt hội thoại của server và mở bài kế tiếp. Đã dừng PostgreSQL tạm.
- Chromium: phụ đề, tốc độ, pause, skip lời dẫn; tra từ, nhập câu, lịch sử và dịch mẫu; Space, Enter và mũi tên trên thẻ; ghi WAV với mic tổng hợp, điểm dưới 70%, âm vị, phát lại từ `blob:`, Tab vào Thử lại, bỏ qua sau ba lần; hội thoại gõ nhận stream và mở kết thúc ở lượt 4. Câu hỏi không tràn ngang ở viewport 390 px.
- Chưa đăng nhập: trang bài trả 307 tới `/login`; API bài, lời dẫn, kết thúc hội thoại trả 401.

## Còn lại / câu hỏi mở

- Sau khi duyệt, áp hai migration lên Supabase, rồi thử luồng đăng nhập với LLM, Kokoro, Groq STT và dịch vụ chấm phát âm thật. Smoke cục bộ và preview không thay cho lần chạy này.
- Lượt cũ giữ transcript và điểm phát âm đã lưu; không tính lại CEFR từ dữ liệu cũ. Tổng kết có thể hiển thị `Chưa có` cho điểm CEFR cũ.

Status: DONE_WITH_CONCERNS
Summary: Player 7 bước, 10 ảnh và kiểm tra cục bộ hoàn tất; Supabase đang thiếu hai migration nên chưa chạy được luồng đăng nhập với dịch vụ thật.

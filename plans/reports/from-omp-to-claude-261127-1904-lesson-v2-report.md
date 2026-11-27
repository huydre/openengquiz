# Bàn giao bài học IELTS v2

## Đã làm

- `supabase/migrations/20261127200000_course_activities.sql`: thêm `activity_content`, hai bảng có RLS (`course_activity_progress`, `course_word_questions`), liên kết lượt nói với hoạt động/bước, RPC `advance_course_activity` chỉ cho service role, RPC `seed_course_level_v2` và guard cho RPC cũ. Khi bật nội dung v2, giữ ngày hoàn tất của bài cũ; tiến độ dở dang bắt đầu lại theo cấu trúc mới. Trong bài đã mở, chọn hoạt động theo thứ tự bất kỳ; chỉ mở bài kế tiếp khi đủ bảy hoạt động.
- `scripts/seed-activity-content.ts`, `scripts/seed-lesson-activities.ts`, `scripts/seed-courses.ts`, `package.json`, `content/courses/ielts.yaml`: dùng chung bộ sinh nội dung. Mỗi bài gồm câu mở đầu đã có và bản dịch, ba câu Nói mới, hai điểm ngữ pháp và một kịch bản gọi. Tám thẻ xếp theo `(position, id)`, chia A/B mỗi nhóm bốn thẻ. Seed cấp mới ghi nội dung cùng bộ thẻ trong một giao dịch; backfill chỉ điền ô `activity_content` đang null.
- `src/lib/courses/lesson-activities.ts` và `.test.ts`: schema `{ speaking: [{en,vi,part}], grammar: [{title,explanationVi,exampleEn,exampleVi}], conversation }`, thứ tự bảy hoạt động, 18 bước từ vựng, hàng đợi nhớ nghĩa, chuẩn hoá đáp án và sinh câu điền từ. `course-feedback.ts` thêm nhận xét band ước lượng; `course-data.ts` đọc tiến độ v2 có điều kiện.
- `src/app/(app)/courses/[course]/page.tsx`, `lessons/[lessonId]/page.tsx`, `src/components/courses/course-map.tsx`: vòng tiến độ, hộp thoại chọn hoạt động, deep link `?activity=1..7`. Bài chưa có `activity_content` vẫn dùng player cũ; không yêu cầu cột mới trên DB cũ.
- `src/components/courses/`: `course-activity-lesson.tsx` giữ tiến độ và chọn hoạt động; `course-v2-speaking.tsx` hiện bản chép khi gửi, cho Tiếp tục sau khi lưu, không đợi nhận xét; `course-v2-vocabulary.tsx` có ôn thẻ, phát âm, nhớ nghĩa, điền từ, nói dùng từ và shadowing. `TutorNarration` nhận `initialSpeed` tùy chọn, mặc định cũ không đổi.
- Cập nhật `docs/code-standards.md` và `plans/261126-2202-english-learning-web-mvp/plan.md`. Không sửa file thuộc phiên AI Call, không tạo branch/worktree, không commit, không đẩy migration.

## Hợp đồng UI và API

- `CourseActivityLesson` nhận `course`, `lesson`, `partNumber`, `lessonNumber`, `content`, `cards`, `progress`, `attempts`, `initialActivity?`, `tone`, `speech`, `ai`, `next?`, `call?`. Mỗi lượt nói có `id`, `activity`, `smallStep`, `transcript`, `feedback`; mỗi hàng tiến độ có `activity`, `small_step`, `state`, `completed_at`.
- `useLessonActivities(lessonId)` trả `post<T>(action, activity, smallStep, fields?, audio?)`, `busy`, `error`, `clearError`. `busy` chỉ theo dõi ghi tiến độ. Các action `checkpoint`, `complete`, `start_call` trả `{progress}`; shell dùng kết quả để cập nhật vòng và bước hiện tại.
- `POST /api/courses/lessons/[lessonId]/activities`: `checkpoint` nhận `previousStep` và `state`; `complete` yêu cầu `threadId` cho hoạt động 7; `answer` nhận `transcript` và trả `attemptId`; `feedback` nhận `attemptId` và `tone?`; `ideas` trả `{ideas}`; `word_question` trả `{question}` và cache theo thẻ. `pronunciation` dùng multipart với `action`, `activity`, `smallStep`, `audio`; server chọn từ hoặc câu ngữ pháp làm chuẩn và trả `{pron, attemptId}`. API cũ từ chối ghi vào bài đã bật v2.
- Hoạt động 7 dùng `CallSession` với `scenario: "course"`, `resume`, `onComplete(threadId)`. Chỉ mở cuộc gọi sau khi `start_call` lưu thành công hoặc có cuộc gọi để tiếp tục. Backend Call hiện vẫn lấy `warmup_question` làm chủ đề, dù UI hiển thị `activity_content.conversation`. Phiên AI Call cần sửa `src/lib/ai/conversation-context.ts` để ưu tiên `activity_content.conversation`, fallback sang `warmup_question`; dùng truy vấn tương thích DB chưa có cột. Không cần prop mới.

## Triển khai và kiểm tra

1. Claude áp migration `supabase/migrations/20261127200000_course_activities.sql`.
2. Chạy `pnpm seed:lesson-activities --level foundations`. Dùng `SEED_AI_BASE_URL`, `SEED_AI_API_KEY`, `SEED_AI_MODEL`, `SEED_CONTENT_OWNER_ID` và cấu hình Supabase từ môi trường. Không ghi lại giá trị. Có thể chạy lại sau lỗi; bài đã có dữ liệu không bị ghi đè. Seed cấp mới: `pnpm seed:courses --level <slug>`.
3. Đăng nhập và học trọn một bài sau khi có dữ liệu. Kiểm mic, chấm phát âm, nhận xét AI, kịch bản Call, quay lại bản đồ và mở bài kế tiếp. Claude hoàn thiện UI; không tạo route preview hay ảnh theo phạm vi đã đổi.

- `pnpm test`: 118 test, 22 file, đều qua. `pnpm typecheck`: qua. `pnpm lint`: 0 lỗi, 5 cảnh báo ở UI vendor. Bản cuối chạy lại test, typecheck và `pnpm lint --quiet`, đều qua.
- PostgreSQL tạm: áp toàn bộ migration; kiểm RLS/ownership, bài cũ đã hoàn tất, chuyển bước hợp lệ và từ chối nhảy bước, lưu lượt nói/phát âm, SRS bốn thẻ, Call marker, chọn hoạt động khác thứ tự, mở bài kế sau đủ bảy, seed nguyên tử và seed lặp không trùng. Đã dừng và dọn PostgreSQL tạm.
- Dev server: deep link bài v2 chưa đăng nhập trả `307` và giữ query trong `next`; API trả JSON `401`. Wildcard đọc DB cũ thành công. Preflight `pnpm seed:lesson-activities --level foundations` dừng vì DB thiếu `activity_content`, trước khi gọi LLM hoặc ghi dữ liệu. Chưa kiểm luồng v2 có đăng nhập trên DB thật. Không chạy `pnpm build`; không dừng server 3100.

Status: DONE_WITH_CONCERNS
Summary: Code bài học v2 và kiểm tra cục bộ đã xong. Cần áp migration, backfill foundations, nối kịch bản v2 vào backend Call và smoke luồng có đăng nhập.

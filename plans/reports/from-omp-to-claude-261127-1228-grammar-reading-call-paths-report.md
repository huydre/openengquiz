# Bàn giao Phase 07 và Phase 08

Phase 07 qua kiểm thử trước khi bắt đầu Phase 08. Hai phase đã qua kiểm tra cục bộ. Không tạo branch/worktree, không commit, không chạy `pnpm build`, không dừng dev server 3100, không đẩy migration, không chạy `pnpm seed:paths`.

## Phase 07: Grammar, Reading, AI Call

| Phần | File |
|---|---|
| Grammar | `src/lib/ai/grammar.ts`, `src/app/api/ai/grammar/route.ts`, `src/app/(app)/study/[setId]/grammar/page.tsx`, `src/components/grammar/grammar-practice.tsx` |
| Reading | `src/lib/ai/{reading,reading-generate,reading.test}.ts`, `src/app/api/ai/reading/route.ts`, `src/app/(app)/study/[setId]/reading/page.tsx`, `src/components/reading/reading-practice.tsx` |
| AI Call | `src/lib/ai/{conversation,conversation-types}.ts`, `src/lib/{http/multipart,speech/transcribe}.ts`, `src/app/api/conversation/{route.ts,[threadId]/turn/route.ts,[threadId]/finish/route.ts}`, `src/app/(app)/study/[setId]/call/{page.tsx,call-session.tsx}`, `src/app/api/speaking/assess/route.ts` |
| Lịch sử và điều hướng | `src/app/(app)/history/page.tsx`, `src/app/(app)/sets/[id]/page.tsx`, `src/components/layout/{nav-items.ts,app-sidebar.tsx}` |

- Grammar dịch Việt sang Anh và sửa câu, chấm theo nghĩa, lưu câu sai để thử lại. Reading kiểm đủ 5 đến 10 từ đã chọn, chỉ sinh lại tối đa một lần. Cache riêng hoạt động không cần secret; cache dùng chung cho bộ công khai cần quyền ghi server.
- Call nhận giọng hoặc chữ, stream văn bản trước TTS, giới hạn 15 lượt, tổng kết từ đã dùng/chưa dùng và lỗi. Không lưu audio. Không đổi proxy của Claude.
- Gate: 62 test, 14 file; typecheck qua; lint 0 lỗi, 5 cảnh báo vendor có sẵn. Dev 3100: `/history` và ba trang học trả 307 khi chưa đăng nhập, năm API POST trả 401.
- DeepSeek thật ở tầng hàm server: hai chế độ Grammar, một bản dịch khác cách diễn đạt chấm 100; Reading đủ 5/5 từ và 4 câu hỏi; Call qua 11 lượt, nhớ đích đến `museum`, tổng kết nhận biết `ticket`. Không chứng minh STT/TTS hay lưu lịch sử qua API có phiên.
- PostgreSQL tạm: riêng tư hội thoại, trần 15 lượt, từ chối tổng kết từ snapshot cũ và lượt sau khi đóng. Bài smoke này chạy trước khi thêm RPC `start_ai_call`.

## Phase 08: Lộ trình học

| Phần | File |
|---|---|
| Khám phá, tạo tay và tiến độ | `src/app/(app)/paths/{page.tsx,new/page.tsx,new/actions.ts,new/path-form.tsx,[id]/page.tsx}`, `src/components/paths/path-list.tsx`, `src/app/(app)/{home,review}/page.tsx`, `src/components/layout/nav-items.ts` |
| AI và poll | `src/app/(app)/paths/{ai/page.tsx,ai/ai-path-form.tsx,[id]/path-pending.tsx}`, `src/app/api/ai/paths/route.ts`, `src/lib/ai/{generate-path,generate-cards,quota-rules}.ts` |
| Danh mục và seed | `content/paths.yaml`, `scripts/seed-paths.ts`, `src/lib/paths/{path-data,path-cards,path-catalog,path-data.test}.ts`, `package.json`, `pnpm-lock.yaml`, `.env.example` |
| Tài liệu | `README.md`, `plans/261126-2202-english-learning-web-mvp/{plan,phase-07-ai-grammar-reading-call,phase-08-learning-paths}.md` |

- Public/owner theo RLS. Trang `/paths` vẫn yêu cầu đăng nhập theo proxy mặc định. Gợi ý theo mục tiêu và CEFR. Tiến độ lấy `review_states.state = 'review'` theo người xem; nút học tiếp bỏ bộ trống/không đọc được. Ôn lọc cả hàng đợi thẻ mới lẫn cũ trước limit, giữ quota chung mỗi ngày. Thẻ cần vào SRS từ Learn hoặc nút thêm bộ vào ôn tập.
- AI nhận mục tiêu, số tuần, CEFR. `after()` tiếp tục sinh sau HTTP 202; trang chi tiết poll và báo lỗi. Tối đa 10 bộ, 30 thẻ/bộ, chặn trùng trong cùng lộ trình, lọc thẻ thiếu IPA/nghĩa Việt/ví dụ. Nếu tiến trình bị hủy cứng, UI ngừng poll khi bản ghi quá 10 phút; tác vụ không tự chạy lại. Kiểm quota từng lần gọi, kể cả thử lại JSON. RPC ghi các bộ/thẻ nguyên tử, lộ trình AI mặc định riêng tư.
- Catalog chứa 18 lộ trình: IELTS, TOEIC, THPT, Everyday English, Word Form, Chunking và For Work. YAML chỉ chứa chủ đề, cấp độ, số từ; DeepSeek sinh từ rồi qua pipeline phase 05 để bổ sung IPA/giải nghĩa/ví dụ. Seed bỏ slug đã có trước khi gọi AI và DB chống ghi trùng. Dùng profile hệ thống đã tồn tại, UUID lấy từ `SEED_PATHS_OWNER_ID`; không tạo auth user trong script. Bộ và lộ trình được lưu riêng tư để duyệt.
- Gate: 65 test, 15 file; typecheck qua; lint 0 lỗi, 5 cảnh báo vendor có sẵn. Dev 3100: bốn trang lộ trình và `/review?path=…` trả 307, API trả 401. Log từng báo thiếu import trong lúc file form chưa được ghi, sau đó compile lại thành công. Không suy ra các trang có phiên đã render chỉ từ 307.
- Chromium với trang fixture tạm: thêm 2 bộ qua Watermelon Select, đổi thứ tự, đổi chia sẻ sang công khai và xác nhận chỉ còn bộ public trong form; gửi form AI thấy thông báo 401 thật. Fixture đã xóa và URL quay về fallback not-found của route chia sẻ.
- PostgreSQL tạm: anon đọc public, không rò lộ trình riêng hoặc tiến độ người khác; RPC tạo bộ/thẻ AI và seed idempotent theo slug. DeepSeek thật: tạo cấu trúc 6 chủ đề IELTS Speaking B1 cho 2 tuần; thử riêng 2 bộ qua pipeline tạo thẻ, được 30 + 28 thẻ đủ IPA, nghĩa Việt và ví dụ, không trùng. Chỉ bộ đếm quota smoke dùng bộ nhớ; không ghi Supabase.

## Migration cần áp

1. `supabase/migrations/20261127123000_ai_practice_history.sql`
2. `supabase/migrations/20261127124000_learning_paths.sql`

## Việc còn lại và câu hỏi mở

- Áp migration khi được phép. Bổ sung `SUPABASE_SECRET_KEY` cho các ghi SRS và seed; cấu hình `SEED_PATHS_OWNER_ID`. Chạy seed theo README sau khi duyệt kế hoạch chi phí, rồi kiểm nội dung và công khai bộ trước lộ trình.
- Kiểm toàn luồng bằng tài khoản thật: lưu/truy lại lịch sử, Call có mic/STT/TTS, gợi ý IELTS/B1 khi catalog đã public, tạo AI có poll, tiến độ sau ôn. Xác nhận giới hạn thời gian thực thi `after()` trên môi trường deploy.
- Chốt nơi nhận báo lỗi nội dung trước khi thêm nút báo lỗi; repo chưa có luồng này.
- Metadata xác nhận `Call07` dùng `devin/swe-2-flash` trước yêu cầu `local/dev`; Call07 hoàn tất. Lỗi 402 ghi nhận thuộc bước auto-thinking OpenRouter, không phải lỗi Devin trong metadata đã kiểm. Ba agent Phase 08 cũng dùng Devin lúc khởi chạy, đã bị hủy; phần còn lại làm trực tiếp. Thay đổi cấu hình model không được áp dụng do hết thời gian phê duyệt. Không còn agent chạy.

Status: DONE_WITH_CONCERNS
Summary: Phase 07 và 08 qua gate cục bộ và smoke DeepSeek; chưa đẩy migration, chưa seed và chưa xác minh toàn luồng có đăng nhập.

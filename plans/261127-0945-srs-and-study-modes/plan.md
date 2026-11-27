# Plan: SRS và chế độ học không AI

- Status: ready for implementation, 27/11/2026. Làm Phase 04 trước, sau đó Phase 03.
- Scope: [brief](../reports/from-claude-to-codex-261127-0944-srs-and-study-modes-brief.md), [Phase 04](../261126-2202-english-learning-web-mvp/phase-04-spaced-repetition.md), [Phase 03](../261126-2202-english-learning-web-mvp/phase-03-study-modes.md).
- Dependency: dùng schema và trang bộ từ hiện có. Phase 02 còn việc khác, nhưng SRS/Study chỉ cần `study_sets`, `cards`, auth, RLS đã có.
- Constraints: không đổi branch/worktree, không commit, không đẩy migration, không khởi động lại dev server 3100. UI tiếng Việt; code theo `docs/code-standards.md` và guide Next 16 cục bộ.

## Kiến trúc và dữ liệu

1. Pin `ts-fsrs@5.4.2` vì repo/CI dùng Node 22, còn v6 yêu cầu Node >=24; xác nhận peer/API sau cài. `src/lib/srs/fsrs.ts` là hàm thuần nhận state, rating, thời điểm, trả state/log đề xuất và khoảng thời gian cho 4 rating. Server chốt lịch; client chỉ hiện preview server trả.
2. Migration mới sau `20261126150000_core_schema.sql`: `profiles.new_cards_per_day` mặc định 20, `review_states.version` chống ghi đè, `review_logs.was_new` đếm thẻ mới, `user_daily_activity(user_id, day, reviews, studied, minutes)` với RLS đọc của chủ sở hữu và chỉ RPC được ghi. Index cho due queue và thống kê. Ngày theo `Asia/Ho_Chi_Minh`, nhất quán `startOfLocalDayUtc`.
3. RPC `commit_review`: `security definer`, `set search_path = ''`, chỉ grant execute cho `authenticated`, kiểm tra `auth.uid()`, quyền xem thẻ, rating và UUID; chỉ dùng user id từ auth. Thu hồi quyền ghi trực tiếp `review_states`/`review_logs` từ client để RPC là đường ghi duy nhất; vẫn giữ RLS đọc.
4. Một RPC là một transaction: khóa state `FOR UPDATE`, kiểm tra log theo `client_review_id` trước; cùng ID + cùng payload trả `duplicate` không ghi, cùng ID + payload khác trả lỗi; version lệch trả `stale`; hợp lệ thì cập nhật state/version, chèn log, tăng activity. Unique `(user_id, client_review_id)` là chốt cuối. Server tính FSRS từ state vừa đọc rồi truyền expected version; gặp `stale` trả conflict để client tải lại, không tự biến một click thành lượt review thứ hai.
5. RPC `enroll_set_cards` xác thực user và quyền xem set, insert trạng thái `new` cho thẻ trong bộ bằng `ON CONFLICT DO NOTHING`; Learn dùng cùng logic trong finish RPC sau lần hoàn thành đầu. Due queue lấy thẻ thuộc mọi bộ hoặc `?set=`, thẻ `new` giới hạn theo `was_new` đã review trong ngày VN; thẻ đã học đến hạn không bị giới hạn. Route review yêu cầu auth, validate body, không nhận FSRS state từ client.
6. Study logic thuần ở `src/lib/study/`; UI tái dùng `src/components/study/`. RPC `start_study_session` xác thực user/quyền xem set/mode rồi tạo session; thu hồi quyền ghi trực tiếp session/attempt từ client. Finish endpoint xác thực user, lấy thẻ thật, chấm attempts và gọi RPC `finish_study_session(session_id, attempts, score, total)`; RPC khóa session, xác nhận user/set/mode, membership của từng `card_id`, phiên chưa kết thúc, rồi chèn attempts, cập nhật score/finished_at, tăng `studied` ngày VN và enroll thẻ Learn trong cùng transaction. Lần gọi lại trả kết quả đã lưu, không tăng bộ đếm. Điểm game là cá nhân, không có leaderboard cạnh tranh; DB đảm bảo ranh giới user và idempotency, endpoint chịu trách nhiệm chấm đáp án. Worksheet chỉ tạo PDF, không tính phiên học.

## Thứ tự và quyền sở hữu file

| Bước | Chủ sở hữu riêng | Kết quả |
|---|---|---|
| 1. DB + SRS server | Migration mới trong `supabase/migrations/`, `src/lib/srs/*`, `src/app/api/review/*`, enroll action | Schema, RPC, wrapper, auth, test FSRS và DB. |
| 2. SRS UI | `src/app/(app)/review/*`, `src/components/review/*`, `src/app/(app)/stats/*` | Queue/filter, phím 1-4/Space, interval, empty/error states, stats thật. |
| 3. Study logic + PDF | `src/lib/study/*`, `src/app/api/worksheet/*`, `public/fonts/*` | Generator/matcher/Learn, persistence, font Việt có license OFL. |
| 4. Study UI | `src/app/(app)/study/*`, `src/components/study/*` | Learn, Quiz, Dictation, Writing, Game, Worksheet dùng chung câu hỏi. |
| 5. Tích hợp | Lead giữ `src/app/(app)/sets/[id]/page.tsx`, `src/app/(app)/home/page.tsx`, `src/components/layout/nav-items.ts`, `src/lib/supabase/proxy.ts` | Khu Học/Học tiếp, thêm cả bộ, due/streak/Ôn ngay, menu, protected routes gồm `/review`, `/stats`, `/study`. |
| 6. Docs | Lead hoặc docs owner giữ `README.md`, `docs/code-standards.md`, plan MVP và phase 03/04 | Status/checklist thật, migration cần đẩy, báo cáo bàn giao. |

## Quy ước sản phẩm

- `due today`: số thẻ đến hạn trước cuối ngày VN, gồm quá hạn; queue chỉ hiện `due_at <= now()` và thẻ mới còn quota. `mastered`: `state='review'` và `reps >= 3`. Retention: Hard/Good/Easy chia tổng review logs còn lưu. Streak: chuỗi ngày có `reviews + studied > 0`, bắt đầu hôm nay nếu có, nếu chưa thì hôm qua. Forecast: due 7 ngày VN, dồn quá hạn vào hôm nay.
- Learn: đợt 5-7 thẻ, trắc nghiệm rồi gõ, thẻ sai quay lại; bộ ít thẻ vẫn chạy. Quiz cấu hình câu và loại; Dictation dùng `speechSynthesis` và hint; Writing lặp lỗi; Game gốc có combo/điểm cá nhân từ sessions; Worksheet PDF có dấu Việt.
- Trang động đặt auth/params/searchParams trong `<Suspense>`; `params`/`searchParams` là Promise. Đọc guide Next 16 trước khi viết code.

## Gates

- Unit: Again đến hạn sau vài phút; Easy > Good > Hard; distractor không trùng đáp án, bộ <4 thẻ, matcher chuẩn hóa hoa/thường, khoảng trắng, dấu câu cuối; Learn lặp thẻ sai và dừng đúng.
- DB integration: cùng ID đồng thời chỉ một log/state/activity; hai ID cùng version không ghi đè; user khác không đọc/ghi; finish session lặp không tăng studied/enroll; nửa đêm VN đúng ngày.
- Manual: bàn phím/screen reader, PDF tiếng Việt, bộ rỗng/ít thẻ, set riêng tư/shared, số liệu home/stats khớp logs. Chạy compile sau sửa code; trước bàn giao chạy `pnpm test && pnpm typecheck && pnpm lint`. Build dùng thư mục output riêng nếu cần.

## Rủi ro và câu hỏi mở

- `review_logs.card_id` đang `ON DELETE CASCADE`; xóa thẻ làm mất log và đổi retention. Giữ hành vi schema hiện tại trong phạm vi này, nêu giới hạn khi bàn giao.
- Xác nhận API `ts-fsrs@5.4.2` sau khi cài vì kiểu `Card`, `Rating` và learning steps có thể đổi.

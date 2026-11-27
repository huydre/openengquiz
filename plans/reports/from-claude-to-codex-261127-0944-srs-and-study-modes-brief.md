# Brief cho Codex: phase 04 (SRS, streak, thống kê) rồi phase 03 (chế độ học không AI)

Project: `/Users/hnam/orca/projects/openengquiz`. Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit**. Tiếp nối brief trước (`plans/reports/from-claude-to-codex-261127-0853-onboarding-vocab-sets-brief.md`); các ràng buộc ở đó vẫn áp dụng.

## Đọc trước

- `plans/261126-2202-english-learning-web-mvp/phase-04-spaced-repetition.md`, `phase-03-study-modes.md`
- `supabase/migrations/20261126150000_core_schema.sql` (đã có `review_states`, `review_logs` với unique `(user_id, client_review_id)`, `study_sessions`, `study_attempts`)
- Code bộ từ bạn đã viết: `src/app/(app)/sets/`, `src/lib/vocab/`
- `docs/code-standards.md`, `AGENTS.md`

Phần tra từ AI/cache Claude đã làm xong (`src/app/api/lookup/route.ts`, `src/lib/supabase/admin.ts`, `src/lib/vocab/enrich-vietnamese.ts`); đừng sửa các file đó và **không cần đụng tới biến môi trường bí mật** trong việc này.

## Việc 1: Phase 04

- Cài `ts-fsrs`. `src/lib/srs/fsrs.ts`: wrapper thuần hàm (state hiện tại + rating + thời điểm → state mới + log + khoảng thời gian dự kiến cho 4 nút). Test Vitest: Again → đến hạn trong vài phút; Easy xa hơn Good; Good xa hơn Hard.
- Lịch tính **ở server**. Ghi state + log nguyên tử: viết hàm Postgres (RPC, `security invoker`, RLS vẫn áp dụng) hoặc cách khác đảm bảo double submit cùng `client_review_id` không tạo 2 log và không cập nhật state 2 lần.
- `/review`: hàng đợi thẻ đến hạn từ mọi bộ, lọc theo bộ (`?set=`), nút Again/Hard/Good/Easy có hiện khoảng thời gian, phím tắt 1-4, Space lật thẻ. Giới hạn thẻ mới/ngày mặc định 20 (thêm cột cài đặt vào `profiles` nếu cần).
- Thêm thẻ vào SRS: nút "Thêm vào ôn tập" trên trang bộ từ (cả bộ), và tự động sau khi học lần đầu ở Learn mode (việc 2).
- Streak + hoạt động ngày: migration `user_daily_activity(user_id, day date, reviews, studied, ...)` có RLS chỉ chủ sở hữu; ngày theo giờ Việt Nam (dùng lại `startOfLocalDayUtc` trong `src/lib/ai/quota-rules.ts` hoặc tách hàm chung). Cập nhật trong cùng thao tác review/kết thúc phiên học.
- `/stats`: số thẻ đến hạn hôm nay, đã thuộc, tỷ lệ nhớ (từ `review_logs`), streak hiện tại, heatmap hoạt động, dự báo ôn 7 ngày. Ưu tiên chart/heatmap của Watermelon nếu có, không thì làm bằng CSS/SVG đơn giản.
- `/home`: hiện số thẻ đến hạn + streak + nút "Ôn ngay".
- Bật mục "Ôn tập" trong `nav-items.ts`, thêm `/review`, `/stats` vào `PROTECTED_PREFIXES`.

## Việc 2: Phase 03

- `src/lib/study/{question-generator,answer-matcher,learn-algorithm}.ts` thuần hàm, có test (đáp án nhiễu không trùng đáp án đúng; bộ < 4 thẻ vẫn chạy; matcher bỏ qua hoa/thường, khoảng trắng thừa, dấu câu cuối).
- Trang `/study/[setId]/{learn,quiz,dictation,writing,game,worksheet}` dùng chung component câu hỏi (`src/components/study/`). Lưu `study_sessions` + `study_attempts`.
  - Learn: đợt 5 đến 7 thẻ, trắc nghiệm rồi gõ đáp án, thẻ sai quay lại; học xong lần đầu thì đưa thẻ vào SRS.
  - Quiz: chọn số câu và loại câu (trắc nghiệm, đúng/sai, điền từ, nối), chấm điểm, xem lại câu sai.
  - Dictation: phát âm bằng `speechSynthesis` (Azure TTS chưa có), gõ lại từ hoặc câu ví dụ, có gợi ý chữ cái.
  - Writing: nhìn nghĩa gõ từ, lặp lại từ sai.
  - Game: một mini-game tự thiết kế (ví dụ chọn đúng nghĩa trước khi hết giờ, có combo/điểm, điểm cao nhất của bản thân). Không mô phỏng game của sản phẩm khác.
  - Worksheet: PDF bảng từ + dòng kẻ luyện viết + bài điền từ, hiển thị đúng dấu tiếng Việt (nhúng font có hỗ trợ tiếng Việt, đặt file font trong repo, ví dụ `public/fonts/`, kiểm tra license OFL).
- Trang bộ từ có khu "Học" với các chế độ và một nút "Học tiếp" gợi ý chế độ phù hợp.

## Migration

Tạo file mới trong `supabase/migrations/` (timestamp sau `20261126150000`), luôn bật RLS + policy. **Không tự đẩy migration** (cần mật khẩu DB). Ghi rõ tên file migration trong báo cáo, Claude sẽ đẩy và kiểm tra. Có thể viết code giả định migration đã áp dụng.

## Ràng buộc

- Không dùng em dash "—" và " – " ở bất cứ đâu.
- UI tiếng Việt, style sáng edtech, ưu tiên component Watermelon (`pnpm dlx shadcn@latest view/add @watermelon/<tên>`, khi cài trả lời không ghi đè file có sẵn).
- Next 16 Cache Components: dữ liệu theo request nằm trong `<Suspense>`; `params`/`searchParams` là Promise.
- Viết JSX dễ đọc: tránh nhồi nhiều phần tử trên một dòng dài (vài file trước đang bị vậy, sửa luôn nếu bạn chạm vào).
- Không thêm dữ liệu giả. Dev server cổng 3100 đang chạy, đừng tắt.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error).
- Cập nhật `docs/code-standards.md` nếu thêm component Watermelon, `README.md` nếu thêm lệnh/biến, status + checklist trong `plan.md`, `phase-03-study-modes.md`, `phase-04-spaced-repetition.md`.
- Báo cáo `plans/reports/from-codex-to-claude-261127-0944-srs-and-study-modes-report.md`: file đã đổi, migration cần đẩy, cách đã kiểm tra, việc còn lại, câu hỏi mở. Kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

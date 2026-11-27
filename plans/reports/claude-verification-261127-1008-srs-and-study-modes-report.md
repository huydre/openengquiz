# Kiểm tra phase 03 + 04 (Codex làm, Claude verify)

Codex dừng giữa chừng do hết hạn mức (chưa viết báo cáo cuối, chưa cập nhật plan). Claude kiểm tra và hoàn tất.

## Đã sửa

- Migration `20261127095700_srs_study_atomic_rpcs.sql`: Supabase CLI tách câu lệnh sai ở `case ... end` trong `finish_study_session` → đổi sang if/else. Đẩy qua session pooler IPv4 (kết nối trực tiếp chỉ IPv6).
- `src/app/api/worksheet/[setId]/route.ts`: bỏ `export const runtime` (không hợp lệ với Cache Components; typecheck không bắt, chỉ compile/build lỗi).
- `src/app/api/study/{start,finish}/route.ts`: không trả lỗi DB thô cho client.
- `src/lib/supabase/server.ts`: `await connection()` để `Date.now()` của Supabase không bị coi là prerender (lỗi `/home` khi đã đăng nhập).
- README, `.env.example`, plan: `SUPABASE_SECRET_KEY` thành bắt buộc cho ôn tập/học; lệnh push qua pooler.

## Đã kiểm tra

- `pnpm test` 29/29, `typecheck` sạch, `lint` 0 error, `pnpm build` xanh.
- DB thật: anon gọi RPC → permission denied; anon ghi `review_states` / đọc `user_daily_activity` → bị chặn; `authenticated` không có quyền execute 4 RPC, không insert `review_logs`, không update `review_states`; `service_role` có quyền execute.
- Code server: user id luôn lấy từ session, FSRS + chấm điểm tính ở server, RPC kiểm tra quyền với bộ từ, idempotent theo `client_review_id`, phiên học finish 2 lần trả `duplicate`.
- Route chưa đăng nhập: `/review`, `/stats`, `/study/*` → login; API → 400/401.

## Chưa kiểm tra

- Luồng khi đăng nhập (ôn, học, PDF hiển thị trên trình duyệt): cần tài khoản + `SUPABASE_SECRET_KEY`.

## Câu hỏi mở

- User thêm `SUPABASE_SECRET_KEY` vào `.env.local`.

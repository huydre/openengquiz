# Phase 04: Spaced Repetition, streak, thống kê

Status: code xong (27/11/2026): `ts-fsrs` ở server, ghi nguyên tử qua RPC chỉ service role gọi được (migration `20261127095700`, đã đẩy, đã kiểm tra anon/authenticated không ghi được), `/review`, `/stats`, streak giờ VN. Còn: chạy thử khi đăng nhập (cần `SUPABASE_SECRET_KEY`); ôn theo lộ trình chờ phase 08.

Context: [plan.md](plan.md) · Research mục 3.3

## Requirements

- FSRS qua `ts-fsrs`, lịch tính ở **server**, lưu `review_states` + `review_logs`.
- Hàng đợi ôn hôm nay: gộp thẻ đến hạn từ mọi bộ / theo bộ / theo lộ trình.
- Nút Again / Hard / Good / Easy, hiện khoảng thời gian dự kiến.
- Thêm thẻ vào SRS: tự động sau khi học lần đầu ở Learn mode, hoặc thủ công.
- Giới hạn thẻ mới/ngày (cài đặt người dùng, mặc định 20).
- Streak ngày học (múi giờ người dùng), lịch nhiệt (heatmap) hoạt động.
- Dashboard: số thẻ đến hạn, đã thuộc, tỷ lệ nhớ, biểu đồ dự báo ôn 7 ngày.

## Files tạo

- `lib/srs/fsrs.ts` (wrapper, thuần hàm) + test
- `app/api/review/route.ts` (POST rating, transaction cập nhật state + log)
- `app/(app)/review/page.tsx`, `components/review/{review-card,rating-buttons}.tsx`
- `app/(app)/stats/page.tsx`
- migration `0004_streaks.sql`: `user_daily_activity(user_id, day, reviews, studied, minutes)`

## Steps

1. Wrapper FSRS + test các rating.
2. Endpoint review idempotent theo `(user_id, card_id, client_review_id)` để tránh double submit.
3. Query due cards có index `(user_id, due_at)`.
4. Streak cập nhật trong cùng transaction review/study.
5. Dashboard + chart.

## Validation

- Test: Again → due trong vài phút; Easy → due xa hơn Good.
- Double click rating không tạo 2 log.
- Streak đúng qua 0h theo múi giờ VN.

## Risks

- Tính lịch ở client → sai/gian lận: luôn tính ở server.

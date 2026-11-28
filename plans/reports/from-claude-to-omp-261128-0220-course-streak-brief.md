# Brief cho omp: tính bài học khoá học vào chuỗi ngày

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit, không push git**. Model `local/dev` cho mọi việc. Không sửa UI.

## Bối cảnh

Chủ dự án quyết định: **hoàn thành hoạt động bài học khoá học cũng giữ chuỗi ngày.** Hiện chuỗi ngày (`sync_streak()` trong `supabase/migrations/20261128020000_streak_freeze.sql`, `src/lib/srs/streak-status.ts`, `src/lib/srs/streak-freeze.ts`) chỉ coi một ngày là có học khi `user_daily_activity.reviews + studied > 0`. `course_activity_progress` (có `completed_at`) không được tính. Đây là đề xuất của chính bạn trong báo cáo `plans/reports/from-omp-to-claude-261128-0115-learn-mix-gamification-report.md`.

## Yêu cầu

1. Một ngày (giờ Việt Nam, cùng quy tắc ngày như hiện tại) được coi là **ngày hoạt động** nếu có `reviews + studied > 0` **hoặc** người học có ít nhất một dòng `course_activity_progress` với `completed_at` rơi vào ngày đó.
2. **Không** tăng `user_daily_activity.studied` hay `reviews` cho hoạt động khoá học (để XP tuần không bị tính hai lần; XP khoá học đã đến từ `course_activity_progress`).
3. Áp dụng nhất quán ở mọi nơi dùng "ngày hoạt động": `sync_streak()` (phát lại lịch sử, thưởng freeze theo mốc 7 ngày, che ngày bỏ lỡ) và `activeDays` trả về từ `getStreakStatus`. Ngày hôm nay hoàn thành hoạt động bài học phải làm chuỗi tăng ngay ở lần tải trang chủ kế tiếp.
4. Migration mới, đặt tên theo thời gian sau các file hiện có (ví dụ `20261128040000_course_activity_streak.sql`), `create or replace` hàm cần đổi, giữ nguyên quyền (`security definer`, `auth.uid()`, grant/revoke) như bản cũ. Không sửa migration đã đẩy.
5. Test: cập nhật/thêm test thuần trong `src/lib/srs/` (ngày chỉ có hoạt động khoá học vẫn giữ chuỗi; ngày có cả hai không đếm đôi; freeze vẫn đúng). Nếu có thể, smoke SQL trên Supabase trong transaction rồi rollback.
6. Đẩy migration: `pnpm -s dlx supabase@2 db push --db-url "postgresql://postgres.ccquhootlvhexmdyevwl:$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" --yes` (nạp `.env.local`, **không in giá trị bí mật**). Trước khi đẩy, kiểm tra `migration list` chỉ có migration của bạn đang chờ.
7. `pnpm test && pnpm typecheck && pnpm lint` xanh.

## Ràng buộc

- Không em dash "—" hay " – " ở bất cứ đâu.
- Không tắt dev server cổng 3100. Không đụng phiên omp đang seed IELTS.
- File mới nào được import phải nằm trong danh sách file đã sửa ở báo cáo (Claude commit theo danh sách đó; file bị sót sẽ làm build lỗi).

## Hoàn thành khi

- Báo cáo `plans/reports/from-omp-to-claude-261128-0220-course-streak-report.md`: file đã sửa/thêm (đủ để commit), migration đã đẩy, kết quả test, kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

- **Khi xong**, nhắn Claude: `orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-0220-course-streak-report.md, Status: <status>" --enter --json` (nếu handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

# Hoạt động khóa học giữ chuỗi ngày

## File đã sửa hoặc thêm

- `supabase/migrations/20261128040000_course_activity_streak.sql`
- `src/lib/srs/streak-freeze.test.ts`
- `docs/code-standards.md`
- `plans/reports/from-omp-to-claude-261128-0220-course-streak-report.md`

`sync_streak()` hợp ngày học/ôn với ngày có `course_activity_progress.completed_at` theo `Asia/Ho_Chi_Minh`. Mỗi ngày chỉ tính một lần; bỏ qua ngày tương lai. Replay và `active_days` dùng cùng mảng ngày. `getStreakStatus()` đã đọc trực tiếp `active_days` từ RPC nên không cần sửa. Không đổi bộ đếm, XP tuần, UI hay quyền RPC. Không commit hoặc push Git.

## Kiểm chứng

- `migration list`: chỉ `20261128040000` chờ. `db push`: đã áp dụng đúng migration này trên Supabase.
- Smoke SQL trên Supabase trong transaction rồi `ROLLBACK`: kiểm tra ranh giới nửa đêm Việt Nam, ngày trùng, mốc tặng freeze, ngày được che, hoạt động khóa học hôm nay tăng chuỗi từ 8 lên 9, bỏ qua tiến độ chưa xong và ngày tương lai, cách ly người dùng, giữ nguyên bộ đếm và quyền execute của `authenticated`/`anon`.
- `pnpm test && pnpm typecheck && pnpm lint`: exit 0. Test: 162 pass, 32 file. Lint: 0 lỗi, 5 cảnh báo ở file UI không sửa.

Status: DONE
Summary: Hoàn thành hoạt động khóa học tính vào chuỗi ngày theo giờ Việt Nam, không tăng XP tuần hai lần. Migration đã áp dụng và kiểm chứng.

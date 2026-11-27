# Bàn giao Học trộn, streak freeze và bảng hạng tuần

## File đã sửa

- Học: `src/lib/study/learn-algorithm.ts`, `src/lib/study/learn-algorithm.test.ts`, `src/lib/study/grade-session.ts`, `src/lib/study/grade-session.test.ts`, `src/lib/study/study-logic.test.ts`, `src/components/study/use-study-session.ts`, `supabase/migrations/20261128015900_learn_mix.sql`.
- Streak: `src/lib/srs/streak-freeze.ts`, `src/lib/srs/streak-freeze.test.ts`, `src/lib/srs/streak-status.ts`, `supabase/migrations/20261128020000_streak_freeze.sql`.
- Bảng hạng: `src/lib/gamification/weekly-xp.ts`, `src/lib/gamification/weekly-xp.test.ts`, `src/lib/gamification/leaderboard-week.ts`, `src/lib/gamification/leaderboard-week.test.ts`, `src/lib/gamification/weekly-leaderboard.ts`, `src/lib/gamification/leaderboard-actions.ts`, `src/app/api/speaking/assess/route.ts`, `supabase/migrations/20261128020100_weekly_leaderboard.sql`.
- Tài liệu: `docs/code-standards.md` và báo cáo này. Không sửa giao diện hay commit.

## Hợp đồng cho UI

Dùng Supabase client của phiên đăng nhập, không dùng admin client cho các hàm đọc:

```ts
// @/lib/srs/streak-status
getStreakStatus(supabase: SupabaseClient): Promise<{
  streak: number;
  freezes: number;
  frozenDays: string[];
  activeDays: string[];
}>

// @/lib/gamification/weekly-leaderboard
getWeeklyLeaderboard(supabase: SupabaseClient): Promise<WeeklyLeaderboard>
type WeeklyLeaderboard = {
  weekStart: string;
  weekEnd: string;
  entries: { rank: number; name: string; xp: number; isMe: boolean }[];
  me: { rank: number | null; xp: number };
}
getLeaderboardVisibility(supabase: SupabaseClient): Promise<boolean>

// @/lib/gamification/leaderboard-actions
setLeaderboardVisibility(visible: boolean): Promise<{ error: string | null }>
```

- Ngày dạng `YYYY-MM-DD`, múi giờ Việt Nam. `weekEnd` là thứ Hai kế tiếp, cận không gồm. `activeDays` là hoạt động thật, không chứa ngày freeze. Hàm đọc ném lỗi RPC thay vì trả số 0 giả.
- `entries` chứa tối đa 20 người công khai và có thể thêm dòng người gọi ở cuối. `me.rank` là `null` khi `me.xp` bằng 0. Người ẩn vẫn có hạng riêng tính so với người công khai, không làm lệch hạng công khai. Hòa XP dùng ID nội bộ làm thứ tự ổn định, không trả ID đầy đủ. Bỏ tên chứa `@`; tên trống dùng `Người học` + 4 ký tự cuối ID.
- Chế độ Học: `session.current.type` là `multiple_choice | match | learn_type | fill | dictation_term`. `session.learn.queue[0]` có `{ cardId, stage, type }`; `stage` là `recognition | recall | review`. Dùng `stage` cho dòng phụ đề ở `study-runner.tsx`; cách kiểm tra `type === "multiple_choice"` hiện dán nhãn sai cho `match`, `fill` và `dictation_term`.

## Quyết định và dữ liệu

- Dạng câu chọn khi tạo bước, lưu trên bước. `fill` bám bộ so khớp không phân biệt hoa thường và bỏ dấu câu cuối như `Prompt`. Đợt mới chèn khoảng 15% so với cỡ đợt mới, ít nhất một thẻ ôn nếu đã thuộc hơn 30% tổng số thẻ. Ôn sai buộc qua nhận diện rồi nhớ lại. Server suy ra việc ôn từ thứ tự câu trả lời, không tin cờ từ client.
- `sync_streak()` phát lại lịch sử ngày hoạt động để số dư không phụ thuộc số lần gọi. Một khoảng bỏ lỡ được che hết hoặc không dùng freeze. Khoảng bỏ lỡ đang mở có thể đang được che tạm; nếu về sau dài hơn số freeze đủ trả cho cả khoảng, chuỗi đứt và các ngày che tạm được gỡ. Hôm nay chưa kết thúc thì chưa tính là bỏ lỡ. Ngày freeze tính vào độ dài chuỗi và mốc 7; tối đa giữ 2. Khóa hồ sơ theo người gọi để đồng bộ song song không thưởng trùng.
- Không thấy `course_activity_progress` ghi vào `user_daily_activity`. Các RPC học từ và ôn mới ghi bảng ngày. Không đổi định nghĩa streak. Nếu muốn khóa học cũng giữ streak, nên thêm ghi nhận hoạt động riêng theo ngày Việt Nam khi `completed_at` chuyển từ null, idempotent, tránh tăng nhầm `studied` và cộng XP hai lần.
- XP = `reviews + studied + 10 × số dòng course_activity_progress hoàn tất + 5 × số dòng speaking_attempts` trong tuần. Schema hiện tại tăng `studied` một lần mỗi phiên đã lưu, không phải theo số thẻ. Giữ đơn vị nguồn dữ liệu, không diễn giải `studied` là số thẻ. Tiến độ khóa học dùng `completed_at`, kể cả các dòng backfill hợp lệ. Lượt luyện nói dùng `created_at`; chỉ server được insert để client không tự ghi XP.

## Xác minh và phần còn lại

- Supabase đã áp đủ `20261128015900`, `20261128020000`, `20261128020100`; xác nhận từ bảng lịch sử. Đẩy riêng migration thuộc brief để không đẩy migration của phiên khác.
- Smoke PostgreSQL: lưu câu `match`, `fill`, `dictation_term`; gửi lại không cộng `studied`; freeze idempotent, RLS cô lập; bảng hạng lọc riêng tư, giữ top N, thêm dòng của mình và ẩn tên dạng email. Smoke hai RPC trên Supabase với rollback; kiểm tra quyền SQL thật. Dev server cổng 3100 vẫn trả HTTP 200.
- `pnpm test`: 160/160. `pnpm lint`: 0 lỗi, 6 cảnh báo ngoài phạm vi. Typecheck cô lập file brief: qua. Typecheck và build toàn repo còn lỗi TypeScript ngoài phạm vi ở `scripts/seed-paths.ts` và `src/lib/paths/path-data.ts`; lượt typecheck còn ghi nhận `scripts/seed-card-gifs.ts` dùng `byQuery` trước khai báo. Đã báo phiên phụ trách paths, không sửa file của phiên khác.
- Claude nối UI và đổi phụ đề học theo `stage`. Chưa kiểm tra hành trình trình duyệt đã đăng nhập hay gửi audio đến dịch vụ chấm phát âm.

Status: DONE_WITH_CONCERNS
Summary: Logic A, B, C xong; 3 migration đã áp; test và smoke qua. Typecheck/build toàn repo bị lỗi ngoài phạm vi.

# Brief cho omp: chế độ Học trộn nhiều dạng câu + đóng băng chuỗi ngày + bảng xếp hạng tuần

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit, không push**. Model `local/dev` cho mọi việc, kể cả agent con. **Không sửa UI** (Claude làm giao diện): chỉ logic thuần, server action, API, migration, test. Riêng `src/components/study/use-study-session.ts` được sửa (hook, không phải giao diện).

Đọc trước: `AGENTS.md` (Next.js 16 khác bản cũ, đọc docs trong `node_modules/next/dist/docs/` khi cần), `docs/code-standards.md`.

## Phần A: Chế độ Học (learn) trộn nhiều dạng câu

Hiện tại `src/lib/study/learn-algorithm.ts` chỉ có 2 bước cố định mỗi thẻ: `choice` (chọn nghĩa) rồi `type` (gõ từ). Server chấm ở `src/lib/study/grade-session.ts` (chỉ chấp nhận `multiple_choice` và `learn_type`, thẻ "thuộc" khi đúng choice rồi đúng type). UI `src/components/study/study-question.tsx` đã hiển thị được mọi `QuestionType`.

Yêu cầu:
1. Mỗi thẻ đi qua 2 giai đoạn, mỗi bước có **dạng câu ngẫu nhiên trong nhóm**:
   - Nhận diện: `multiple_choice` (từ → chọn nghĩa) hoặc `match` (nghĩa → chọn từ tiếng Anh).
   - Nhớ lại: `learn_type` (nghĩa → gõ từ), `fill` (điền từ vào câu ví dụ, **chỉ khi** `example_en` chứa từ, so khớp sau khi bỏ dấu câu ở hai đầu từ giống `Prompt` trong `study-question.tsx`), `dictation_term` (nghe → gõ từ).
2. Dạng câu được **chọn khi tạo bước và lưu trong bước** (ví dụ `LearnStep = { cardId, stage, type }`) để giao diện ổn định khi render lại. Hàm thuần nhận `random: () => number` (mặc định `Math.random`) để test được.
3. **Ôn xen kẽ thẻ đã thuộc** (giống OpenQuiz): khi bắt đầu đợt mới và số thẻ đã thuộc > 30% tổng, chèn khoảng 15% (ít nhất 1) thẻ đã thuộc vào đợt dưới dạng bước `review` (dạng nhận diện). Đúng: không đổi gì. Sai: thẻ bị gỡ khỏi `mastered` và phải học lại qua nhận diện rồi nhớ lại.
4. Cập nhật `use-study-session.ts` lấy `type` từ bước, và `grade-session.ts`:
   - `allowedTypes.learn` thêm `match`, `fill`, `dictation_term`;
   - thẻ "thuộc" khi có một câu nhận diện đúng **rồi sau đó** một câu nhớ lại đúng (theo thứ tự attempts); vẫn yêu cầu mọi thẻ thuộc mới kết thúc phiên.
5. `fill` chỉ được chọn khi thẻ có câu ví dụ phù hợp (truyền thông tin thẻ vào hàm chọn dạng, vẫn thuần).
6. Test: viết/cập nhật `learn-algorithm.test.ts`, `grade-session.test.ts` (đủ dạng câu, ôn xen kẽ, sai khi ôn thì học lại, server từ chối phiên chưa thuộc hết, chấp nhận chuỗi nhận diện → nhớ lại với mọi tổ hợp dạng).

## Phần B: Đóng băng chuỗi ngày (streak freeze)

Chuỗi ngày hiện tính ở `src/lib/srs/activity.ts` (`currentStreak`, ngày theo giờ VN) từ bảng `user_daily_activity` (`reviews + studied > 0`), dùng ở `src/app/(app)/home/page.tsx` và `src/app/(app)/stats/page.tsx`. Kiểm tra xem hoạt động bài học khoá học (`course_activity_progress`) có được tính vào `user_daily_activity` chưa; nếu chưa, đề xuất trong báo cáo (đừng tự đổi định nghĩa).

Yêu cầu:
1. Migration mới (đặt tên theo thời gian, ví dụ `supabase/migrations/20261128020000_streak_freeze_leaderboard.sql`, chung với phần C được):
   - `profiles.streak_freezes integer not null default 0 check (streak_freezes between 0 and 2)` và cột ghi mốc đã thưởng để không thưởng trùng;
   - bảng `streak_freeze_days (user_id, day date, primary key (user_id, day))`, RLS: chủ sở hữu đọc được, chỉ RPC ghi.
2. Quy tắc: **mỗi lần chuỗi đạt bội số của 7 ngày** thì +1 freeze (tối đa giữ 2). Khi người học bỏ lỡ ngày (không hoạt động) và còn freeze, freeze **tự dùng** để giữ chuỗi: mỗi ngày bỏ lỡ tốn 1 freeze; nếu số ngày bỏ lỡ liên tiếp nhiều hơn số freeze thì không dùng và chuỗi đứt.
3. Hàm thuần có test (ví dụ trong `src/lib/srs/streak-freeze.ts`): tính ngày cần đóng băng, chuỗi khi coi ngày đóng băng là hoạt động, số freeze được thưởng.
4. RPC `security definer` dùng `auth.uid()` (ví dụ `sync_streak()`), gọi được an toàn nhiều lần (idempotent): áp dụng freeze cho ngày bỏ lỡ, thưởng freeze theo mốc, trả về `{ streak, freezes, frozen_days }`.
5. Hàm server cho UI: `getStreakStatus(supabase)` trả `{ streak: number; freezes: number; frozenDays: string[]; activeDays: string[] }` (ngày dạng `YYYY-MM-DD` giờ VN). Claude sẽ dùng ở trang chủ và trang thống kê.

## Phần C: Bảng xếp hạng tuần

1. XP tuần (tuần bắt đầu thứ Hai 00:00 giờ VN), tính từ dữ liệu sẵn có, công thức rõ ràng ghi trong code:
   - 1 XP mỗi lượt ôn (`user_daily_activity.reviews`) và mỗi thẻ học (`studied`);
   - 10 XP mỗi hoạt động bài học khoá học hoàn thành (`course_activity_progress`);
   - 5 XP mỗi lượt luyện nói (`speaking_attempts`).
   Nếu bảng/cột thực tế khác, điều chỉnh và ghi lại trong báo cáo.
2. Quyền riêng tư: `profiles.show_on_leaderboard boolean not null default true`. Người tắt không xuất hiện với người khác nhưng vẫn thấy XP và hạng của mình. Tên hiển thị: `display_name`, nếu trống thì "Người học" + 4 ký tự cuối id; **không bao giờ trả email**.
3. RPC `security definer` (ví dụ `weekly_leaderboard(p_limit int default 20)`) dùng `auth.uid()`: trả top N `{ rank, name, xp, is_me }` và **dòng của chính người gọi** kể cả khi ngoài top. Chỉ tính người có XP > 0.
4. Hàm server cho UI: `getWeeklyLeaderboard(supabase)` trả `{ weekStart: string; weekEnd: string; entries: { rank: number; name: string; xp: number; isMe: boolean }[]; me: { rank: number | null; xp: number } }`.
5. Server action bật/tắt hiển thị: `setLeaderboardVisibility(visible: boolean)` (đặt ở `src/app/(app)/account/` hoặc `src/lib/gamification/`), Claude gắn vào trang Tài khoản.
6. Test cho phần tính XP và tuần (thuần).

## Ràng buộc

- Không dùng em dash "—" hay " – " ở bất cứ đâu (code, comment, chuỗi).
- Bảo mật: RPC chỉ thao tác dữ liệu của `auth.uid()`; RLS bật cho bảng mới; không lộ email hay dữ liệu người khác ngoài tên + XP.
- Đẩy migration bằng: `pnpm -s dlx supabase@2 db push --db-url "postgresql://postgres.ccquhootlvhexmdyevwl:$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" --yes` (nạp `.env.local`, **không in giá trị bí mật**). Không sửa migration đã đẩy.
- Không tắt dev server cổng 3100. Không đụng phiên omp đang seed IELTS.
- Chạy `pnpm test && pnpm typecheck && pnpm lint` trước khi báo xong.

## Hoàn thành khi

- A, B, C xong, test xanh, migration đã đẩy.
- Báo cáo `plans/reports/from-omp-to-claude-261128-0115-learn-mix-gamification-report.md`: file đã sửa, hợp đồng hàm cho UI (chữ ký chính xác), công thức XP, quyết định đã đưa ra, vấn đề còn lại, kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

- **Khi xong**, nhắn Claude bằng orca-cli: `orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-0115-learn-mix-gamification-report.md, Status: <status>" --enter --json` (nếu handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

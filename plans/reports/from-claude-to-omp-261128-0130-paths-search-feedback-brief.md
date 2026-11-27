# Brief cho omp: lộ trình soạn sẵn + API tìm kiếm + góp ý + dữ liệu trang chủ

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit, không push**. Model `local/dev` cho mọi việc, kể cả agent con. **Không sửa UI** (Claude làm giao diện song song): chỉ script seed, API route, server action, hàm lấy dữ liệu, migration, test. Có một phiên omp khác đang làm `learn-algorithm`, `grade-session`, streak và leaderboard: **không đụng các file đó**.

Đọc trước: `AGENTS.md` (Next.js 16 khác bản cũ), `docs/code-standards.md`, `scripts/seed-courses.ts` (mẫu seed bằng `SEED_AI_*`, chủ sở hữu `SEED_CONTENT_OWNER_ID`), `supabase/migrations/20261127124000_learning_paths.sql` (bảng `learning_paths`, `path_items` đã có, đang trống).

## Phần A: Seed lộ trình soạn sẵn

1. Catalog `content/paths/catalog.yaml` (tự viết, **không lấy tên, danh sách từ hay mô tả của OpenQuiz**): mỗi lộ trình có `slug`, `title` (tiếng Việt), `description`, `tags` (mục tiêu: `ielts`, `toeic`, `thpt`, `communication`, `work`), `level` (CEFR), danh sách bộ từ (tên + chủ đề + số từ). Tối thiểu:
   - IELTS: từ vựng theo chủ đề (10 bộ x 15 từ: công việc, giáo dục, môi trường, công nghệ, sức khoẻ, du lịch, gia đình, truyền thông, đô thị, ẩm thực), collocation thiết yếu (8 bộ x 15), từ nối cho Speaking và Writing (5 bộ x 12), cụm từ tăng band Speaking (7 bộ x 10).
   - TOEIC (5 bộ x 15, chủ đề công sở), THPT (5 bộ x 15, chủ đề đề thi), giao tiếp hằng ngày (5 bộ x 15).
2. Script `scripts/seed-paths.ts` (+ `pnpm seed:paths`, có `--path <slug>`): tạo bộ từ (`study_sets` công khai, chủ sở hữu `SEED_CONTENT_OWNER_ID`) và thẻ đầy đủ `ipa`, `part_of_speech`, `definition_vi`, `definition_en`, `example_en`, `example_vi`, `synonyms`; tạo `learning_paths` (`visibility = 'public'`, `status = 'ready'`) và `path_items` theo thứ tự. Chạy lại được: bỏ qua lộ trình/bộ đã có (theo slug), không tạo trùng. Kiểm chất lượng như seed khoá học (không trùng từ trong lộ trình, đúng độ khó, không em dash, tiếng Việt tự nhiên) và thử lại tối đa 3 lần.
3. **Ẩn bộ từ hệ thống khỏi "Bộ từ của tôi"**: hiện `src/lib/courses/course-sets.ts` (`courseSetIds`) chỉ loại bộ của khoá học. Mở rộng (đổi tên hợp lý, ví dụ `systemSetIds`) để loại cả bộ thuộc lộ trình của chủ sở hữu nội dung; cập nhật 2 chỗ gọi (`src/app/(app)/sets/page.tsx`, `src/app/(app)/lookup/page.tsx`, chỉ đổi lời gọi hàm).
4. Mở rộng `scripts/seed-card-gifs.ts` để gắn GIF cho cả thẻ của bộ thuộc lộ trình (giữ nguyên quy tắc không ghi đè ảnh có sẵn). **Không chạy** script GIF (Claude chạy sau).
5. Chạy seed toàn bộ catalog (chạy nền, theo dõi log).

## Phần B: Dữ liệu cho trang chủ và trang lộ trình

Hàm server (đặt ở `src/lib/paths/` hoặc tương tự), có test cho phần thuần:
- `getSuggestedPaths(supabase, goal: string | null, limit = 6)`: lộ trình công khai, ưu tiên `tags` chứa mục tiêu của người học (`profiles.goal`), trả `{ id, slug, title, description, level, tags, setCount, wordCount }[]`.
- `getPath(supabase, slugOrId, userId)`: chi tiết lộ trình + danh sách bộ theo thứ tự, mỗi bộ có `{ id, title, cardCount, mastered, learning }` (dùng `cardMastery` ở `src/lib/srs/card-mastery.ts` trên `review_states` của người học) + tổng tiến độ.
- `getRecentSets(supabase, userId, limit = 4)`: bộ từ người học mở gần nhất (từ `study_sessions`, `review_logs` hoặc nguồn phù hợp nhất; nói rõ lựa chọn), loại bộ của khoá học, trả `{ id, title, cardCount, masteredPercent, lastStudiedAt }[]`.

## Phần C: API tìm kiếm chung

`GET /api/search?q=` (đã đăng nhập; 401 nếu chưa), `q` cắt 2 đến 80 ký tự, escape ký tự `%`/`_` khi dùng `ilike`. Trả:
```ts
{
  sets: { id; title; cardCount }[];          // bộ của tôi (không gồm bộ hệ thống), tối đa 5
  publicSets: { id; title; cardCount; ownerName }[]; // bộ công khai của người khác, tối đa 5
  paths: { slug; title; level; setCount }[];  // lộ trình công khai, khớp tiêu đề hoặc tag, tối đa 5
  lessons: { href; title; levelTitle }[];     // bài trong khoá học, href tới trang bài học hiện có, tối đa 5
}
```
Test cho phần dựng truy vấn/chuẩn hoá đầu vào.

## Phần D: Góp ý / báo lỗi

Migration (tên theo thời gian, ví dụ `20261128030000_feedback_reports.sql`): bảng `feedback_reports (id, user_id uuid null references profiles on delete set null, page text, message text check 1..2000, created_at)`, RLS: người dùng chỉ insert dòng của chính mình, không ai đọc được ngoài service role. Server action `submitFeedback({ message, page })` trả `{ ok: true } | { error: string }`, giới hạn 10 lần/ngày/người. Cập nhật mục "Dữ liệu chúng tôi lưu" trong `src/app/(legal)/privacy/page.tsx` một gạch đầu dòng ngắn (được phép sửa đúng đoạn văn bản này).

## Ràng buộc

- Không em dash "—" hay " – " ở bất cứ đâu.
- Đẩy migration: `pnpm -s dlx supabase@2 db push --db-url "postgresql://postgres.ccquhootlvhexmdyevwl:$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" --yes` (nạp `.env.local`, **không in giá trị bí mật**). Không sửa migration đã đẩy. Phiên omp khác cũng có thể đẩy migration: đặt tên file theo thời gian để không trùng.
- Không tắt dev server cổng 3100.
- `pnpm test && pnpm typecheck && pnpm lint` xanh trước khi báo xong (nếu lỗi nằm ở file của phiên omp khác, ghi rõ, đừng sửa).

## Hoàn thành khi

- A đến D xong, seed xong (hoặc ghi rõ phần còn thiếu), test xanh.
- Báo cáo `plans/reports/from-omp-to-claude-261128-0130-paths-search-feedback-report.md`: file đã sửa, **chữ ký chính xác** các hàm và API cho UI, số lộ trình/bộ/thẻ đã seed, mẫu nội dung, vấn đề còn lại, kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

- **Khi xong**, nhắn Claude: `orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-0130-paths-search-feedback-report.md, Status: <status>" --enter --json` (nếu handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

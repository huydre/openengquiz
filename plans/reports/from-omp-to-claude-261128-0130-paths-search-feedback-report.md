# Bàn giao: lộ trình, tìm kiếm, góp ý

## File thay đổi

- `content/paths/catalog.yaml`, `scripts/seed-paths.ts`, `package.json`, `src/lib/ai/quota-rules.ts`: catalog gốc, `pnpm seed:paths [--path <slug>]`, quota riêng, kiểm trường bắt buộc, loại từ lặp trong lộ trình và tối đa ba lượt tạo mỗi bộ. Độ khó và tiếng Việt tự nhiên được yêu cầu trong prompt, chưa kiểm chứng bằng nội dung sinh thực tế.
- `src/lib/courses/course-sets.ts`, `src/app/(app)/sets/page.tsx`, `src/app/(app)/lookup/page.tsx`: `systemSetIds` loại bộ khoá học và bộ thuộc lộ trình của `SEED_CONTENT_OWNER_ID`. Hai page chỉ đổi import và lời gọi.
- `scripts/seed-card-gifs.ts`: lấy cả bộ lộ trình của chủ nội dung, chỉ cập nhật thẻ có `image_url` null. Sửa log `byQuery` chạy trước khai báo. Không chạy script GIF.
- `src/lib/paths/path-data.ts`, `src/lib/paths/path-data.test.ts`: gợi ý, chi tiết và tiến độ, bộ đã học gần đây.
- `src/app/api/search/route.ts`, `src/lib/search/search-query.ts`, `src/lib/search/search-query.test.ts`: tìm kiếm đăng nhập, kiểm chuẩn hóa và escape pattern.
- `src/lib/feedback/submit-feedback.ts`, `src/app/(legal)/privacy/page.tsx`: action và một dòng công bố dữ liệu góp ý.
- `supabase/migrations/20261128025900_restore_learning_paths.sql`: phục hồi hai bảng đã bị migration khoá học `20261127160000` xoá, RPC seed nguyên tử và truy vấn lịch sử.
- `supabase/migrations/20261128030000_feedback_reports.sql`: RLS, chỉ cho insert đúng chủ, không cấp quyền đọc cho người dùng, giới hạn 10 lần theo ngày Việt Nam. Khi xoá hồ sơ, nội dung giữ lại với `user_id = null`.

## Hợp đồng UI

```ts
// @/lib/paths/path-data
getSuggestedPaths(supabase: SupabaseClient, goal: string | null, limit?: number): Promise<{
  id: string; slug: string; title: string; description: string; level: string;
  tags: string[]; setCount: number; wordCount: number;
}[]> // mặc định 6; khớp goal trước, sau đó theo title

getPath(supabase: SupabaseClient, slugOrId: string, userId: string): Promise<{
  id: string; slug: string | null; title: string; description: string | null;
  level: string; tags: string[];
  sets: { id: string; title: string; cardCount: number; mastered: number; learning: number }[];
  cardCount: number; mastered: number; learning: number; progress: number;
} | null> // progress là tỷ lệ 0..1, bộ theo position

getRecentSets(supabase: SupabaseClient, userId: string, limit?: number): Promise<{
  id: string; title: string; cardCount: number; masteredPercent: number; lastStudiedAt: string;
}[]> // mặc định 4; masteredPercent là số nguyên 0..100

// @/lib/feedback/submit-feedback
submitFeedback(input: { message: string; page: string }): Promise<{ ok: true } | { error: string }>
```

`getRecentSets` dùng thời điểm `study_sessions.started_at` mới nhất của mỗi bộ vì ghi nhận lúc bắt đầu học, kể cả buổi chưa hoàn tất. Chỉ mở trang chi tiết mà không bắt đầu buổi học không tính. Bỏ bộ của khóa học. Truy vấn chạy với Supabase client của người học; `userId` lấy từ cùng phiên đăng nhập. `submitFeedback` nhận `location.pathname`, không gửi query/fragment.

`GET /api/search?q=`: trim, 2 đến 80 ký tự, tìm tiêu đề không phân biệt hoa thường, tag khớp chính xác không phân biệt hoa thường. 401 nếu chưa đăng nhập, 400 nếu `q` ngoài giới hạn, 500 khi lỗi dữ liệu. Mỗi nhóm tối đa năm dòng:

```ts
{
  sets: { id: string; title: string; cardCount: number }[];
  publicSets: { id: string; title: string; cardCount: number; ownerName: string }[];
  paths: { slug: string; title: string; level: string; setCount: number }[];
  lessons: { href: string; title: string; levelTitle: string }[];
}
```

## Dữ liệu và kiểm tra

- Catalog: 7 lộ trình, 45 bộ, dự kiến 625 thẻ. Mẫu catalog: `Vốn từ theo chủ đề IELTS` (B2), bộ `Việc làm và lựa chọn nghề nghiệp` (15 thẻ); `Giao tiếp tiếng Anh mỗi ngày` (A2), bộ `Tìm đường và đi lại` (15 thẻ).
- Đã seed lên Supabase: 0 lộ trình, 0 bộ, 0 thẻ. `SEED_AI_MODEL=local/dev pnpm seed:paths` dừng ở `Could not find the table 'public.learning_paths' in the schema cache`. Probe gateway cho `local/dev` trả HTTP 404 `No active credentials for provider: local`. Không dùng model thay thế.
- Không push hai migration theo chỉ đạo mới nhất. PostgreSQL cục bộ: hai migration chạy được; kiểm tra seed nguyên tử, không trùng slug, thứ tự/lịch sử cơ bản, chặn lượt góp ý thứ 11, chặn đọc và chặn giả mạo `user_id`. Thẻ `ticket` / `vé` chỉ là fixture cục bộ, không phải nội dung đã seed.
- `pnpm test && pnpm typecheck && pnpm lint`: 161 test đạt; typecheck đạt; lint 0 lỗi, 5 cảnh báo vendor. Dev server trả 401 đúng cho `GET /api/search?q=ielts` khi chưa đăng nhập. Chưa smoke luồng API đăng nhập trên Supabase vì chưa có schema.
- Không commit. Không sửa file learn/streak/leaderboard. Điều kiện chạy seed thật: triển khai schema theo quyết định của chủ dự án và cấp gateway phục vụ `local/dev`.

Status: DONE_WITH_CONCERNS
Summary: Sửa typecheck và thứ tự byQuery, bàn giao backend với test xanh; chưa push migration, chưa seed dữ liệu do thiếu schema đích và model local/dev không khả dụng.

# Meaning Recall: chấm nghĩa hai tầng

## File đã sửa hoặc thêm

- `src/lib/courses/lesson-activities.ts`
- `src/lib/courses/lesson-activities.test.ts`
- `src/app/api/courses/meaning-check/route.ts`
- `src/lib/ai/quota-rules.ts`
- `src/lib/ai/token-usage.ts`
- `supabase/migrations/20261128050000_meaning_check_cache.sql`
- `docs/code-standards.md`
- `plans/reports/from-omp-to-claude-261128-0915-meaning-recall-grading-report.md`

Không sửa UI, seed, branch, commit hay push Git. Dev server cổng 3100 vẫn chạy.

## Hợp đồng cho UI

- `gradeMeaningLocally(answer, expectedVi, alternates?)` trả `correct | wrong | unsure`. Truyền `card.definition_vi ?? ""` và `[card.definition_en ?? "", ...(card.synonyms ?? [])]`. Giữ chữ ký và các nhánh khớp cũ của `matchVietnameseMeaning`; wrapper trả `true` khi grade là `correct`.
- Chấp nhận cụm đầu định nghĩa sau khi bỏ hư từ và khớp bản bỏ dấu nếu cả đáp án không dấu. `bàn giao`, `sự bàn giao`, `ban giao` đúng cho `handoff`; `công việc`, `người khác`, `con mèo` sai cục bộ. `unsure` chỉ khi còn ít nhất một âm tiết nội dung trùng định nghĩa, `definition_en` hoặc `synonyms`, ví dụ `chuyển giao` cho `handoff`. Đồng nghĩa không trùng âm tiết cần nút tự xác nhận.
- Chỉ gọi `POST /api/courses/meaning-check` khi `unsure`, gửi `{ cardId, answer }`. UUID, tối đa 120 ký tự. Server tự đọc card thuộc khóa học theo quyền phiên, bỏ qua định nghĩa do client gửi và chấm lại.
- HTTP 200: `{ correct: boolean, source: "local" | "cache" | "ai" | "unavailable" }`; `unavailable` có thêm `reason: "unavailable"` và `correct: false`. Giữ nút `Tôi trả lời đúng`. HTTP 401 nếu chưa đăng nhập, 400 nếu payload sai, 404 nếu không tìm thấy card khóa học có thể đọc.
- Cache giữ dấu, chuẩn hóa hoa/thường, khoảng trắng và dấu câu cuối; gắn `cards.updated_at` để verdict cũ không dùng sau khi sửa thẻ. Cache đọc trước quota. Quota 200 lượt chấm AI thành công/ngày Việt Nam, theo cơ chế quota hiện có. Check và ghi quota không nguyên tử; hai cache miss cùng lúc vẫn có thể gọi AI riêng.

## Kiểm chứng

- `migration list` chỉ có `20261128050000` chờ; `db push` đã áp dụng đúng migration. Truy vấn Supabase xác nhận RLS bật, `anon` và `authenticated` không có quyền đọc, service role có quyền đọc và ghi.
- Smoke HTTP trên cổng 3100: 401/400/404, nội dung client gửi không thay định nghĩa, khớp không dấu và synonym, từ phụ và `con mèo` bị loại cục bộ. Groq chấm đúng `chuyển giao`, sai `lịch công việc`; hai biến thể hoa và dấu câu cuối trả verdict từ cache. Tài khoản thử thứ hai chạm quota nhận `unavailable` trên cache miss nhưng vẫn nhận verdict từ cache. Đã dọn tài khoản và cache tạo riêng cho smoke.
- `pnpm test && pnpm typecheck && pnpm lint`: exit 0; 187 test pass, 32 file. Lint 0 lỗi, 5 cảnh báo ở file UI không sửa.

## Token thực tế

`ai_token_usage`, feature `meaning-check`, model `groq/openai/gpt-oss-20b`, hai lượt smoke cuối:

| Đáp án | Input | Output | Tổng |
| --- | ---: | ---: | ---: |
| `chuyển giao` | 214 | 84 | 298 |
| `lịch công việc` | 214 | 40 | 254 |

Trung bình 276 token/lượt AI từ hai mẫu, 0 token input cache từ provider. 214 input là tổng provider ghi nhận, gồm phần đóng gói model và structured output; không phải số token riêng của lời nhắc. Lượt chấm cục bộ hoặc trúng cache ứng dụng không gọi model.

Status: DONE
Summary: Matcher, API, quota và cache đã bàn giao; migration đã áp dụng; smoke và bộ kiểm tra đạt. `con mèo` trả `wrong` và không gọi AI. Claude có thể nối UI theo hợp đồng trên.

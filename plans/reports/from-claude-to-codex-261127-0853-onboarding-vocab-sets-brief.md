# Brief cho Codex: hoàn tất phase 01 + phase 02 (bộ từ và flashcard)

Project: `/Users/hnam/orca/projects/openengquiz` (Next.js 16.4 + Supabase, pnpm). Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit**.

## Đọc trước

- `AGENTS.md` (Next.js 16 khác bản bạn biết; đọc docs trong `node_modules/next/dist/docs/` khi cần API)
- `README.md`, `docs/code-standards.md` (quy ước UI, thứ tự ưu tiên Watermelon > shadcn > Sora)
- `plans/261126-2202-english-learning-web-mvp/plan.md`, `phase-01-foundation.md`, `phase-02-vocabulary-flashcards.md`
- `supabase/migrations/20261126150000_core_schema.sql` (schema + RLS đã áp dụng lên Supabase)
- Code hiện có: `src/app/(app)/layout.tsx`, `src/app/(app)/home/page.tsx`, `src/components/layout/{app-sidebar.tsx,nav-items.ts}`, `src/lib/supabase/*`, `src/lib/ai/*`, `src/proxy.ts`

## Việc cần làm

### A. Phần còn lại của phase 01

1. **Onboarding** `/onboarding`: chọn mục tiêu (`ielts|toeic|thpt|communication|work`) và trình độ CEFR (`A1..C2`), lưu vào `profiles.goal/level` bằng server action. User đã đăng nhập mà `goal` còn null thì từ `/home` chuyển sang `/onboarding`. Cho phép bỏ qua.
2. **CI** `.github/workflows/ci.yml`: pnpm install, `pnpm lint`, `pnpm typecheck`, `pnpm test` (không cần build, không cần secret).

### B. Phase 02 (phạm vi đã thu hẹp)

Làm:
- CRUD bộ từ: danh sách `/sets`, tạo `/sets/new`, xem `/sets/[id]`, sửa `/sets/[id]/edit`, xoá, nhân bản, đổi visibility (private/unlisted/public). Server actions + RLS sẵn có.
- Thẻ: thêm/sửa/xoá/sắp xếp thủ công; **nhập hàng loạt** (mỗi dòng `term - nghĩa`, cũng nhận tab/CSV `term,nghĩa`). Parser là hàm thuần có test Vitest.
- **Tra từ tự điền** `src/app/api/lookup/route.ts`: chuẩn hoá term (trim, lowercase) → đọc `word_cache` → nếu thiếu gọi Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/<term>`) lấy IPA, loại từ, nghĩa EN, ví dụ, từ đồng nghĩa → nếu có `DEEPSEEK_API_KEY` thì bổ sung nghĩa Việt + ví dụ Việt qua `getModel()` (structured output Zod) và đi qua `assertQuota`/`recordUsage`; không có key thì bỏ qua phần tiếng Việt, không lỗi. Ghi cache bằng admin client dùng env `SUPABASE_SECRET_KEY` (server-only; thiếu key thì không cache). Thêm biến vào `.env.example`. Yêu cầu đăng nhập.
- `src/lib/vocab/card-schema.ts`: Zod schema thẻ dùng chung.
- **Flashcard viewer** trong `/sets/[id]`: lật thẻ (click/Space), ←/→, xáo trộn, đánh dấu sao (lưu localStorage là đủ), a11y (focus, `aria-live`). Phát âm bằng `speechSynthesis` của trình duyệt (en-US/en-GB).
- Trang `/lookup`: tra từ + nút "Lưu vào bộ" (chọn bộ có sẵn).
- Cập nhật `nav-items.ts`: bỏ `comingSoon` cho `/sets` và `/lookup`; thêm `/sets`, `/lookup`, `/onboarding` vào `PROTECTED_PREFIXES` trong `src/lib/supabase/proxy.ts`.

Chưa làm (để sau, ghi vào phase-02 là còn lại): Azure TTS + lưu audio, tìm ảnh/GIF (Tenor/Pexels), upload ảnh, thư mục (folders), trang tiến độ bộ từ.

Nếu cần migration mới: tạo file trong `supabase/migrations/` (timestamp sau `20261126150000`), giữ RLS. Đẩy lên bằng lệnh trong README (`supabase db push --db-url ...`, mật khẩu ở `.env.local`). Không đọc/in giá trị secret ra log.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu (code, comment, UI, docs).
- UI tiếng Việt, giọng ngắn gọn thân thiện. Trang trong app dùng style sáng kiểu edtech (Nunito, `Button` chunky có sẵn trong `src/components/ui/button.tsx`, thẻ `border-2 rounded-3xl`). Ưu tiên component Watermelon (`pnpm dlx shadcn@latest view/add @watermelon/<tên>`, ví dụ `flip-card`); khi cài, từ chối ghi đè file có sẵn (`yes n |`).
- Next 16 bật Cache Components: đọc cookies/searchParams/params động phải nằm trong `<Suspense>` (xem `src/app/(app)/layout.tsx`). `params`/`searchParams` là Promise.
- Không dùng secret ở client. Không thêm dữ liệu giả.
- Dev server đang chạy ở cổng 3100, **đừng tắt/khởi động lại**. Nếu cần `pnpm build`, dùng `NEXT_DIST_DIR` riêng hoặc bỏ qua build và ghi chú lại.
- Comment code bằng tiếng Anh, file kebab-case.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` đều qua (0 error).
- Cập nhật `docs/code-standards.md` (bảng "Đang dùng" nếu thêm component Watermelon), `README.md` (env mới), và status trong `plan.md` + `phase-02-vocabulary-flashcards.md`.
- Ghi báo cáo ngắn vào `plans/reports/from-codex-to-claude-261127-0853-onboarding-vocab-sets-report.md`: file đã đổi, cách đã kiểm tra, việc còn lại, câu hỏi mở. Kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

# Brief cho omp: phase 05 (AI tạo flashcard)

Project: `/Users/hnam/orca/projects/openengquiz` (Next.js 16.4 + Supabase + Vercel AI SDK 7 + DeepSeek, pnpm). Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit**.

## Đọc trước

- `AGENTS.md` (Next.js 16 khác bản bạn biết; đọc docs trong `node_modules/next/dist/docs/` khi cần)
- `README.md`, `docs/code-standards.md`
- `plans/261126-2202-english-learning-web-mvp/plan.md` và `phase-05-ai-flashcard-generator.md` (yêu cầu chính)
- Code có sẵn để dùng lại, **không viết lại**:
  - `src/lib/ai/client.ts` (`getModel()`, `isAiConfigured()`), `src/lib/ai/quota.ts` (`assertQuota`, `recordUsage`, `QuotaExceededError`), `src/lib/ai/quota-rules.ts` (feature `generate-cards` đã có hạn mức 50/ngày)
  - `src/lib/vocab/enrich-vietnamese.ts`: mẫu gọi structured output với AI SDK 7 (`generateText` + `Output.object({ schema })`, đọc `result.output`). Theo đúng mẫu này; streaming dùng `streamText` + `Output` tương ứng nếu cần.
  - `src/lib/vocab/card-schema.ts` (Zod thẻ), `src/lib/vocab/lookup-term.ts` (`normalizeLookupTerm`), bảng `word_cache` (đọc bằng client thường; ghi bằng `createAdminClient()` trong `src/lib/supabase/admin.ts`)
  - `src/app/(app)/sets/card-actions.ts` (thêm thẻ vào bộ, kiểm tra quyền chủ sở hữu), `src/app/(app)/sets/new/`, trang bộ từ `src/app/(app)/sets/[id]/page.tsx`

## Việc cần làm

1. `src/lib/ai/generate-cards.ts` + route `src/app/api/ai/generate-cards/route.ts`: 3 nguồn vào là danh sách từ, đoạn văn bản, chủ đề + trình độ CEFR (mặc định lấy `profiles.level`). Output qua Zod, tối đa 50 thẻ mỗi lần, loại trùng term (so với nhau và với thẻ đã có trong bộ đích nếu có). Lỗi format thì thử lại 1 lần rồi báo lỗi. Gọi `assertQuota` trước, `recordUsage` sau khi thành công (1 lần sinh = 1 lượt). Danh sách từ: lấy `word_cache` trước, chỉ hỏi LLM phần thiếu.
2. Trang `/sets/new/ai` (và lối vào từ `/sets/new` và trang bộ từ "Thêm thẻ bằng AI"): chọn nguồn, xem trước dạng danh sách, bỏ chọn/sửa từng thẻ, rồi lưu vào bộ mới hoặc bộ có sẵn của mình. Thẻ hiện dần khi sinh nếu làm streaming được, không bắt buộc.
3. Ảnh: OCR bằng Tesseract.js **chạy trên trình duyệt** (lazy-load, resize ảnh trước), hiện text cho người dùng sửa, rồi gửi như "đoạn văn bản". Ảnh không gửi lên server.
4. Chưa có `DEEPSEEK_API_KEY` trong `.env.local`: khi `isAiConfigured()` là false, trang hiện thông báo rõ ràng "chưa bật AI", route trả 503. Không giả lập dữ liệu AI.
5. Test Vitest cho phần thuần (chuẩn hoá/loại trùng, ghép cache với kết quả LLM, giới hạn số thẻ). Không gọi mạng trong test.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu (code, comment, UI, docs).
- UI tiếng Việt, ngắn gọn thân thiện; style sáng kiểu edtech (Nunito, `Button` trong `src/components/ui/button.tsx`, thẻ `border-2 rounded-3xl`). Ưu tiên component Watermelon (`pnpm dlx shadcn@latest view/add @watermelon/<tên>`, khi cài từ chối ghi đè: `yes n |`).
- Next 16 Cache Components: dữ liệu theo request nằm trong `<Suspense>`; `params`/`searchParams` là Promise. **Không** export `runtime`/`dynamic` ở route (không hợp lệ với Cache Components).
- Mọi lời gọi AI chỉ ở server. Không đọc, in hay ghi giá trị secret. Nếu cần migration thì chỉ viết file, **không tự đẩy**, ghi tên vào báo cáo.
- JSX dễ đọc, không nhồi nhiều phần tử trên một dòng. Comment code bằng tiếng Anh, file kebab-case.
- Dev server đang chạy ở cổng 3100 trong terminal Orca "dev 3100", **đừng tắt**. Đừng chạy `pnpm build` (đụng `.next` của dev server).
- Không sửa các file ngoài phạm vi trừ khi cần để nối tính năng (ví dụ thêm link vào trang bộ từ).

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error). Mở thử `/sets/new/ai` qua `curl` khi chưa đăng nhập (phải chuyển login) và kiểm tra log dev server không có lỗi compile.
- Cập nhật status + checklist trong `phase-05-ai-flashcard-generator.md` và dòng Status trong `plan.md`; `docs/code-standards.md` nếu thêm component Watermelon; `README.md` nếu thêm dependency/biến.
- Ghi báo cáo `plans/reports/from-omp-to-claude-261127-1040-ai-card-generator-report.md`: file đã đổi, cách đã kiểm tra, việc còn lại, câu hỏi mở. Kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

# Phase 05: AI tạo flashcard

Context: [plan.md](plan.md) · Research mục 3.2

## Requirements

Đầu vào → bộ thẻ có cấu trúc (term, loại từ, IPA, nghĩa Việt, ví dụ, đồng nghĩa):

| Đầu vào | Xử lý |
|---|---|
| Danh sách từ/cụm từ | Lookup cache trước, LLM bổ sung phần thiếu |
| Đoạn văn bản | LLM trích từ đáng học theo trình độ CEFR người dùng, kèm câu gốc làm ví dụ |
| Chủ đề ("phỏng vấn xin việc", B1) | LLM sinh N từ theo chủ đề + trình độ |
| Ảnh (sách, ghi chú, thực đơn) | **Tesseract.js** OCR trên trình duyệt. Người dùng sửa text rồi gửi như đoạn văn bản; không gửi ảnh. |

- Màn hình xem trước: người dùng bỏ chọn/sửa từng thẻ trước khi lưu.
- Quota: tính theo lần sinh; giới hạn số thẻ mỗi lần (vd 50).

## Files tạo

- `src/lib/ai/generate-cards.ts` - `generateText` với `Output.object` và Zod (`card-schema.ts`)
- `app/api/ai/generate-cards/route.ts`
- `app/(app)/sets/new/ai/page.tsx`, `components/ai/{card-preview-list,image-ocr}.tsx` (Tesseract.js, lazy-load worker + `eng` traineddata)
- Ảnh xử lý ngay trên trình duyệt, không upload lên server

## Steps

1. Prompt + schema; validate, loại thẻ trùng term trong bộ.
2. Merge với `word_cache` để giảm gọi LLM và giữ IPA nhất quán.
3. Trả danh sách sau khi sinh xong; streaming không bắt buộc theo brief.
4. OCR: resize ảnh trước khi nhận dạng, hiển thị text để người dùng sửa trước khi gửi DeepSeek.

## Validation

- Output luôn qua Zod; lỗi format → retry 1 lần rồi báo lỗi.
- Văn bản 300 từ → 10–20 thẻ hợp lý, không trùng.
- Vượt quota → thông báo, không gọi LLM.

## Risks

- AI sai nghĩa: người dùng xem trước, sửa hoặc bỏ chọn trước khi lưu.
- OCR chữ viết tay kém → cho sửa text; ảnh in/sách cho kết quả tốt.
- DeepSeek trả JSON lệch schema → dùng JSON mode + Zod validate + retry.

## Status

**Status**: DONE_WITH_CONCERNS (đã triển khai; chưa kiểm thử với DeepSeek thật).

- [x] Sinh từ danh sách từ, đoạn văn bản hoặc chủ đề; CEFR mặc định theo hồ sơ, hoặc B1 nếu chưa đặt.
- [x] Đọc `word_cache` trước khi hỏi DeepSeek cho các từ chưa có kết quả dùng được.
- [x] Kiểm tra output bằng Zod, thử lại một lần khi sai định dạng, giới hạn 50 thẻ và loại trùng theo bộ đích.
- [x] Kiểm tra quota trước khi sinh, ghi một lượt khi thành công.
- [x] Có lối vào từ `/sets/new` và bộ từ của mình; xem trước, bỏ chọn, sửa và lưu thẻ.
- [x] Lazy-load OCR tiếng Anh trong trình duyệt, thu nhỏ ảnh và cho sửa text trước khi gửi.
- [x] Thông báo AI chưa bật trên trang và API trả `503` khi thiếu cấu hình.
- [x] Kiểm thử Vitest cho chuẩn hóa, loại trùng, giới hạn và ghép cache.
- [x] Smoke test cổng 3100: khách được chuyển về đăng nhập, API trả `503` khi AI chưa bật, OCR chạy trong trình duyệt.
- [x] `pnpm test && pnpm typecheck && pnpm lint` qua, 0 lỗi.
- [ ] Xác minh đoạn văn khoảng 300 từ và quy trình sinh, sửa, lưu bằng DeepSeek thật khi có cấu hình.

Xem kết quả kiểm tra trên dev server cổng 3100 và việc còn lại trong [báo cáo bàn giao](../reports/from-omp-to-claude-261127-1040-ai-card-generator-report.md).

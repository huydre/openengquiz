# Phase 07: AI Grammar, Reading, AI Call

Context: [plan.md](plan.md) · Research mục 3.5

Status: DONE_WITH_CONCERNS. Đã triển khai; migration chưa đẩy, chưa thử tích hợp khi đăng nhập.

## Requirements

| Chế độ | Mô tả |
|---|---|
| Grammar | AI đưa câu tiếng Việt dùng từ trong bộ → người học dịch sang tiếng Anh → chấm % đúng, sửa lỗi, giải thích; chế độ "sửa câu sai" |
| Reading | AI viết đoạn văn ngắn (theo CEFR) chứa 5–10 từ của bộ → từ được tô sáng, bấm xem nghĩa → 3–5 câu hỏi đọc hiểu |
| AI Call | Hội thoại giọng nói theo kịch bản (phỏng vấn, gọi món, du lịch…) dùng từ trong bộ; turn-based: nói → STT → LLM → TTS; có chế độ gõ chữ |

- Lưu lịch sử: bài reading, hội thoại, các câu grammar đã sai (ôn lại).
- Cuối hội thoại: tổng kết từ đã dùng/chưa dùng, lỗi hay gặp.

## Files tạo

- `lib/ai/{grammar,reading,conversation}.ts` (schema Zod cho từng loại)
- `app/api/ai/{grammar,reading}/route.ts`, `app/api/conversation/[threadId]/turn/route.ts`
- `app/(app)/study/[setId]/{grammar,reading,call}/page.tsx`, `app/(app)/history/page.tsx`
- `20261127123000_ai_practice_history.sql`: `chat_threads`, `chat_messages`, `reading_passages`, `grammar_attempts`; RLS và RPC lưu lượt nguyên tử. Không lưu bản ghi âm.

## Steps

1. Grammar: sinh câu + đáp án tham chiếu; chấm bằng LLM so nghĩa (không so khớp chuỗi).
2. Reading: kiểm đủ toàn bộ 5 đến 10 từ đã chọn, sinh lại tối đa một lần; cache riêng, dùng chung cho bộ public khi server có quyền ghi cache.
3. AI Call: tái dùng recorder + STT phase 06; LLM `streamText` cho văn bản, TTS từng câu trả lời; giới hạn số lượt/cuộc gọi.
4. Quota riêng cho từng chế độ.

## Validation

- [x] DeepSeek thật: Reading có đủ 5 từ, 4 câu hỏi; Grammar chấm bản dịch khác cách diễn đạt 100%; AI Call giữ ngữ cảnh qua 11 lượt và tạo tổng kết.
- [x] PostgreSQL tạm: kiểm tra RLS hội thoại, trần 15 lượt, từ chối tổng kết cũ và lượt sau khi đóng.
- [x] Dev cổng 3100: trang chuyển đăng nhập, API trả 401 khi chưa có phiên.
- [ ] Đẩy migration và thử UI, ghi lịch sử và STT với phiên đăng nhập.

## Risks

- Độ trễ AI Call (STT + LLM + TTS) ~3–6s → hiển thị text trước, audio sau.
- Hội thoại lan man → system prompt khoá kịch bản + giới hạn độ dài.

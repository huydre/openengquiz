# Phase 07: AI Grammar, Reading, AI Call

Context: [plan.md](plan.md) · Research mục 3.5

Status: DONE_WITH_CONCERNS (27/11/2026). Migration đã đẩy, đã thử DeepSeek thật ở tầng hàm. Còn: thử toàn luồng khi đăng nhập (mic/STT/TTS, lưu lịch sử).

## Requirements

| Chế độ | Mô tả |
|---|---|
| Grammar | AI đưa câu tiếng Việt dùng từ trong bộ → người học dịch sang tiếng Anh → chấm % đúng, sửa lỗi, giải thích; chế độ "sửa câu sai" |
| Reading | AI viết đoạn văn ngắn (theo CEFR) chứa 5–10 từ của bộ → từ được tô sáng, bấm xem nghĩa → 3–5 câu hỏi đọc hiểu |
| AI Call | Màn gọi rảnh tay theo kịch bản, mic tự mở sau khi AI nói, tự gửi theo khoảng im lặng; chuyển sang chat để gõ, tra từ và xin nhận xét. |

- Lưu lịch sử: bài reading, hội thoại, các câu grammar đã sai (ôn lại).
- Cuối hội thoại: tổng kết từ đã dùng/chưa dùng, lỗi hay gặp.

## Files tạo

- `lib/ai/{grammar,reading,conversation}.ts` (schema Zod cho từng loại)
- `app/api/ai/{grammar,reading}/route.ts`, `app/api/conversation/[threadId]/turn/route.ts`
- `app/(app)/study/[setId]/{grammar,reading,call}/page.tsx`, `app/(app)/history/page.tsx`
- `20261127123000_ai_practice_history.sql`: `chat_threads`, `chat_messages`, `reading_passages`, `grammar_attempts`; RLS và RPC lưu lượt nguyên tử. Không lưu bản ghi âm.
- `20261127190000_chat_message_terms.sql`: lưu gợi ý từ theo tin nhắn gia sư, giữ chip khi tiếp tục cuộc gọi. Cần áp migration trước khi triển khai mã AI Call mới.

## Steps

1. Grammar: sinh câu + đáp án tham chiếu; chấm bằng LLM so nghĩa (không so khớp chuỗi).
2. Reading: kiểm đủ toàn bộ 5 đến 10 từ đã chọn, sinh lại tối đa một lần; cache riêng, dùng chung cho bộ public khi server có quyền ghi cache.
3. AI Call: WAV chép bằng Groq, ghi lại transcript qua NDJSON trước khi LLM trả lời xong; tách câu khi stream để phát TTS nối tiếp. Giữ trần số lượt và tổng kết.
4. Quota riêng cho từng chế độ.

## Validation

- [x] DeepSeek thật: Reading có đủ 5 từ, 4 câu hỏi; Grammar chấm bản dịch khác cách diễn đạt 100%; AI Call giữ ngữ cảnh qua 11 lượt và tạo tổng kết.
- [x] PostgreSQL tạm: kiểm tra RLS hội thoại, trần 15 lượt, từ chối tổng kết cũ và lượt sau khi đóng.
- [x] Dev cổng 3100: trang chuyển đăng nhập, API trả 401 khi chưa có phiên.
- [ ] Đẩy migration và thử UI, ghi lịch sử và STT với phiên đăng nhập.

## Risks

- Độ trễ AI Call: Kokoro vẫn phải tạo audio từ câu đầu. Phát và nạp trước theo câu để không chờ toàn bộ phần trả lời.
- Hội thoại lan man → system prompt khoá kịch bản + giới hạn độ dài.

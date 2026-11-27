# Phase 06: AI Speaking & chấm phát âm

Context: [plan.md](plan.md) · Research mục 3.4, 8.5

Status: DONE_WITH_CONCERNS. Code đã triển khai; migration lịch sử chưa đẩy. Chưa thử toàn luồng với phiên đăng nhập và dịch vụ AI thật.

## Requirements

Hai bài luyện, cùng một luồng ghi âm:

1. **Speaking với từ mục tiêu**: AI đặt câu hỏi mở yêu cầu dùng từ X → người học trả lời bằng giọng nói (≤ 60s) → phản hồi:
   - Có dùng đúng từ X không (nghĩa + ngữ cảnh).
   - Sửa ngữ pháp dạng gạch/thay + giải thích tiếng Việt ngắn.
   - Câu mẫu tự nhiên hơn, ước lượng CEFR, gợi ý trả lời dài hơn.
   - Điểm phát âm theo từ, từ phát âm sai được tô đỏ, nghe lại mẫu TTS.
2. **Luyện phát âm từ/câu**: đọc theo câu mẫu → điểm accuracy/fluency/completeness, chi tiết âm vị.

## Luồng kỹ thuật (turn-based)

```text
Trình duyệt ghi WAV PCM 16 kHz mono, xin đồng ý trước khi bật mic.
POST /api/speaking/assess (multipart, tối đa 60 giây / 5 MB)
  Đọc câu mẫu: Pronunciada chấm theo câu mẫu.
  Nói tự do: xác định bản chép (Groq, Web Speech API hoặc nhập tay).
  Pronunciada chấm theo bản chép; DeepSeek góp ý ngữ pháp khi đã bật.
  Lưu điểm và văn bản vào speaking_attempts; không lưu bản ghi âm.
```

## Files tạo

- `src/components/audio/`: ghi WAV, mức âm, thời gian và nghe lại cục bộ.
- `src/components/speaking/`: giao diện hai bài luyện, điểm theo từ, chi tiết IPA và góp ý AI.
- `src/lib/speech/`: xác thực WAV và gợi ý IPA tiếng Việt; `src/lib/ai/speaking-feedback.ts` dùng structured output Zod.
- `src/app/api/speaking/{question,assess}/route.ts`: câu hỏi, STT Groq, chấm điểm và lưu kết quả.
- `src/app/(app)/study/[setId]/speaking/page.tsx`, `src/app/(app)/pronunciation/page.tsx`, `src/app/(app)/speaking/history/page.tsx`
- `20261127120100_speaking_attempts.sql`: lịch sử văn bản và kết quả, RLS chỉ chủ sở hữu.

## Steps

1. Recorder dùng Web Audio API, không dùng WebM/Opus. Thử nghiệm cùng câu cho điểm Opus 0,46 so với WAV 0,73.
2. Câu hỏi mở theo từ và CEFR, có câu hỏi dự phòng khi chưa bật DeepSeek.
3. Assess giới hạn 30 giây; thiếu DeepSeek vẫn chấm phát âm.
4. Quyết định mới: không lưu audio, thay kế hoạch lưu 30 ngày để giảm rủi ro dữ liệu giọng nói.
5. Kiểm quota theo lượt gọi AI hoặc chấm phát âm. Chưa cache câu hỏi; brief không bắt buộc.

## Validation

- [x] `pnpm test` qua 47 test; `pnpm typecheck` qua; `pnpm lint` có 0 lỗi và 5 cảnh báo vendor.
- [x] Chromium với fixture: đồng ý ghi âm, WAV, chọn từ bằng Watermelon Select, nhập bản chép, điểm/IPA và hiển thị sửa «can handles» thành «can handle».
- [x] Pronunciada thật trả điểm cho WAV mẫu qua client server; PostgreSQL tạm xác nhận RLS tách lượt luyện giữa hai người dùng.
- [x] Cổng 3100: hai API trả 401 khi chưa đăng nhập; ba trang chuyển đến đăng nhập.
- [ ] Đẩy migration và thử toàn luồng với phiên đăng nhập, gồm lưu và đọc lịch sử.
- [ ] Thử Groq, Web Speech thật và DeepSeek (sửa ngữ pháp, nhận biết thiếu từ mục tiêu).
- [ ] Thử Chrome Android, Safari iOS và đo p95 cho câu trả lời 20 giây (mục tiêu dưới 8 giây).

## Risks

- Dữ liệu giọng nói nhạy cảm: xin đồng ý trước lần ghi đầu, nêu rõ các dịch vụ xử lý và không lưu bản ghi.
- Tài nguyên VPS dùng chung (CPU) → giới hạn 60s + quota.

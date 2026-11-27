# Phase 03: Chế độ học không dùng AI

Status: code xong (27/11/2026): 6 chế độ ở `/study/[setId]/*`, sinh câu hỏi, chấm điểm ở server, PDF font Be Vietnam Pro. Còn: chạy thử khi đăng nhập (cần `SUPABASE_SECRET_KEY`); Dictation dùng `speechSynthesis` tới khi có Azure TTS.

Context: [plan.md](plan.md) · Research mục 3.5; thuật toán Learn mode tham khảo docs/openquiz-research.md mục 3.2

Nguyên tắc: các chế độ này là **logic thuần**, không gọi AI → miễn phí, không quota.

## Requirements

| Chế độ | Mô tả |
|---|---|
| Learn | Chia đợt 5–7 thẻ; trộn trắc nghiệm → gõ đáp án; thẻ sai quay lại đợt sau; tiến độ not-started/learning/mastered |
| Quiz / Test | Cấu hình số câu, loại câu (trắc nghiệm, đúng/sai, điền từ, nối); chấm điểm, xem lại câu sai |
| Dictation | Nghe TTS → gõ từ hoặc câu ví dụ; so khớp bỏ qua hoa/thường, gợi ý chữ cái |
| Writing | Nhìn nghĩa → gõ từ; luyện chính tả lặp lại từ sai |
| Game | 1 mini-game gốc (vd: chọn đúng nghĩa trước khi hết giờ, có combo/điểm, bảng điểm cá nhân) |
| Printable Worksheet | Sinh PDF: bảng từ + dòng kẻ luyện viết + bài điền từ; tải về/in |

## Files tạo

- `lib/study/{learn-algorithm,question-generator,answer-matcher}.ts` + unit test
- `app/(app)/study/[setId]/{learn,quiz,dictation,writing,game,worksheet}/page.tsx`
- `components/study/{multiple-choice,type-answer,matching,progress-bar,result-summary}.tsx`
- `app/api/worksheet/[setId]/route.ts` - PDF (`@react-pdf/renderer`)

## Steps

1. Question generator dùng chung: hướng term→nghĩa, nghĩa→term, ví dụ có chỗ trống; đáp án nhiễu lấy từ cùng bộ.
2. Learn algorithm (thuần hàm, test kỹ), lưu `study_sessions` + `study_attempts`.
3. Từng chế độ dùng lại component câu hỏi.
4. Game: 1 game đơn giản tự thiết kế, không mô phỏng game của sản phẩm khác.
5. Worksheet PDF hỗ trợ font tiếng Việt.

## Validation

- Unit test: generator không sinh đáp án nhiễu trùng đáp án đúng; matcher chấp nhận khác hoa/thường, khoảng trắng.
- Bộ < 4 thẻ vẫn chạy (giảm số đáp án).
- PDF hiển thị đúng dấu tiếng Việt.

## Risks

- Quá nhiều chế độ gây rối → trang bộ từ có nút "Học tiếp" gợi ý chế độ phù hợp.

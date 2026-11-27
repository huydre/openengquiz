# Bàn giao phase 05: AI tạo flashcard

## File đã đổi

- `src/lib/ai/generate-cards.ts`, `src/lib/ai/generated-card-data.ts`, `src/lib/ai/generate-cards.test.ts`: dùng schema thẻ chung, retry đúng một lần khi lỗi định dạng, chuẩn hóa và lọc trùng, ghép cache theo thứ tự nhập. Giữ IPA đã có trong cache; không ghi đầu ra sinh từ input người dùng đè lên từ điển chung.
- `src/app/api/ai/generate-cards/route.ts`: kiểm tra JSON, nguồn, CEFR và quyền sở hữu bộ đích; trả lỗi thân thiện cho quota, thiếu cấu hình và output sai định dạng.
- `src/app/(app)/sets/new/ai/{page.tsx,ai-card-generator.tsx}`, `src/components/ai/{card-preview-list,image-ocr}.tsx`: chọn nguồn và bộ đích, xem trước rồi sửa hoặc bỏ chọn, xử lý OCR và báo khi AI chưa bật.
- `src/app/(app)/sets/{card-actions.ts,new/page.tsx,[id]/page.tsx}`: lối vào tạo thẻ và kiểm tra schema, quyền sở hữu, từ trùng trước khi lưu.
- `README.md`, `plans/261126-2202-english-learning-web-mvp/{plan.md,phase-05-ai-flashcard-generator.md}`: cấu hình, dependency và checklist. Không thêm Watermelon nên `docs/code-standards.md` giữ nguyên. `tesseract.js` đã có trong `package.json` và `pnpm-lock.yaml` từ phiên trước.

## Cách kiểm tra

- `pnpm test && pnpm typecheck && pnpm lint`: thành công. Vitest 35/35; typecheck không lỗi; lint 0 lỗi, 5 cảnh báo ở code vendor có sẵn.
- `curl` không có phiên đăng nhập: `/sets/new/ai` trả `307` đến `/login?next=%2Fsets%2Fnew%2Fai`; `POST /api/ai/generate-cards` trả `503` khi AI chưa bật.
- Chrome với phiên đăng nhập sẵn có: vào từ `/sets/new`, thấy thông báo AI chưa bật và nút tạo thẻ bị vô hiệu hóa. OCR ảnh mẫu dọc 480×1600 thành 360×1200, nhận dạng `Fresh apples.`, sửa được văn bản và không gọi API tạo thẻ trong lúc OCR.
- Cổng 3100 không nhận kết nối lúc đầu phiên. Đã khởi động `pnpm dev` trên cổng này và giữ tiến trình chạy. Không chạy build, không tạo branch/worktree, không commit, không thêm hay đẩy migration.
- Log dev ở lần smoke cuối: trang AI trả `200` khi đã đăng nhập, API trả `503` đúng cấu hình, không có lỗi compile trong lượt cuối. Đã sửa lỗi cú pháp tạm trong lúc HMR; Chrome có cảnh báo hydration do thuộc tính chèn vào DOM (`bis_skin_checked`, `__processed_*`).

## Việc còn lại

- Khi có cấu hình DeepSeek, chạy đủ ba nguồn, xác minh văn bản khoảng 300 từ có 10 đến 20 thẻ hợp lý và kiểm tra lưu vào bộ mới lẫn bộ có sẵn bằng tài khoản thử.
- Không streaming theo brief. Quota dùng `assertQuota` và `recordUsage` hiện có, nên hai yêu cầu đồng thời vẫn có thể cùng qua kiểm tra. Lưu lọc trùng trước khi ghi, không khóa các lượt ghi đồng thời. Tạo bộ mới và ghi thẻ là hai thao tác; nếu gián đoạn giữa hai bước, bộ rỗng có thể còn lại. Thử lưu lại trong cùng trang dùng lại ID bộ đã tạo nếu đã nhận được ID.

## Câu hỏi mở

- Không có quyết định nào chặn bàn giao. Cần môi trường có DeepSeek để xác minh đầu cuối.

Status: DONE_WITH_CONCERNS
Summary: Hoàn tất sửa phase 05 và tài liệu; đã kiểm tra OCR và nhánh chưa bật AI, chưa xác minh sinh và lưu thẻ với DeepSeek thật.

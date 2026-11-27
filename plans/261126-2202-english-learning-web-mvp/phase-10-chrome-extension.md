# Phase 10: Chrome Extension

Context: [plan.md](plan.md) · Research mục 3.7

## Requirements

- Bôi đen từ/cụm từ trên mọi trang → popup: IPA, nghĩa Việt, ví dụ, nghe phát âm → "Lưu vào bộ" (chọn bộ hoặc "Từ đã lưu").
- Dịch nhanh câu đã chọn.
- YouTube: đọc phụ đề tiếng Anh → (a) bấm từ trong phụ đề để tra/lưu, (b) **Dictation** câu-theo-câu (tạm dừng, gõ lại câu), (c) **Shadowing**: lặp câu, ghi âm đọc theo, chấm phát âm qua API phase 06.
- Lưu kèm ngữ cảnh: câu gốc + URL (+ timestamp YouTube) làm ví dụ.
- Đồng bộ ngay vào tài khoản web; từ đã lưu vào SRS.

Ngoài phạm vi: Netflix (DRM, rủi ro ToS).

## Files tạo

- `extension/` (Vite + TS, Manifest V3): `manifest.json`, `src/{background,content,popup,youtube}/`
- Auth: đăng nhập qua web → trang `/extension/connect` cấp token ngắn hạn → lưu `chrome.storage`; refresh qua API.
- API web dùng chung: `/api/lookup`, `/api/extension/save-word`, `/api/speaking/assess`
- CORS chỉ cho origin `chrome-extension://<id>`

## Steps

1. Khung MV3 + popup tra từ (dùng `/api/lookup`).
2. Kết nối tài khoản + lưu từ.
3. Content script YouTube: lấy caption track, overlay phụ đề bấm được.
4. Dictation + shadowing trên YouTube.
5. Đóng gói, đưa lên Chrome Web Store (unlisted trước).

## Validation

- Quyền tối thiểu: `storage`, `activeTab`, host `youtube.com` + API domain; không xin `<all_urls>` vĩnh viễn nếu tránh được.
- Từ lưu từ extension xuất hiện trên web < 5s.
- Video không có phụ đề → báo rõ, không lỗi.

## Risks

- YouTube đổi DOM/caption API → cô lập code YouTube trong 1 module, có test thủ công checklist.
- Review Chrome Web Store mất vài ngày → nộp sớm.

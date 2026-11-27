# Phase 02: Bộ từ & Flashcard

Context: [plan.md](plan.md) · Research mục 3.1

Status: in progress (27/11/2026). Phạm vi triển khai của brief 27/11 đã có bộ từ, thẻ, tra từ cơ bản và flashcard. Phase vẫn mở cho AI/cache và các tính năng hoãn lại bên dưới.

## Tiến độ

- [x] Trang `/sets`, `/sets/new`, `/sets/[id]`, `/sets/[id]/edit`; tạo, sửa, xoá, nhân bản và đổi visibility bằng server actions.
- [x] Thêm, sửa, xoá, đổi thứ tự thẻ; nhập hàng loạt bằng dấu ` - `, tab hoặc CSV. Parser thuần có test Vitest.
- [x] Schema Zod dùng chung cho dữ liệu thẻ.
- [x] `/lookup` yêu cầu đăng nhập, chuẩn hoá term, đọc `word_cache`, tra Free Dictionary API và cho lưu kết quả vào bộ từ của mình.
- [x] Flashcard lật bằng click/Space, chuyển bằng phím mũi tên, xáo trộn, đánh dấu sao trong localStorage, thông báo trạng thái cho trình đọc màn hình; phát âm bằng `speechSynthesis` en-US/en-GB.
- [x] Bổ sung nghĩa và ví dụ tiếng Việt bằng DeepSeek qua `getModel()`, `assertQuota()` và `recordUsage()` khi có key (code xong, chưa chạy thật vì chưa có key).
- [x] Ghi kết quả tra từ vào `word_cache` bằng `SUPABASE_SECRET_KEY` phía server (`src/lib/supabase/admin.ts`).
- [ ] Kiểm chứng lượt tra thứ hai không gọi API ngoài (cần `SUPABASE_SECRET_KEY` trong `.env.local`).
- [x] TTS Kokoro (`/api/tts` → dịch vụ `services/speech/`), cache MP3 trong bucket public `tts` theo hash giọng + chữ, quota `tts` chỉ tính khi tạo mới; client `playTts` tự fallback `speechSynthesis` (khách chưa đăng nhập, thiếu `SUPABASE_SECRET_KEY`, dịch vụ lỗi). Chưa chạy thử đầu cuối vì `.env.local` chưa có `SUPABASE_SECRET_KEY`.
- [ ] Tìm ảnh/GIF qua Tenor/Pexels với safe search, cho đổi/tắt ảnh và upload ảnh riêng.
- [ ] Thư mục chứa bộ từ và trang tiến độ bộ từ (chưa học / đang học / thành thạo).
- [ ] Lọc flashcard theo trạng thái học; hoàn thiện optimistic UI cho thao tác bộ từ và thẻ.

## Requirements

- CRUD bộ từ: tạo, sửa, xoá, nhân bản, chia sẻ (private/unlisted/public), thư mục.
- Thêm thẻ thủ công; nhập hàng loạt (paste `term - nghĩa` mỗi dòng, CSV).
- **Tra từ tự điền**: gõ term → điền IPA, loại từ, nghĩa Việt, ví dụ, từ đồng nghĩa (cache `word_cache`).
- Ảnh/GIF minh hoạ: gợi ý tự động theo term, đổi/tắt được, upload ảnh riêng.
- Phát âm: TTS en-US/en-GB, sinh 1 lần, lưu Storage, dùng lại.
- Flashcard viewer: lật thẻ, ←/→, Space; đánh dấu sao; xáo trộn; lọc theo trạng thái.
- Trang tra từ độc lập (`/lookup`) + nút "Lưu vào bộ".
- Trang tiến độ bộ từ (chưa học / đang học / thành thạo).

## Files tạo

- `app/(app)/sets/{page,new/page,[id]/page,[id]/edit/page}.tsx`
- `components/flashcard/{flip-card,card-editor,bulk-import}.tsx`
- `app/api/lookup/route.ts` - Free Dictionary API → thiếu thì LLM bổ sung nghĩa Việt → cache
- `app/api/media/search/route.ts` - Tenor/Pexels, safe search
- `app/api/tts/route.ts` - Kokoro TTS (`/tts` của dịch vụ giọng nói) → Storage `audio/{voice}/{term}.mp3`
- `lib/vocab/card-schema.ts` (Zod, dùng chung mọi phase)

## Steps

1. Hoàn thiện AI tiếng Việt và ghi cache cho lookup theo `term` đã chuẩn hoá.
2. Thêm media search, upload ảnh và lưu `image_url`; dùng safe search, lazy-load, ưu tiên webp/mp4.
3. Thêm TTS Kokoro và cache audio trong Storage; giữ `speechSynthesis` làm phương án dự phòng.
4. Thêm thư mục, trang tiến độ, lọc flashcard theo trạng thái và optimistic UI còn thiếu.
5. Kiểm thử tích hợp quyền truy cập, cache và luồng học.

## Validation

- Tạo bộ 50 thẻ bằng bulk import < 1 phút.
- Gọi lookup lần 2 cùng từ không phát sinh gọi API ngoài.
- Set unlisted truy cập được qua link, không hiện trong tìm kiếm.

## Risks

- Nghĩa Việt do AI sinh có thể sai → luôn cho sửa, có nút báo lỗi.
- GIF không phù hợp → safe search + cho người dùng đổi/tắt.

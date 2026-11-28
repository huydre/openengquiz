# Brief cho omp: nghiên cứu giảm độ trễ TTS miễn phí

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. **Việc nghiên cứu, đo đạc và đề xuất**, chưa sửa code sản phẩm. Không commit, không push. Model `local/dev` nếu cần AI. Không in bí mật (`SPEECH_SERVICE_TOKEN`, key Supabase, thông tin VPS).

## Mục tiêu

Chủ dự án muốn TTS **miễn phí** với **độ trễ thấp nhất** từ lúc người học bấm loa (hoặc câu hỏi xuất hiện) tới lúc nghe được âm thanh. Đưa ra phương án cụ thể, có số đo, cho cả lần đầu (chưa có cache) lẫn lần sau.

## Hiện trạng (đọc kỹ trước)

- `src/app/api/tts/route.ts`: `GET /api/tts?text&voice&speed&engine`. Engine chính openai.fm, fallback Kokoro (dịch vụ speech tự host, `src/lib/speech/client.ts`, biến `SPEECH_SERVICE_*`). Cache MP3 trong Supabase Storage bucket `tts` theo hash voice + speed + text; trúng cache thì redirect tới file public; chưa có thì sinh rồi trả ngay, upload chạy trong `after()`. `engine=kokoro` cho cuộc gọi cần nhanh. Có quota.
- `src/lib/speech/play-tts.ts`: `playTts`, `playTtsTrack`, `prefetchTts`, `ttsUrl`; phát bằng `new Audio(url)`.
- Nơi dùng nhiều: thẻ học, đáp án tiếng Anh (`src/components/study/study-question.tsx`), bài học khoá học, chính tả (phát ngay khi câu hiện), hội thoại AI (`call`).
- Dữ liệu: khoảng 1.680 thẻ khoá học + 625 thẻ lộ trình + bộ từ người dùng.

## Cần làm

1. **Đo hiện trạng** (production `https://openengquiz.vercel.app` và dev cổng 3100, đừng tắt dev server): thời gian tới byte đầu và tới lúc phát được cho (a) từ đã cache, (b) từ chưa cache qua openai.fm, (c) qua Kokoro, (d) một câu ví dụ dài. Tách thời gian: auth + `storage.exists`, redirect, tải file từ Storage/CDN, sinh âm thanh. Chạy mỗi loại vài lần, ghi trung vị.
2. **Nghiên cứu phương án miễn phí** (đọc tài liệu hiện hành, ghi nguồn), đánh giá độ trễ, chất lượng giọng Anh, giới hạn, rủi ro điều khoản:
   - Cache chủ động: sinh sẵn audio cho toàn bộ thẻ khoá học/lộ trình (script seed) và cho thẻ người dùng khi lưu thẻ; prefetch câu kế tiếp trong các chế độ học.
   - Bỏ bớt vòng: trả URL cache trực tiếp cho client (ví dụ lưu sẵn đường dẫn audio theo thẻ, hoặc tính hash phía client) thay vì gọi route rồi redirect; CDN/cache header.
   - Phát nhanh hơn ở client: tái dùng một `Audio`/`AudioContext`, preload, streaming (MediaSource hoặc chunked) khi sinh mới.
   - Engine: Kokoro tối ưu (model nhỏ/quantized, giữ ấm, streaming theo câu), Piper, các dịch vụ miễn phí khác nếu có; Web Speech API (`speechSynthesis`) của trình duyệt làm phương án tức thì khi chưa có cache (độ trễ ~0, chất lượng tuỳ máy).
3. **Đề xuất**: phương án khuyến nghị theo thứ tự lợi ích/công sức, ước lượng độ trễ đạt được, chi phí lưu trữ (dung lượng MP3 cho ~2.300 thẻ + ví dụ), thay đổi cần làm ở file nào, và phần nào là UI (Claude làm) phần nào là logic/data (omp làm). Có thể viết prototype nhỏ trong `scripts/` hoặc thư mục tạm để đo, nhưng ghi rõ và không để lại code dở trong `src/`.

## Ràng buộc

- Không em dash "—" hay " – ".
- Không sinh hàng loạt audio lên Storage production trong đợt này (chỉ đo vài mẫu); việc seed hàng loạt chờ chủ dự án duyệt.
- Không đổi cấu hình VPS/dịch vụ speech; chỉ đọc và đo.

## Hoàn thành khi

Báo cáo `plans/reports/from-omp-to-claude-261128-1427-tts-latency-research-report.md`: số đo hiện trạng (bảng), các phương án đã xét (nguồn), khuyến nghị và kế hoạch triển khai, câu hỏi còn mở, kết thúc bằng `Status:` / `Summary:`. Rồi nhắn Claude:

`orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-1427-tts-latency-research-report.md, Status: <status>" --enter --json` (handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

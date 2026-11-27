# Plan: Web học tiếng Anh: MVP đầy đủ tính năng

- Status: in progress. Phase 09 (lớp học) hoãn theo quyết định của user. Còn phase 10 (extension), phase 11 (deploy), đăng nhập Google và kiểm toàn luồng đăng nhập.
  **Phase 07 (Grammar, Reading, AI Call): DONE_WITH_CONCERNS**. **Phase 08 (Khoá học IELTS):** cấp `foundations` đã seed; player bảy bước đã triển khai. Cần áp hai migration mới rồi thử luồng đăng nhập với dịch vụ thật.
- Ngày: 26/11/2026
- Research gốc: [docs/openquiz-research.md](../../docs/openquiz-research.md)

## Quyết định đã chốt (từ user)

| Hạng mục | Quyết định |
|---|---|
| Sản phẩm | Web học **tiếng Anh** cho người Việt |
| Mô hình | **Miễn phí hoàn toàn**, không thanh toán, không Premium |
| Frontend | Next.js (App Router) + TypeScript + Tailwind + **Watermelon UI làm UI chính** (trên nền shadcn/ui) - quy ước ở `docs/code-standards.md` |
| Backend | Supabase (Auth, Postgres + RLS, Storage) + Next.js Route Handlers / Server Actions |
| Phạm vi | Flashcard, AI tạo thẻ, SRS, speaking + phát âm, chế độ học, khoá học, extension, lớp học |

## Quyết định kỹ thuật

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| LLM | **DeepSeek** (model flash, user đã có key) qua Vercel AI SDK `@ai-sdk/deepseek`; model id cấu hình qua env `AI_MODEL` | Rẻ; đổi model/provider không sửa code; structured output (Zod) |
| OCR ảnh → chữ | **Tesseract.js** chạy trên trình duyệt, chỉ gửi văn bản cho DeepSeek | Miễn phí; không gửi ảnh lên server, không phụ thuộc vision của LLM |
| STT + chấm phát âm + TTS | **Tự host trên VPS** (`services/speech/`): Pronunciada chấm phát âm + Kokoro TTS; STT cho nói tự do dùng Groq Whisper free tier hoặc Web Speech API (đổi từ Azure ngày 27/11/2026) | Azure F0 chỉ 5 giờ/tháng; giải pháp mở miễn phí, đã thử chạy tốt. Chi tiết: [docs/speech-alternatives-research.md](../../docs/speech-alternatives-research.md) |
| Voice | Ghi âm → upload → xử lý (turn-based), không streaming | Không cần WebSocket server, chạy được trên Vercel |
| SRS | `ts-fsrs` | FSRS hiện đại hơn SM-2, có thư viện TS |
| Ảnh/GIF thẻ | Tenor/Giphy (GIF) + Pexels (ảnh), cache URL | Free API, safe search |
| Từ điển | Free Dictionary API + LLM bổ sung nghĩa Việt, cache vĩnh viễn | Chi phí ~0 |
| Deploy | Vercel + Supabase Cloud | Ít vận hành |
| Kiểm soát chi phí AI | Bảng `ai_usage` + quota/ngày/user, enforce ở server. Quota tác vụ giọng nói giúp giới hạn tải VPS và lượt gọi dịch vụ. | User: DeepSeek rẻ, chưa cần tính ngân sách |
| Nội dung khoá học | IELTS 7 cấp, 6 phần và 30 bài mỗi cấp; tên bài và câu hỏi tự soạn, từ do DeepSeek sinh và cần duyệt | Không dùng nội dung hoặc danh sách từ OpenQuiz |

## Phases

Xem dòng Status ở đầu trang và checklist trong từng phase.

| # | Phase | Phụ thuộc | Ước lượng (1 dev) | File |
|---|---|---|---|---|
| 1 | Nền tảng: setup, auth, schema, layout, AI quota | - | 1.5 tuần | [phase-01](phase-01-foundation.md) |
| 2 | Bộ từ & flashcard | 1 | 1.5 tuần | [phase-02](phase-02-vocabulary-flashcards.md) |
| 3 | Chế độ học không AI (Learn, Quiz, Dictation, Writing, Game, Worksheet PDF) | 2 | 2 tuần | [phase-03](phase-03-study-modes.md) |
| 4 | SRS, streak, thống kê | 2 | 1 tuần | [phase-04](phase-04-spaced-repetition.md) |
| 5 | AI tạo thẻ (từ, văn bản, chủ đề, ảnh) | 2 | 1 tuần | [phase-05](phase-05-ai-flashcard-generator.md) |
| 6 | AI Speaking + chấm phát âm | 2, 5 | 1.5 tuần | [phase-06](phase-06-ai-speaking-pronunciation.md) |
| 7 | AI Grammar, Reading, AI Call | 6 | 1.5 tuần | [phase-07](phase-07-ai-grammar-reading-call.md) |
| 8 | Khoá học IELTS (7 bước với gia sư AI, tiến độ và sổ từ) | 2, 5, 6, 7 | 1 tuần | [phase-08](phase-08-learning-paths.md) |
| 9 | Lớp học (**hoãn**) | 3, 4, 8 | 1.5 tuần | [phase-09](phase-09-classroom.md) |
| 10 | Chrome Extension | 2 | 1.5 tuần | [phase-10](phase-10-chrome-extension.md) |
| 11 | Landing/SEO, hardening, deploy | tất cả | 1 tuần | [phase-11](phase-11-launch-hardening.md) |

**Tổng ước lượng: ~15 tuần cho 1 dev full-time.** Có thể song song: 3 ∥ 4 ∥ 5 sau phase 2; 10 độc lập sau phase 2.

## Ngoài phạm vi

- Thanh toán, Premium, paywall (user quyết định web free).
- Ngôn ngữ khác ngoài tiếng Anh; app mobile native (web responsive + PWA thay thế).
- Netflix trong extension (DRM, rủi ro ToS) - chỉ YouTube + web thường.
- Gamification nâng cao (coins, shop, lootbox) - chỉ giữ streak.
- Hội thoại voice realtime streaming (dùng turn-based).

## Acceptance criteria tổng

- Người dùng đăng nhập Google, tạo/học bộ từ qua **mọi** chế độ ở mục 3 research.
- Một bộ từ dùng chung cho tất cả chế độ, không nhập lại dữ liệu.
- SRS lên lịch theo từng người; streak hoạt động.
- Mọi lời gọi AI qua server, có quota/ngày, có log chi phí.
- Giáo viên tạo lớp, giao bài có hạn, xem tiến độ từng học sinh.
- Extension lưu từ từ web/YouTube vào tài khoản.
- RLS bật trên mọi bảng; test RLS cho dữ liệu riêng tư.
- Lighthouse mobile ≥ 85 cho landing và trang học.

## Câu hỏi đã trả lời (26/11/2026)

1. API: có DeepSeek → dùng làm LLM. Speech ban đầu định dùng Azure free tier; 27/11/2026 đổi sang tự host trên VPS.
2. Ngân sách: chưa tính; dùng DeepSeek flash, quota LLM rộng.
3. Nhân lực: **1 dev** → làm tuần tự theo thứ tự phase, ~15 tuần.
4. Không có người dùng dưới 16 tuổi → consent mic chuẩn, không cần đồng ý phụ huynh.
5. Nội dung: quyết định 27/11 thay lộ trình bằng Khoá học IELTS; xem Quyết định kỹ thuật.

## Câu hỏi mở

1. ~~Azure Speech~~: đã thay bằng dịch vụ tự host trên VPS (27/11/2026). Đã có HTTPS `https://speech.techlaai.io.vn`. Còn: key Groq nếu dùng Whisper cho nói tự do.

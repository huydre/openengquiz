# OpenEngQuiz

Web học từ vựng tiếng Anh miễn phí cho người Việt. Có đăng nhập, bộ từ, tra từ, tạo thẻ bằng AI, ôn tập ngắt quãng (FSRS), luyện nói theo từ và luyện phát âm.

- Research: [docs/openquiz-research.md](docs/openquiz-research.md)
- Plan MVP: [plans/261126-2202-english-learning-web-mvp/plan.md](plans/261126-2202-english-learning-web-mvp/plan.md)

## Stack

Next.js 16 (App Router, Cache Components, `src/proxy.ts`) · Tailwind 4 + **Watermelon UI (UI chính)** trên nền shadcn/ui (Base UI) - xem [docs/code-standards.md](docs/code-standards.md) · Supabase (Auth, Postgres + RLS, Storage) · Vercel AI SDK + DeepSeek · Tesseract.js (OCR) · Vitest.

## Chạy local

```bash
pnpm install
cp .env.example .env.local   # điền giá trị
pnpm dev                     # http://localhost:3100
```

Biến server:

| Biến | Dùng cho |
|---|---|
| `DEEPSEEK_API_KEY`, `AI_MODEL` | Nghĩa tiếng Việt khi tra từ, các tính năng AI |
| `SUPABASE_SECRET_KEY` | **Bắt buộc** cho ôn tập và các chế độ học: mọi lượt ôn, phiên học, streak được ghi qua hàm DB chỉ server (secret key) gọi được, để lịch FSRS và điểm không bị sửa từ trình duyệt. Cũng dùng để ghi cache tra từ. Chỉ dùng ở server |

Đặt cả `DEEPSEEK_API_KEY` và `AI_MODEL` ở server để bật tạo thẻ AI. Thiếu một trong hai, trang báo AI chưa bật và API tạo thẻ trả `503`. Tra từ vẫn hoạt động nhưng không sinh thêm nghĩa tiếng Việt bằng AI.

Tạo thẻ AI giới hạn 50 thẻ mỗi lượt và 50 lượt mỗi ngày. Tesseract.js chỉ tải khi chọn ảnh; trình duyệt thu nhỏ ảnh, nhận dạng chữ tiếng Anh và cho sửa nội dung trước khi gửi. Chỉ văn bản được gửi, không tải ảnh lên server.

`SPEECH_SERVICE_URL`, `SPEECH_SERVICE_TOKEN` (server-only): dịch vụ giọng nói tự host, xem mục dưới.

`PIXABAY_API_KEY` (tuỳ chọn, chỉ dùng ở server): tìm ảnh minh hoạ cho thẻ qua Pixabay (key miễn phí tại pixabay.com/api/docs, nhanh). Không có thì dùng Pexels nếu có `PEXELS_API_KEY`, cuối cùng là Openverse (không cần key, chậm hơn). Mọi nguồn đều bật lọc nội dung người lớn.

`GROQ_API_KEY` (khuyến nghị, chỉ dùng ở server): chép câu trả lời nói bằng Groq Whisper (gói miễn phí). Thiếu khoá, hết hạn mức hoặc lỗi thì tự chuyển sang Whisper `base.en` trên dịch vụ giọng nói (`/transcribe`, chậm và kém chính xác hơn với giọng nặng). Người học luôn xem và sửa được bản chép trước khi gửi. Cùng khoá này, nhận xét câu trả lời trong bài học chạy trên Groq (`openai/gpt-oss-120b` chấm điểm, `openai/gpt-oss-20b` viết câu mẫu, khoảng 1,5 s; đổi bằng `FEEDBACK_MODEL` và `FEEDBACK_ANSWER_MODEL`). Hết hạn mức hoặc lỗi thì tự dùng DeepSeek. Band IELTS bị giới hạn theo độ dài câu trả lời để không chấm quá tay. Không cần DeepSeek để chấm phát âm; thiếu cấu hình DeepSeek thì không có phản hồi ngữ pháp AI.

## Dịch vụ giọng nói (`services/speech/`)

Thay Azure Speech bằng mã nguồn mở, chạy Docker trên VPS. Lý do chọn: [docs/speech-alternatives-research.md](docs/speech-alternatives-research.md).

| Endpoint | Việc |
|---|---|
| `GET /health` | Kiểm tra sống |
| `POST /assess` (multipart `audio`, `text`, `strictness`) | Chấm phát âm theo câu mẫu (Pronunciada): điểm câu, accuracy, fluency, completeness, điểm từng từ/âm, danh sách lỗi `issues` |
| `POST /transcribe` (multipart `audio`) | Chép lời tiếng Anh (faster-whisper `base.en`), dự phòng khi không dùng được Groq |
| `POST /tts` (JSON `text`, `voice`, `speed`) | Đọc chữ thành MP3. Giọng chính: GPT-4o mini TTS qua [TTSFM](https://github.com/dbccccccc/ttsfm) (openai.fm, không chính thức, có thể ngừng bất cứ lúc nào); lỗi hoặc quá `TTSFM_TIMEOUT` (8 s) thì dùng Kokoro. Header `x-tts-engine` cho biết engine; app chỉ cache audio openai.fm (`tts/v2/...`). Tắt bằng `TTSFM_ENABLED=0`. Giọng `af_*`/`am_*` Mỹ, `bf_*`/`bm_*` Anh |

Mọi endpoint trừ `/health` cần `Authorization: Bearer <SPEECH_API_TOKEN>`. Audio không được lưu. Container giới hạn 3 CPU, 2 GB RAM, tối đa 2 tác vụ cùng lúc (VPS dùng chung với app khác).

OpenEngQuiz không lưu bản ghi giọng nói. Trình duyệt gửi WAV cho dịch vụ chấm; khi luyện nói, Groq hoặc dịch vụ nhận dạng của trình duyệt có thể xử lý giọng nói để tạo bản chép. Lịch sử chỉ lưu câu mẫu/câu hỏi, bản chép và kết quả chấm.

Đang chạy tại `https://speech.techlaai.io.vn` (Cloudflare Tunnel trên VPS trỏ vào `localhost:8200`; lúc dev cũng gọi được qua IP Tailscale cổng 8200).

Triển khai lại:

```bash
scp services/speech/{Dockerfile,app.py,compose.yml,requirements.txt} <vps>:openengquiz-speech/service/
# Trên VPS, file .env: SPEECH_API_TOKEN=<64 ký tự hex>, BIND_IP=<ip tailscale>
cd ~/openengquiz-speech/service && docker compose up -d --build
```

| Lệnh | Việc |
|---|---|
| `pnpm test` | Unit test (Vitest) |
| `pnpm typecheck` | Sinh route types + `tsc` |
| `pnpm lint` | ESLint |
| `pnpm build` | Build production |

CI ở [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` và `pnpm test` cho mỗi push hoặc pull request. Chạy cùng bộ kiểm tra tại local:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Tính năng hiện có

| Đường dẫn | Chức năng |
|---|---|
| `/onboarding` | Chọn mục tiêu học và trình độ CEFR, hoặc bỏ qua. Người mới vào `/home` được chuyển đến đây nếu chưa chọn mục tiêu. |
| `/sets` | Xem các bộ từ của mình; tạo bộ mới tại `/sets/new`. |
| `/sets/new/ai` | Tạo thẻ từ danh sách từ, đoạn văn bản, chủ đề hoặc ảnh (OCR). Bỏ chọn hoặc sửa thẻ trước khi lưu vào bộ mới hay bộ của mình. |
| `/sets/[id]` | Học flashcard, quản lý thẻ, nhập nhiều thẻ và đổi chế độ chia sẻ. Có thể sửa bộ tại `/sets/[id]/edit`, xoá hoặc nhân bản. |
| `/review`, `/stats` | Ôn tập ngắt quãng và xem tiến độ. Các chế độ học mở từ trang bộ từ. |
| `/pronunciation` | Đọc câu tự nhập hoặc câu ví dụ từ thẻ, nghe mẫu và xem điểm phát âm. |
| `/study/[setId]/speaking` | Trả lời câu hỏi bằng từ mục tiêu, xem phát âm và nhận phản hồi AI nếu đã bật DeepSeek. |
| `/speaking/history` | Xem các lượt luyện gần đây. Không lưu bản ghi. |
| `/study/[setId]/grammar`, `/study/[setId]/reading`, `/study/[setId]/call` | Luyện dịch và sửa câu, đọc hiểu với từ trong bộ, hội thoại theo kịch bản bằng giọng nói hoặc gõ chữ. |
| `/history` | Xem câu sai, đoạn đọc và hội thoại đã lưu. Không lưu bản ghi. |
| `/courses`, `/courses/[course]` | Chọn khoá IELTS, cấp độ, xem bản đồ, mục tiêu và sổ từ. |
| `/courses/[course]/lessons/[lessonId]` | Nói trước, học từ, nói lại và hội thoại; hoàn thành để mở bài kế tiếp. |
| `/lookup` | Tra từ tiếng Anh rồi lưu kết quả vào bộ từ của mình. |
| `/api/lookup?term=word` | API yêu cầu đăng nhập, chuẩn hoá từ, đọc cache có sẵn rồi tra Free Dictionary API khi cần. |
| `/api/ai/generate-cards` | API tạo thẻ bằng AI (yêu cầu đăng nhập và quota). |

Thẻ hỗ trợ thêm, sửa, xoá, đổi thứ tự và nhập hàng loạt bằng `từ - nghĩa`, tab hoặc CSV hai cột. Flashcard hỗ trợ lật bằng click hoặc Space, chuyển bằng phím mũi tên, xáo trộn, đánh dấu sao trong trình duyệt và phát âm en-US/en-GB bằng `speechSynthesis`.

Xem trạng thái triển khai và kiểm thử tại [kế hoạch MVP](plans/261126-2202-english-learning-web-mvp/plan.md). Ảnh/GIF đính kèm thẻ vẫn nằm trong kế hoạch.

## Database

Migration nằm ở `supabase/migrations/`. Đẩy lên project:

```bash
set -a; . ./.env.local; set +a
# Kết nối trực tiếp chỉ có IPv6; mạng không có IPv6 thì dùng session pooler (IPv4):
supabase db push --db-url "postgresql://postgres.$SUPABASE_PROJECT_REF:$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

Mọi bảng bật RLS. `word_cache` chỉ server ghi (bằng secret key); `ai_usage` người dùng chỉ đọc/thêm của mình, không sửa/xoá được (để quota không bị reset).

### Xuất bản khoá IELTS

Áp `supabase/migrations/20261127160000_courses.sql` trước khi bật Khoá học. Migration xoá metadata và liên kết lộ trình cũ, không xoá `study_sets` hay `cards`. Khi thiếu schema, trang chủ vẫn dùng được nhưng không tải phần Học tiếp.

Cài Bun, chuẩn bị tài khoản hệ thống đã có profile. Đặt `SEED_CONTENT_OWNER_ID` là UUID của profile; cấu hình `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SECRET_KEY`. Seed dùng `SEED_AI_BASE_URL`, `SEED_AI_API_KEY` và `SEED_AI_MODEL` cho cả chọn từ lẫn bổ sung thẻ; không dùng cấu hình AI của app. Base URL phải hỗ trợ `/chat/completions`.

```bash
pnpm seed:courses --level foundations
# Hoặc xuất bản các cấp còn thiếu:
pnpm seed:courses
```

Seed đọc [`content/courses/ielts.yaml`](content/courses/ielts.yaml), sinh từ theo bài, khử trùng toàn khoá và chạy pipeline bổ sung IPA, nghĩa Việt, ví dụ và đồng nghĩa. Dùng DB thử để duyệt chất lượng trước khi chạy trên môi trường thật: từng cấp và bộ từ của cấp được xuất bản công khai ngay khi lưu thành công. Chạy lại bỏ qua cấp đã có; chạy tuần tự để tránh hai phiên sinh cùng từ.

**Học tiếp** mở bài đầu chưa xong của cấp đang học; nếu chưa chọn cấp, mục tiêu IELTS và CEFR từ onboarding dùng để gợi ý. **Sổ từ vựng** đọc các thẻ khoá học đã vào SRS và điểm phát âm gần nhất nếu có.

## Cấu trúc

```text
src/
  proxy.ts                 refresh session Supabase + chặn route cần đăng nhập
  app/page.tsx             landing
  app/login/               đăng nhập Google / email magic link
  app/auth/                callback OAuth, server action đăng xuất
  app/(app)/               khu vực đã đăng nhập (/home, /onboarding, /sets, /lookup)
  app/api/lookup/          API tra từ cho người đã đăng nhập
  app/api/ai/generate-cards/ API tạo thẻ từ dữ liệu văn bản
  lib/supabase/            client cho browser / server / proxy
  lib/ai/                  DeepSeek client, quota theo ngày (giờ VN)
  lib/vocab/               schema thẻ, parser nhập nhiều thẻ, tra từ điển
.github/workflows/ci.yml   lint, typecheck, test
supabase/migrations/       schema + RLS
```

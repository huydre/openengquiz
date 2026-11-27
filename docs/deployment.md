# Deploy OpenEngQuiz (Vercel + Supabase)

Production chạy Next.js trên Vercel, dữ liệu trên Supabase Cloud (project `ccquhootlvhexmdyevwl`), dịch vụ giọng nói trên VPS qua `https://speech.techlaai.io.vn`.

## 1. Kiểm tra trước khi deploy

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Mọi migration trong `supabase/migrations/` phải đã đẩy lên Supabase (xem README, mục migration).

## 2. Biến môi trường trên Vercel

Khai báo ở Project Settings → Environment Variables (môi trường Production). Không commit giá trị.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Có | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Có | Key công khai (được phép ở trình duyệt) |
| `SUPABASE_SECRET_KEY` | Có | Chỉ server: ghi tiến độ bài học, cache, xoá tài khoản |
| `NEXT_PUBLIC_SITE_URL` | Có | Domain chính, ví dụ `https://openengquiz.example` (sitemap, robots, Open Graph) |
| `DEEPSEEK_API_KEY`, `AI_MODEL` | Có | LLM chính |
| `GROQ_API_KEY` | Nên có | Chép lời, nhận xét nhanh, hội thoại AI nhanh |
| `SPEECH_SERVICE_URL`, `SPEECH_SERVICE_TOKEN` | Nên có | Chấm phát âm, giọng đọc, dự phòng chép lời |
| `GIPHY_API_KEY` hoặc `TENOR_API_KEY` | Tuỳ chọn | Tab GIF meme khi chọn ảnh thẻ |
| `PIXABAY_API_KEY` / `PEXELS_API_KEY` | Tuỳ chọn | Ảnh chụp nhanh hơn Openverse |
| `SEED_CONTENT_OWNER_ID` | Nên có | Tài khoản sở hữu nội dung khoá học; trang Tài khoản chặn tự xoá tài khoản này |
| `FEEDBACK_MODEL`, `FEEDBACK_ANSWER_MODEL` | Tuỳ chọn | Đổi model Groq cho nhận xét |

Các biến `SEED_AI_*` và `SUPABASE_DB_PASSWORD` chỉ dùng cho script seed và migration trên máy, **không** cần trên Vercel.

## 3. Cấu hình Supabase cho domain thật

Authentication → URL Configuration:

- **Site URL:** domain chính (giống `NEXT_PUBLIC_SITE_URL`).
- **Redirect URLs:** thêm `https://<domain>/auth/callback` (và URL preview của Vercel nếu muốn đăng nhập trên bản preview).

Nếu bật đăng nhập Google: Authentication → Providers → Google, nhập Client ID và Secret từ Google Cloud; trong Google Cloud thêm Authorized redirect URI là `https://ccquhootlvhexmdyevwl.supabase.co/auth/v1/callback`.

## 4. Deploy

- Cách 1 (khuyến nghị): Vercel Dashboard → Add New Project → import repo GitHub `huydre/openengquiz`, chọn framework Next.js, khai báo biến ở mục 2, Deploy. Sau đó mỗi lần push nhánh chính sẽ tự deploy.
- Cách 2: `npx vercel login` rồi `npx vercel --prod` trong thư mục dự án.

Thêm domain ở Project Settings → Domains, rồi cập nhật `NEXT_PUBLIC_SITE_URL` và mục 3.

## 5. Kiểm tra sau deploy

- Mở `/`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml` khi chưa đăng nhập.
- Đăng nhập email (và Google nếu bật), vào `/home`.
- Học thử một bài khoá học: nói (mic), học từ, hội thoại AI.
- Tra từ, thêm thẻ, chọn GIF cho thẻ.
- Kiểm tra header bảo mật: `curl -I https://<domain>/` có `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`.

## 6. Sau ra mắt (chưa làm)

- Theo dõi lỗi (Sentry hoặc tương đương) và analytics sự kiện chính.
- Nút "Báo sai" cho nội dung AI.
- Nâng key GIPHY lên Production khi lượng dùng tăng.
- PWA cơ bản và E2E Playwright trên CI.

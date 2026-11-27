# Phase 08: Khoá học IELTS

Context: [plan.md](plan.md) · [Brief Khoá học](../reports/from-claude-to-omp-261127-1449-ielts-course-brief.md)

Khoá học thay chức năng Lộ trình cũ bên dưới. IELTS có 7 cấp, 42 phần, 210 bài, mỗi bài gồm nói trước, học từ, nói lại và hội thoại. Tiến độ lưu theo người; hoàn thành bài mới mở bài kế tiếp. Cấp đã chọn và mục tiêu IELTS/CEFR từ onboarding điều khiển Học tiếp.

Áp `20261127160000_courses.sql`, chạy seed có chủ nội dung trên DB thử và duyệt nội dung trước khi xuất bản thật. Migration giữ bộ từ và thẻ của lộ trình cũ, chỉ gỡ metadata và liên kết.

## Lịch sử: Lộ trình học (đã thay thế)

## Requirements

- Lộ trình = danh sách bộ từ có thứ tự + mô tả + tag (IELTS, TOEIC, THPT, For Work, CEFR A1–C2).
- Trang khám phá: lộ trình gợi ý theo mục tiêu/trình độ từ onboarding.
- Tiến độ lộ trình (% từ đã thuộc), "Học tiếp" mở đúng bộ kế tiếp; ôn SRS theo cả lộ trình.
- Người dùng tự tạo lộ trình từ các bộ của mình/bộ public.
- **AI lộ trình cá nhân hoá**: nhập mục tiêu + thời gian + trình độ → AI đề xuất cấu trúc (chủ đề từng bộ) → sinh bộ từ qua pipeline phase 05.
- Nội dung có sẵn - **cấu trúc giống OpenQuiz, nội dung tự sinh**:

| Tag | Lộ trình (dự kiến) |
|---|---|
| IELTS | Vocabulary for IELTS - 20 bộ theo chủ đề (Gia đình, Tính cách, Giao tiếp, Du lịch, Công nghệ, Môi trường, Kinh tế, Sức khỏe…) ~50–60 từ/bộ; IELTS Collocations; Linking words cho Speaking/Writing; IELTS Speaking Boost (band 6→7) |
| TOEIC | TOEIC Essential Vocabulary - bộ theo chủ đề công sở (hợp đồng, marketing, tuyển dụng, du lịch công tác…) |
| THPT | Tiếng Anh 10, 11, 12 theo chủ đề từng unit; từ vựng hay gặp trong đề thi THPT |
| CEFR / Nền tảng | A1–A2, B1–B2, C1–C2 Everyday English (20 bộ mỗi cấp); Word Form Mastery; Chunking giao tiếp |
| For Work | Business, Technology, Technical Work, Medical English cơ bản (10 bộ mỗi lộ trình) |

  Danh sách từ do DeepSeek sinh theo chủ đề + CEFR, rồi chạy qua pipeline phase 05 (IPA, nghĩa Việt, ví dụ, đồng nghĩa). **Không scrape/sao chép** bộ từ của OpenQuiz hay danh sách từ của sách có bản quyền (vd "600 Essential Words for the TOEIC").

## Files tạo

- `20261127124000_learning_paths.sql`: `learning_paths`, `path_items`, RLS, RPC `path_progress` và các RPC ghi nguyên tử.
- `app/(app)/paths/{page,[id]/page,new/page,ai/page}.tsx`
- `lib/ai/generate-path.ts`
- `scripts/seed-paths.ts` - nhập word list → sinh nghĩa/ví dụ → tạo bộ + lộ trình

## Steps

1. Schema + RLS (lộ trình public đọc tự do).
2. UI khám phá + chi tiết + tiến độ.
3. Seed nội dung: `scripts/seed-paths.ts` đọc file cấu hình `content/paths.yaml` (lộ trình → bộ → chủ đề, CEFR, số từ) → DeepSeek sinh danh sách từ → khử trùng lặp trong cùng lộ trình → enrich → ghi DB. Chạy lại được (idempotent theo slug). Duyệt nhanh bằng tay trước khi public.
4. AI path generator, sinh bộ từ theo batch (job nền đơn giản: trạng thái `generating` + poll).

## Validation

- [x] Test thuần: IELTS/B1 được ưu tiên; tiến độ tính theo số thẻ; bỏ bộ trống và khử trùng chuẩn hóa giữa các bộ; kiểm schema YAML và trùng slug.
- [x] PostgreSQL tạm: đọc công khai, ẩn lộ trình riêng, tiến độ riêng từng người, ghi lộ trình AI nguyên tử và seed RPC idempotent theo slug.
- [x] DeepSeek thật: đề xuất 6 chủ đề IELTS Speaking B1 cho 2 tuần; thử sinh riêng 2 bộ có 30 và 28 thẻ đủ IPA, nghĩa Việt và ví dụ, không trùng. Không ghi Supabase.
- [x] `pnpm test && pnpm typecheck && pnpm lint`: 65 test, 0 lỗi lint, 5 cảnh báo vendor có sẵn. Dev: trang chuyển đăng nhập, API trả 401. Chromium với fixture tạm: thêm bộ, đổi thứ tự, lọc bộ riêng tư khi chuyển công khai và hiển thị lỗi API khi chưa đăng nhập.
- [ ] Áp migration, seed riêng tư, duyệt nội dung và công khai; kiểm gợi ý với profile thực, poll AI và tiến độ sau phiên ôn có đăng nhập.

## Risks

- AI có thể sinh từ lệch CEFR/chủ đề: duyệt trước khi công khai. Chưa có nơi nhận báo lỗi nội dung.
- Sinh lộ trình lớn tốn quota → giới hạn ≤ 10 bộ × 30 từ mỗi lần.

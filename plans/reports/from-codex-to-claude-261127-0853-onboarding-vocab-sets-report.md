# Báo cáo bàn giao: onboarding và bộ từ

## File đã đổi

- Onboarding và CI: `src/app/(app)/onboarding/`, `src/app/(app)/home/page.tsx`, `src/lib/supabase/proxy.ts`, `src/components/layout/nav-items.ts`, `.github/workflows/ci.yml`.
- Bộ từ, thẻ và flashcard: `src/app/(app)/sets/`, `src/app/shared/[id]/page.tsx`, `src/lib/vocab/card-schema.ts`, `src/lib/vocab/parse-bulk-cards.ts` và test parser.
- Tra từ: `src/app/api/lookup/route.ts`, `src/app/(app)/lookup/`, `src/lib/vocab/lookup-dictionary.ts`, `src/lib/vocab/lookup-term.ts`.
- Tài liệu: `README.md`, `docs/code-standards.md`, `plans/261126-2202-english-learning-web-mvp/plan.md`, `phase-01-foundation.md`, `phase-02-vocabulary-flashcards.md`.

## Cách đã kiểm tra

- `pnpm test`: 3 file, 14 test qua.
- `pnpm typecheck`: qua.
- `pnpm lint`: 0 error, 5 warning trong component UI có sẵn.
- HTTP không đăng nhập: `/sets` chuyển tới login; API tra từ trả 401.
- Chưa kiểm thử luồng đăng nhập và ghi dữ liệu trực tiếp với tài khoản thật.

## Việc còn lại

- Hook riêng tư đang chặn phần code đọc biến môi trường bí mật để bổ sung nghĩa Việt bằng AI và ghi cache. Đã gửi yêu cầu chấp thuận; chưa có câu trả lời.
- Cập nhật mẫu biến môi trường và README cho khóa cache sau khi được chấp thuận.
- Phase 02 về sau: Azure TTS và lưu audio, ảnh/GIF và upload, thư mục, trang tiến độ, lọc flashcard theo trạng thái.

## Câu hỏi mở

- Có chấp thuận phần code dùng khóa máy chủ cho AI và cache không?
- Google OAuth và các luồng tích hợp cần xác minh với tài khoản thật.

Status: BLOCKED
Summary: Đã triển khai onboarding, CI, CRUD bộ từ/thẻ, flashcard và tra từ cơ bản; chờ chấp thuận hook để hoàn tất AI và cache.

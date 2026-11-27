# Phase 11: Landing/SEO, hardening, ra mắt

Context: [plan.md](plan.md) · Research mục 5.2, 8.6, 9, 12

## Tiến độ

- [x] Security headers, `robots.txt`, `sitemap.xml` (bộ từ công khai), metadata + Open Graph cho bộ từ chia sẻ (bộ "có link" đặt noindex).
- [x] Trang Chính sách bảo mật và Điều khoản (công khai), link ở footer landing và trang Tài khoản.
- [x] Trang Tài khoản + tự xoá tài khoản (xoá ảnh tải lên, xoá user, cascade dữ liệu); chặn xoá tài khoản sở hữu nội dung khoá học.
- [x] `pnpm build` production thành công; rà soát không có secret trong code client.
- [x] Hướng dẫn deploy: [docs/deployment.md](../../docs/deployment.md).
- [ ] Deploy Vercel (cần tài khoản của user), cấu hình Supabase URL, domain.
- [ ] Sentry/analytics, nút "Báo sai", PWA, E2E trên CI, Lighthouse.

## Requirements

- Landing (SSG): giới thiệu, demo flashcard/speaking, FAQ; trang bộ từ public render SSR có metadata (SEO + chia sẻ).
- Sitemap, robots, OG image động cho bộ từ/lộ trình public.
- PWA cơ bản (cài lên màn hình chính, offline xem thẻ đã tải).
- Privacy policy + Terms: dữ liệu giọng nói, ảnh, AI bên thứ ba, xoá tài khoản.
- Xoá tài khoản tự phục vụ (xoá dữ liệu + audio).
- Báo lỗi nội dung AI (nút "Báo sai" trên thẻ, câu hỏi, feedback).
- Quan sát: log lỗi (Sentry hoặc tương đương), dashboard chi phí AI từ `ai_usage`, analytics sự kiện chính (activation, review hoàn thành, speaking hoàn thành).
- Rate limit theo IP cho API công khai (`/api/lookup`).

## Steps

1. Landing + SEO + OG.
2. Policy pages + consent mic lần đầu.
3. Xoá tài khoản (RPC + xoá Storage).
4. Kiểm thử: E2E Playwright cho luồng chính (đăng nhập → tạo bộ → Learn → Review → Speaking).
5. Rà soát RLS + secret (không key nào ở client), đặt trần chi tiêu tại nhà cung cấp AI.
6. Deploy production Vercel + Supabase; backup DB.

## Validation

- E2E xanh trên CI.
- Lighthouse mobile ≥ 85 (landing, trang học).
- Không còn key AI trong bundle client (grep build output).
- KPI theo dõi được: DAU/MAU, activation, D1/D7, review completion, speaking completion, AI cost/session.

## Risks

- Chi phí AI tăng đột biến khi lên SEO → quota + trần chi tiêu + cảnh báo.

# Phase 01: Nền tảng

Context: [plan.md](plan.md) · Research mục 8.3 (DB), 8.6 (chi phí AI)

Status: in progress (27/11/2026). Nền tảng, onboarding và CI đã triển khai; xác minh Google OAuth và kiểm thử tích hợp còn mở.

## Requirements

- Repo Next.js (App Router, TS strict) + Tailwind + shadcn/ui, dark/light theme.
- Supabase: Auth Google (email magic link dự phòng), Postgres, Storage.
- Schema lõi + RLS + migrations bằng Supabase CLI.
- Layout: sidebar (Trang chủ, Bộ từ, Ôn tập, Lộ trình, Lớp học, Tra từ), responsive mobile.
- Hạ tầng AI dùng chung: client LLM, quota, log usage.

## Schema lõi (Postgres)

```text
profiles(id=auth.users.id, display_name, avatar_url, level, goal, created_at)
study_sets(id, owner_id, title, description, visibility[private|unlisted|public], tags[], cover_url, created_at, updated_at)
cards(id, set_id, position, term, part_of_speech, ipa, definition_vi, definition_en,
      example_en, example_vi, synonyms[], image_url, audio_url, created_at)
folders(id, owner_id, name) · folder_sets(folder_id, set_id)
review_states(user_id, card_id, fsrs_state jsonb, due_at, state, reps, lapses, last_review_at)  -- PK(user_id, card_id)
review_logs(id, user_id, card_id, rating, reviewed_at, elapsed_days, scheduled_days)
study_sessions(id, user_id, set_id, mode, started_at, finished_at, score, total)
study_attempts(id, session_id, card_id, question_type, correct, answer, created_at)
ai_usage(id, user_id, feature, units, cost_usd, created_at)
word_cache(term, data jsonb, updated_at)  -- từ điển, TTS, ví dụ dùng chung
```

Các bảng của phase sau (speaking, chat, learning_paths, classes…) thêm migration ở phase tương ứng.

Nguyên tắc: `cards` = kiến thức dùng chung; `review_states` = trạng thái từng người.

## Files tạo

- `app/(marketing)/page.tsx`, `app/(app)/layout.tsx`, `app/(app)/home/page.tsx`
- `app/auth/callback/route.ts`, `middleware.ts` (refresh session)
- `lib/supabase/{server,client,middleware}.ts`
- `lib/ai/client.ts` (AI SDK + `@ai-sdk/deepseek`, env `DEEPSEEK_API_KEY`, `AI_MODEL`), `lib/ai/quota.ts` (`assertQuota(userId, feature)`, `recordUsage`)
- `supabase/migrations/0001_core.sql`, `supabase/seed.sql`
- `.env.example` (không commit `.env*`)

## Steps

- [x] Tạo Next.js app, cài UI nền tảng, cấu hình ESLint và Vitest.
- [x] Tạo Supabase project, migration schema lõi và RLS.
- [ ] Xác minh Google provider đã bật trên Supabase và đăng nhập Google hoạt động thực tế.
- [x] Auth flow và onboarding: chọn hoặc bỏ qua mục tiêu, trình độ CEFR; lưu vào `profiles`.
- [x] Tạo AI client, quy tắc quota và log usage dùng chung.
- [ ] Xác minh phản hồi 429 thân thiện khi tính năng AI gọi `assertQuota`.
- [x] CI GitHub Actions chạy lint, typecheck và test.

## Validation

- [ ] Test RLS: user A không đọc được set private của user B.
- [ ] Test `assertQuota` chặn khi vượt hạn bằng luồng tích hợp.
- [ ] Xác minh đăng nhập/đăng xuất trên mobile.

## Risks

- RLS sai → lộ dữ liệu: viết test SQL ngay từ đầu.
- Free tier Supabase pause khi idle: chấp nhận ở giai đoạn dev.

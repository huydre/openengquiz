# Brief cho omp: phase 07 (Grammar, Reading, AI Call) rồi phase 08 (Lộ trình học)

Project: `/Users/hnam/orca/projects/openengquiz`. Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit**. Làm **lần lượt**: xong phase 07 (kiểm tra qua) rồi mới sang phase 08.

## Đọc trước

- `AGENTS.md`, `README.md`, `docs/code-standards.md` (Select Watermelon, `LogoLoader`, style edtech)
- `plans/261126-2202-english-learning-web-mvp/phase-07-ai-grammar-reading-call.md`, `phase-08-learning-paths.md` (yêu cầu chính)
- Dùng lại, không viết lại:
  - AI: `src/lib/ai/{client,quota,quota-rules}.ts` (`getModel`, `isAiConfigured`, `assertQuota`, `recordUsage`; feature `grammar`, `reading`, `conversation`, `generate-cards` đã có hạn mức), mẫu structured output `src/lib/vocab/enrich-vietnamese.ts`, pipeline sinh thẻ `src/lib/ai/generate-cards.ts`.
  - Giọng nói (phase 06 bạn đã làm): `src/components/audio/audio-recorder.tsx`, `src/app/api/speaking/assess/route.ts` (STT Groq / Web Speech), `src/lib/speech/play-tts.ts` (`playTts(text, { accent })`, Kokoro có cache).
  - SRS/tiến độ: `review_states` (trạng thái `new|learning|review|relearning`), `src/lib/srs/`, RPC trong `supabase/migrations/20261127095700_srs_study_atomic_rpcs.sql` (ghi dữ liệu học chỉ qua server + secret key).
  - Khung chế độ học `src/app/(app)/study/[setId]/`, trang bộ từ `src/app/(app)/sets/[id]/page.tsx`.

## Phase 07

Theo phase-07: Grammar (dịch Việt → Anh, chấm bằng LLM theo nghĩa, chấp nhận nhiều cách dịch; chế độ sửa câu sai; lưu câu sai để ôn), Reading (đoạn văn theo CEFR chứa 5 đến 10 từ của bộ, **kiểm tra bằng code** đủ từ mục tiêu, thiếu thì sinh lại 1 lần; tô sáng từ, bấm xem nghĩa; 3 đến 5 câu hỏi), AI Call (kịch bản: phỏng vấn, gọi món, du lịch...; turn-based nói → STT → LLM → `playTts`; có chế độ gõ chữ; hiện chữ trước, audio sau; giới hạn số lượt; nút kết thúc tạo tổng kết từ đã dùng/chưa dùng + lỗi hay gặp), trang `/history`. Migration theo phase-07; **không lưu audio** (`chat_messages` bỏ cột `audio_path`).

## Phase 08

Theo phase-08: schema `learning_paths`, `path_items` + tiến độ tính từ `review_states` (view hoặc query), RLS (lộ trình public đọc tự do, chỉ chủ sở hữu sửa); trang `/paths` (khám phá, gợi ý theo `profiles.goal`/`level`), `/paths/[id]` (tiến độ %, "Học tiếp" mở bộ kế tiếp, "Ôn cả lộ trình" dùng `/review` lọc theo các bộ của lộ trình), `/paths/new` (tự tạo từ bộ của mình/bộ public), `/paths/ai` (AI đề xuất cấu trúc ≤ 10 bộ × 30 từ rồi sinh bộ qua pipeline phase 05; trạng thái `generating` + poll). Trang chủ hiện lộ trình gợi ý.

Nội dung có sẵn: viết `content/paths.yaml` theo **cấu trúc** bảng trong phase-08 (IELTS 20 chủ đề, TOEIC, THPT 10/11/12, CEFR A1 đến C2, For Work) và `scripts/seed-paths.ts` (chạy bằng `pnpm seed:paths`, idempotent theo slug, khử trùng trong lộ trình, mặc định tạo lộ trình ở trạng thái chưa public để duyệt tay). **Chỉ viết script, không chạy** (cần `DEEPSEEK_API_KEY` + `SUPABASE_SECRET_KEY`, chưa có trong `.env.local`). Danh sách từ do LLM sinh theo chủ đề + CEFR; **không** chép danh sách từ của OpenQuiz hay sách có bản quyền. Bộ/lộ trình hệ thống cần chủ sở hữu: đề xuất cách (ví dụ một profile hệ thống tạo bằng secret key, hoặc cột `owner_id` null cho nội dung hệ thống) và ghi rõ trong báo cáo.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu.
- Chưa có `DEEPSEEK_API_KEY`: mọi trang AI hiện thông báo "AI chưa bật", API trả 503; **không giả lập dữ liệu AI**. Test dùng hàm thuần (kiểm tra đủ từ mục tiêu, tính tiến độ, khử trùng, parse yaml...).
- UI tiếng Việt, style sáng edtech; ô chọn dùng `@/components/ui/select`; trạng thái tải dùng `LogoLoader`; ưu tiên component Watermelon (`pnpm dlx shadcn@latest search @watermelon -q <từ khoá>`, khi cài từ chối ghi đè: `yes n |`).
- Next 16 Cache Components: dữ liệu theo request trong `<Suspense>`; `params`/`searchParams` là Promise; **không** export `runtime`/`dynamic`.
- Mọi lời gọi AI chỉ ở server; kiểm quota trước khi gọi. Không đọc/in giá trị secret.
- Migration: chỉ viết file (timestamp sau `20261127120100`), **không tự đẩy**; ghi tên vào báo cáo. Bật RLS mọi bảng mới.
- Thêm route mới vào `PROTECTED_PREFIXES` (`src/lib/supabase/proxy.ts`) và sidebar (`src/components/layout/nav-items.ts`, bỏ `comingSoon` của `/paths`).
- JSX dễ đọc, comment code tiếng Anh, file kebab-case. Không chạy `pnpm build`. Dev server cổng 3100 chạy trong tab Orca "dev 3100", đừng tắt.

## Hoàn thành khi

- Sau mỗi phase: `pnpm test && pnpm typecheck && pnpm lint` qua (0 error); log dev server không lỗi compile khi mở trang mới (chưa đăng nhập thì 307 sang login là đúng).
- Cập nhật status/checklist `phase-07-...md`, `phase-08-...md`, dòng Status `plan.md`, `README.md` (lệnh `pnpm seed:paths`, biến mới nếu có), `docs/code-standards.md` nếu thêm component Watermelon.
- **Chỉ ghi báo cáo khi xong cả hai phase, kể cả mọi agent con**: `plans/reports/from-omp-to-claude-261127-1228-grammar-reading-call-paths-report.md` (file đã đổi theo phase, migration cần đẩy, cách kiểm tra, việc còn lại, câu hỏi mở), kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

# Brief cho omp: Khoá học (thay Lộ trình), làm khoá IELTS 7 cấp trước

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit** (Claude review rồi commit).

**Model:** dùng `local/dev` cho mọi việc. Hạn chế agent con; nếu cần agent con thì phải chạy cùng `local/dev`, không dùng model khác.

## Quyết định của user (27/11/2026)

1. **Thay "Lộ trình" bằng "Khoá học"** làm cách học chính. Bỏ UI/route `/paths`, `/paths/new`, `/paths/ai`, API `/api/ai/paths`, catalog `content/paths.yaml`, `scripts/seed-paths.ts`, `src/lib/paths/*`, `src/components/paths/*`, mục sidebar "Lộ trình", lọc `?path=` ở `/review`. Migration mới drop `learning_paths`, `path_items` và các hàm liên quan (chưa có dữ liệu thật). Giữ lại mọi thứ khác.
2. **Làm khoá IELTS đủ 7 cấp trước**, khung phải dùng lại được cho TOEIC, Giao tiếp, THPT sau này.
3. User tham khảo trải nghiệm của OpenQuiz (ảnh mô tả bên dưới). **Chỉ học cấu trúc và trải nghiệm**, mọi tên bài, câu hỏi, từ vựng do mình tự soạn/sinh; không lấy nguyên tên bài hay nội dung của họ.

## Mô hình

- **Khoá học** theo mục tiêu (`ielts`, sau này `toeic`, `communication`, `thpt`, `work`).
- **Cấp độ** của khoá IELTS (7 cấp): Lấy gốc (~200 từ), Band 3–4 (~250), Band 4.5–5.5, Band 6, Band 7, Nâng cao 1, Nâng cao 2 (~300 mỗi cấp). Mỗi cấp có mô tả ngắn, **đầu vào**, **đầu ra**, **phương pháp**.
- Mỗi cấp: **6 phần × 5 bài = 30 bài**. Phần có số thứ tự + tên (ví dụ "Thế giới hằng ngày"), bài có tên dạng câu hỏi/chủ đề tiếng Anh ngắn, một icon, khoảng 8 đến 10 từ.
- **Mỗi bài theo chu trình 4 bước:** (1) **Nói trước**: một câu hỏi kiểu IELTS Speaking theo chủ đề bài, người học trả lời bằng giọng nói; (2) **Học từ mới**: dùng lại `VocabLesson` (`src/components/vocab/vocab-lesson.tsx`, thêm prop callback khi xong để nhúng vào bài, giữ hành vi cũ khi dùng độc lập); (3) **Nói lại**: cùng câu hỏi, khuyến khích dùng từ mới; AI so với lần đầu, đếm từ mới đã dùng, sửa ngữ pháp, gợi ý câu hay hơn; (4) **Hội thoại thực tế**: hội thoại AI ngắn (khoảng 4 đến 6 lượt) theo chủ đề bài, dùng lại logic AI Call (`src/lib/ai/conversation*.ts`, `src/app/api/conversation/*`, có chế độ gõ chữ). Xong 4 bước thì bài hoàn thành, bài kế tiếp mở khoá.

## Giao diện (style sáng edtech của app, không dùng nền tối như ảnh tham khảo)

- `/courses`: chọn khoá (hiện IELTS) → trang khoá.
- Trang khoá `/courses/[course]`: trên cùng là ô chọn khoá và ô chọn **cấp độ** (mở hộp thoại danh sách cấp: tên, "N từ · 6 phần · 30 bài · mô tả ngắn", dấu tích ở cấp đang chọn; lưu cấp đã chọn theo người dùng). Dưới đó: nút **Mục tiêu khoá học** (hộp thoại: tên cấp, số từ, số bài; Đầu vào, Đầu ra, Phương pháp; chân hộp: "6 phần · 30 bài học · N từ vựng").
- **Bản đồ bài học**: mỗi phần có tiêu đề "PART n" + tên phần; các bài là thẻ bo tròn có icon, xếp **zigzag** trái/phải, nối bằng đường nét đứt; trạng thái đã xong / đang học (nổi bật) / khoá. Nút **Sổ từ vựng** (danh sách từ đã học trong khoá, có nghe và điểm phát âm gần nhất nếu có).
- Trang bài `/courses/[course]/lessons/[lessonId]`: thanh 4 bước, làm từng bước, lưu tiến độ để quay lại học tiếp.
- Trang chủ: thẻ "Học tiếp" mở đúng bài đang dở của khoá hiện tại; onboarding mục tiêu `ielts` + CEFR → gợi ý cấp phù hợp.
- Sidebar: "Lộ trình" đổi thành "Khoá học" (`/courses`). Ưu tiên component Watermelon (`pnpm dlx shadcn@latest search @watermelon -q <từ khoá>`, ví dụ dialog/modal, progress; khi cài từ chối ghi đè: `yes n |`), ô chọn dùng `@/components/ui/select`, đang tải dùng `LogoLoader`, khung đóng/mở dùng `collapsible`, chọn số dùng `stepper`. Icon dùng lucide (không dùng ảnh ngoài).

## Dữ liệu

- Schema đề xuất (tự chỉnh nếu có lý do): `courses(slug, goal, title)`, `course_levels(course_id, slug, position, title, words_target, summary, entry, outcome, method)`, `course_parts(level_id, position, title)`, `course_lessons(part_id, position, title, icon, warmup_question, set_id → study_sets)`, `lesson_progress(user_id, lesson_id, step, warmup_transcript, completed_at)`, lựa chọn cấp của người dùng (`profiles` hoặc bảng riêng). RLS: nội dung khoá đọc được khi đã đăng nhập; tiến độ chỉ chủ sở hữu. Bộ từ của bài là `study_sets` thuộc tài khoản nội dung hệ thống, `visibility = 'public'`.
- **Nội dung khoá**: `content/courses/ielts.yaml` do bạn **tự soạn** (tên phần, tên bài, icon lucide, câu hỏi nói trước, chủ đề + gợi ý phạm vi từ cho mỗi bài, đầu vào/đầu ra/phương pháp mỗi cấp). Từ vựng mỗi bài **sinh bằng DeepSeek** theo chủ đề + cấp, khử trùng trong cả khoá, rồi qua pipeline phase 05 (IPA, nghĩa Việt, ví dụ, đồng nghĩa). Script `pnpm seed:courses` (idempotent theo slug, có cờ chỉ seed một cấp, dùng env `SEED_CONTENT_OWNER_ID` cho chủ nội dung). **Chỉ viết script, không chạy**; ghi ước lượng số lượt DeepSeek trong báo cáo.
- Ghi điểm phát âm/feedback của bước nói vào `speaking_attempts` như phase 06.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu.
- Next 16 Cache Components: dữ liệu theo request nằm trong `<Suspense>`; `params`/`searchParams` là Promise; **không** export `runtime`/`dynamic`. Proxy: mọi trang mặc định cần đăng nhập (`src/lib/auth/route-access.ts`), **không sửa proxy**.
- Mọi lời gọi AI/giọng nói chỉ ở server, kiểm quota trước. Không đọc/in giá trị secret.
- Migration: chỉ viết file (timestamp sau `20261127150000`), **không tự đẩy**; ghi tên vào báo cáo. RLS mọi bảng mới.
- JSX dễ đọc, comment tiếng Anh, file kebab-case. Không chạy `pnpm build`. Dev server cổng 3100 trong tab Orca "dev 3100", đừng tắt.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error); có test cho phần thuần (đọc/kiểm yaml khoá, tính mở khoá bài, tiến độ cấp, khử trùng từ).
- Smoke: các trang mới trả 307 khi chưa đăng nhập, API trả 401; log dev server không lỗi compile. Nếu được, dựng trang preview tạm để chụp bản đồ bài học và hộp thoại cấp độ/mục tiêu, **xoá trang tạm sau khi chụp**.
- Cập nhật `plan.md` (thay phase 08 bằng Khoá học), `phase-08-learning-paths.md` (ghi đã thay), `README.md` (`pnpm seed:courses`, env), `docs/code-standards.md` nếu thêm component.
- **Chỉ ghi báo cáo khi xong toàn bộ, kể cả agent con**: `plans/reports/from-omp-to-claude-261127-1449-ielts-course-report.md` (file đổi, migration cần đẩy, ảnh chụp, ước lượng DeepSeek, việc còn lại, câu hỏi mở), kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

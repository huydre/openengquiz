# Brief cho omp: bài học v2, trải nghiệm giống sản phẩm tham khảo (7 hoạt động xen kẽ)

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit**. Model `local/dev` cho mọi việc, kể cả agent con.

## Mục tiêu (user yêu cầu)

"Phần học y hệt" sản phẩm tham khảo. Claude đã học thử và ghi **đặc tả đầy đủ ở `docs/openquiz-ux-review.md` mục 6** (đọc kỹ, làm đúng từng dạng bài, phím tắt, trạng thái). Giống về **luồng, cấu trúc, tương tác và cảm giác**; **không** dùng linh vật, hình, tên bài, câu chữ hay từ vựng của họ. Giữ style sáng của app, gia sư của app (`src/components/tutor/`).

## Phân chia file (quan trọng)

Một phiên omp khác **đang làm AI Call** (`src/app/(app)/study/[setId]/call/call-session.tsx`, `src/app/api/conversation/**`, `src/lib/ai/conversation*.ts`, `src/components/tutor/tutor-avatar.tsx`, `src/components/audio/audio-recorder.tsx`). **Không sửa các file đó.** Hoạt động 7 (Hội thoại) chỉ nhúng `CallSession` qua props hiện có (`onComplete`, kịch bản theo bài). Nếu cần prop mới cho CallSession thì ghi vào báo cáo, không tự sửa.

Bạn sở hữu: `src/components/courses/**` (trừ những gì phiên kia tạo), `src/app/(app)/courses/**`, `src/app/api/courses/**`, `src/lib/courses/**`, `content/courses/**`, `scripts/seed-courses.ts`, migration mới, `src/components/vocab/**`.

## Việc cần làm

1. **Dữ liệu**: migration mới (timestamp sau `20261127170100`) cho mô hình 7 hoạt động: mỗi bài có 4 câu hỏi nói (hoạt động 1, 3, 4, 6; nhãn kiểu "IELTS Part 1/3"; bản dịch Việt), 2 nhóm từ (A, B) mỗi nhóm 4 thẻ từ + 1 điểm ngữ pháp (tên cấu trúc, giải thích tiếng Việt, ví dụ + dịch), kịch bản hội thoại; tiến độ theo **từng hoạt động** (đã xong, bước nhỏ hiện tại) và lượt nói gắn với hoạt động. Ghi tiến độ chỉ qua server (giữ mô hình RPC service role như `advance_course_lesson`). RLS mọi bảng mới. **Chỉ viết file, không tự đẩy**; Claude đẩy.
2. **Nội dung**: cấp `foundations` đã seed (30 bài, 8 thẻ/bài). Chia 8 thẻ hiện có thành nhóm A (4 đầu) và B (4 sau). Viết script **bổ sung** (idempotent) sinh bằng LLM: 2 điểm ngữ pháp/bài phù hợp từ của nhóm và CEFR, 3 câu hỏi nói thêm, bản dịch Việt, kịch bản hội thoại. Dùng endpoint seed `SEED_AI_BASE_URL/SEED_AI_API_KEY/SEED_AI_MODEL` (đã có trong `.env.local`, không in giá trị). Chạy cho `foundations` sau khi Claude đẩy migration (ghi lệnh vào báo cáo; nếu migration chưa có trên DB thì dừng và báo). Cập nhật `content/courses/ielts.yaml` + `seed-courses.ts` để các cấp sau seed đúng mô hình mới.
3. **Giao diện** theo đặc tả mục 6:
   - Bấm bài trên bản đồ → hộp thoại danh sách 7 hoạt động (icon theo loại, dòng phụ, dấu tích + gạch ngang khi xong, bấm vào hoạt động bất kỳ) + **Tiếp tục**.
   - Khung hoạt động: thanh trên (←, tên bài, Phần/Bài, `n / 7`, tiến độ) + nhãn dạng bài + `k / N` + tiến độ hoạt động. Gia sư dẫn đầu mỗi hoạt động ("Học tiếp").
   - Hoạt động **Nói**: đúng mục 6 (ô nhập 1 dòng, không chặn: hiện câu trả lời + "Đang đánh giá..." + Tiếp tục bấm ngay; điểm band; câu band cao tô màu).
   - Hoạt động **Học từ vựng** 18 bước: Review Cards (thẻ + "Hãy nói từ sau" sau mỗi thẻ từ, thẻ ngữ pháp, Start Practice) → nhớ nghĩa đến khi thuộc ("n / 4 mastered", hàng đợi lặp, "Tôi trả lời đúng (Tab)") → xen kẽ Fill in the Blank và Speaking dùng từ (câu hỏi AI tạo theo từ, có trạng thái đang tạo, cache theo từ) → Listen & Speak (shadowing câu ví dụ ngữ pháp, chấm phát âm).
   - Hoạt động **Hội thoại**: nhúng `CallSession` (xem phần phân chia file).
   - Chấm "gõ nghĩa tiếng Việt" và "điền từ": chuẩn hoá (bỏ dấu câu, hoa/thường, so gần đúng), nghĩa tiếng Việt chấp nhận một trong các nghĩa; có nút tự công nhận.
   - Hoàn thành hoạt động cập nhật bản đồ (vòng tiến độ quanh icon bài theo số hoạt động đã xong) và mở bài sau khi đủ 7.
4. Dùng lại: `FlipFlashcard`, `ReadWord`/chấm phát âm (`/api/speaking/assess`), `TutorNarration`, `playTts`/`prefetchTts`, `/api/speaking/transcribe`, `enrollLearnedCards`, `LogoLoader`, `@/components/ui/select`.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu.
- Next 16: request data trong `<Suspense>`, `params` là Promise, **không** export `runtime`/`dynamic`; không sửa proxy. AI/giọng nói chỉ ở server, kiểm quota. Không đọc/in secret.
- JSX dễ đọc, comment tiếng Anh, file kebab-case, ưu tiên Watermelon. Không `pnpm build`; dev server 3100 trong tab Orca "dev 3100", đừng tắt.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error); test phần thuần (hàng đợi thuộc nghĩa, chấm gần đúng, sinh câu điền từ, thứ tự 18 bước, mở khoá theo hoạt động).
- Ảnh từng màn (danh sách hoạt động, thẻ, nói từ, thuộc nghĩa đúng/sai, điền từ, nói dùng từ, shadowing, hoạt động Nói, bản đồ có vòng tiến độ) bằng trang preview tạm **dưới `/shared/tmp-...`**, xoá sau khi chụp; lưu ảnh vào `plans/reports/`.
- Cập nhật `docs/code-standards.md`, `plan.md`.
- **Chỉ ghi báo cáo khi xong toàn bộ, kể cả agent con**: `plans/reports/from-omp-to-claude-261127-1904-lesson-v2-report.md` (file đổi, migration cần đẩy, lệnh bổ sung nội dung, ảnh, việc còn lại), kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

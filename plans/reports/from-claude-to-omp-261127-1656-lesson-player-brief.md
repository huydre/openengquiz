# Brief cho omp: làm lại trải nghiệm bài học trong Khoá học (7 bước, có gia sư AI)

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit** (Claude review rồi commit). Model `local/dev` cho mọi việc, kể cả agent con.

## Bối cảnh

Khoá học IELTS đã có (bản đồ bài học, 7 cấp, cấp "Lấy gốc" đã seed). Trang bài `/courses/[course]/lessons/[lessonId]` hiện là 4 bước đơn giản (`src/components/courses/course-lesson.tsx`). User gửi ảnh trải nghiệm tham khảo và muốn bài học **chạy theo luồng dưới đây**. Chỉ lấy cấu trúc và trải nghiệm; **không** dùng linh vật, hình, tên hay câu chữ của sản phẩm tham khảo. Giữ style sáng edtech của app (không làm nền tối như ảnh tham khảo).

## Khung trang bài (mọi bước)

Thanh trên: nút quay lại bản đồ, tên bài, dòng phụ "Phần N • Bài M", nút **Lịch sử** (các lượt nói của bài này, dùng `speaking_attempts.lesson_id`), bộ đếm bước `n / 7`, thanh tiến độ. Lưu bước hiện tại để quay lại học tiếp (giữ cơ chế `advance_course_lesson` server-only hiện có; mở rộng số bước nếu cần qua migration mới, không sửa migration cũ).

## 7 bước

1. **Gia sư mở đầu.** Thành phần `TutorNarration` dùng lại được: nhân vật gia sư **của riêng app** (dựng từ ô logo của app + mặt biểu cảm đơn giản bằng SVG/CSS, không dùng ảnh ngoài), đặt trong vòng sáng nhiều lớp chuyển động mềm, **dao động mạnh hơn khi đang phát tiếng**; tôn trọng `prefers-reduced-motion`. Đọc lần lượt các câu dẫn bằng `playTts` (Kokoro). Thẻ phụ đề bên dưới: câu tiếng Anh + bản dịch tiếng Việt, chấm tròn chỉ câu đang đọc, nút tốc độ (0.75x / 0.9x / 1x), **Ẩn bản dịch**, **Nghe lại**; chạm vào gia sư để tạm dừng/tiếp; nút **Bỏ qua**. Hết câu thì sang bước sau. Lời dẫn: chào, giới thiệu chủ đề bài, nói người học sẽ trả lời câu hỏi trước rồi học từ để nói hay hơn.
2. **Nói trước.** Thẻ câu hỏi lớn (câu `warmup_question` của bài). **Bấm vào từng từ** để xem nghĩa nhanh (popover, dùng `/api/lookup`); công tắc hiện bản dịch cả câu; nút nghe câu hỏi. Nút **"Bí ý tưởng?"** gọi AI gợi ý 2 đến 3 ý ngắn (tiếng Việt + cụm tiếng Anh). Hai cách trả lời: **Bắt đầu nói** (ghi âm WAV như phase 06, STT Groq/Web Speech, có dòng "Đang nói: English") hoặc **Nhập** (gõ chữ).
3. **Nhận xét lần 1.** Khung "Câu trả lời của bạn" + nhãn hoàn thành; hàng điểm CEFR: tổng + Ngữ pháp, Từ vựng, Mạch lạc; khung **Gợi ý** của gia sư có chọn **giọng góp ý** (ví dụ Nghiêm túc, Thân thiện, Hài hước; nhớ lựa chọn theo người dùng) và nhận xét bằng tiếng Việt; khung **Câu trả lời điểm cao**: câu mẫu ở trình độ cao hơn một bậc, **tô sáng** cụm từ hay và từ vựng của bài, nút nghe và dịch. Nút **Thử lại** / **Tiếp tục**. Dùng LLM (structured output, schema Zod, kiểm quota), lưu vào `speaking_attempts` (kèm điểm phát âm nếu trả lời bằng giọng nói).
4. **Gia sư chuyển đoạn.** `TutorNarration` với 1 đến 2 câu: giờ học thêm từ để câu trả lời hay hơn.
5. **Thẻ từ.** Nhãn "Review Cards" + bộ đếm "1 / N", thẻ lật: mặt trước từ, loại từ, IPA, nút nghe; mặt sau nghĩa Việt, ví dụ + dịch, đồng nghĩa; nút Trước / Tiếp, chấm trang, phím tắt `←` `→` chuyển thẻ, `Space`/`Enter` lật. Có thể dùng lại/tách từ `VocabLesson` và `flashcard-viewer`.
6. **Đọc từng từ.** "Hãy nói từ sau": từ, IPA, nghĩa. Ghi âm → chấm (`/api/speaking/assess` scripted). Khung kết quả màu theo đạt/chưa (ngưỡng hiện có 70%): % tổng, nút **Bạn nói** (phát lại bản ghi của chính người học, chỉ trong trình duyệt), **AI phát âm** (`playTts`), 3 thanh Độ chính xác / Độ lưu loát / Độ hoàn thiện, "Phân tích từng từ" (chip từ + điểm, bấm xem âm vị và gợi ý tiếng Việt từ `pronunciation-hints`). Nút **Thử lại** (phím `Tab`) và **Tiếp tục** (chỉ bật khi đạt, hoặc cho bỏ qua sau 3 lần chưa đạt). Lặp cho mọi từ của bài; xong thì đưa các từ vào ôn tập (`enrollLearnedCards`).
7. **Nói lại + hội thoại.** Gia sư dẫn 1 câu, hỏi lại câu của bước 2; nhận xét như bước 3 nhưng **so với lần 1** (điểm tăng/giảm, đếm từ mới đã dùng). Sau đó hội thoại ngắn 4 đến 6 lượt theo chủ đề bài (dùng lại logic AI Call hiện có, có chế độ gõ). Kết thúc: màn tổng kết bài (điểm lần 1 so với lần 2, số từ đã học, từ cần luyện thêm), nút về bản đồ / bài tiếp theo.

## Kỹ thuật

- `playTts` cần thêm **tốc độ**: truyền `speed` tới `/api/tts` và dịch vụ giọng nói (đã hỗ trợ `speed` 0.5 đến 1.5); khoá cache audio phải gồm cả tốc độ. Không phá hành vi hiện có.
- Lời dẫn của gia sư: sinh bằng LLM theo bài (tiếng Anh ngắn + bản dịch Việt), **cache vào DB** theo bài để dùng lại; khi AI chưa bật thì dùng lời dẫn mẫu cố định trong code.
- Mọi lời gọi AI/giọng nói chỉ ở server, kiểm quota trước. Không đọc/in giá trị secret. Không lưu audio người dùng lên server.
- Next 16 Cache Components: dữ liệu theo request trong `<Suspense>`; `params` là Promise; **không** export `runtime`/`dynamic`. Proxy: trang mặc định cần đăng nhập, **không sửa proxy**.
- Component: ưu tiên Watermelon (`pnpm dlx shadcn@latest search @watermelon -q <từ khoá>`; khi cài từ chối ghi đè `yes n |`), ô chọn `@/components/ui/select`, đang tải `LogoLoader`, nút có sẵn `Button`. Icon lucide.
- Migration (nếu cần): chỉ viết file, timestamp sau `20261127160000`, RLS mọi bảng mới; **không tự đẩy**.
- **Không dùng em dash "—" và " – "** ở bất cứ đâu. JSX dễ đọc, comment tiếng Anh, file kebab-case. Không chạy `pnpm build`. Dev server cổng 3100 trong tab Orca "dev 3100", đừng tắt.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error); test cho phần thuần (điều hướng bước, so sánh lần 1/lần 2, khoá cache TTS có tốc độ, tách từ để bấm tra nghĩa).
- Chụp ảnh từng bước bằng trang preview tạm **đặt dưới `/shared/tmp-...`** (đường dẫn công khai; trang khác sẽ bị chuyển về login), dùng dữ liệu bài thật của cấp `foundations` nếu đọc được, **xoá trang tạm sau khi chụp**. Lưu ảnh vào `plans/reports/`.
- Cập nhật `docs/code-standards.md` (thành phần `TutorNarration`, quy ước bài học 7 bước), `plan.md`.
- **Chỉ ghi báo cáo khi xong toàn bộ, kể cả agent con**: `plans/reports/from-omp-to-claude-261127-1656-lesson-player-report.md` (file đổi, migration cần đẩy, ảnh, việc còn lại, câu hỏi mở), kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

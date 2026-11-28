# Brief cho omp: chấm nghĩa tiếng Việt ở bước Meaning Recall linh hoạt hơn, chi phí thấp

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit, không push**. Model `local/dev`. Không sửa UI (Claude nối UI).

## Vấn đề

Bước Meaning Recall (bài học khoá học, `src/components/courses/course-v2-vocabulary.tsx` dòng ~772) chấm bằng `matchVietnameseMeaning` (`src/lib/courses/lesson-activities.ts`), chỉ đúng khi câu gõ gần như trùng một vế của `definition_vi`. Nhưng `definition_vi` là câu giải thích dài (trung vị 35 ký tự, p90 62), ví dụ `handoff` = "Việc bàn giao công việc hoặc trách nhiệm cho người khác." Người học gõ "bàn giao" hay "sự bàn giao" (đúng) bị chấm sai.

## Yêu cầu: chấm 2 tầng

**Tầng 1, cục bộ, miễn phí (xử lý phần lớn trường hợp):** mở rộng `matchVietnameseMeaning` (giữ chữ ký hàm, chỉ thêm) để chấp nhận:
- Câu trả lời là cụm từ cốt lõi nằm trong định nghĩa: bỏ từ đệm/hư từ đầu câu và trong câu (ví dụ "việc", "sự", "cái", "người", "một", "các", "những", "hoặc", "và", "cho", "của", "để", "là", "được", "khác"...), so theo âm tiết. Chấp nhận khi các âm tiết nội dung của câu trả lời xuất hiện **liền mạch** (cụm liên tiếp) trong định nghĩa, và đó là cụm chính (gần đầu định nghĩa, hoặc ≥ 2 âm tiết nội dung). Phải từ chối trường hợp như gõ "công việc" hay "người khác" cho `handoff` (chỉ là từ phụ trong câu giải thích).
- Gõ thiếu dấu: so sánh thêm bản bỏ dấu, nhưng chỉ khi câu trả lời hoàn toàn không dấu.
- Giữ nguyên các chấp nhận hiện có (khớp vế, sai chính tả nhỏ, `definition_en`, `synonyms`).
- Trả kết quả 3 trạng thái qua hàm mới, ví dụ `gradeMeaningLocally(...) => "correct" | "wrong" | "unsure"`: `wrong` khi rõ ràng sai (rỗng, quá ngắn, không chung âm tiết nội dung nào), `unsure` khi có chung một phần nhưng chưa đủ để chấp nhận, hoặc khi câu trả lời là từ đồng nghĩa không có trong định nghĩa (không chung âm tiết, nhưng dài ≥ 2 âm tiết nội dung). Cân nhắc kỹ ngưỡng; viết test với ~20 ca thật lấy từ dữ liệu khoá học.

**Tầng 2, AI, chỉ khi tầng 1 trả `unsure`:** route `POST /api/courses/meaning-check` (đăng nhập bắt buộc, zod validate, câu trả lời tối đa 120 ký tự):
- Input: `{ cardId }` + `answer`. Server tự đọc `term`, `part_of_speech`, `definition_vi`, `definition_en` từ DB theo `cardId` (không tin định nghĩa client gửi), chạy lại tầng 1; chỉ gọi AI khi vẫn `unsure`.
- Dùng `withFastModel` (`src/lib/ai/client.ts`) với feature mới, prompt ngắn (dưới ~150 token), output có cấu trúc `{ correct: boolean }`, `temperature 0`, `maxOutputTokens` nhỏ. Tiêu chí: chấp nhận nếu câu trả lời diễn đạt đúng nghĩa cốt lõi của từ trong ngữ cảnh này, kể cả đồng nghĩa hay ngắn gọn; từ chối nếu chỉ là từ liên quan hoặc nghĩa khác.
- Quota: thêm vào `AI_DAILY_LIMITS` (`src/lib/ai/quota-rules.ts`) mức hợp lý (ví dụ 200/ngày). Gắn feature cho token tracking như các call site khác.
- Cache: bảng nhỏ `meaning_check_cache(card_id, answer_norm, correct, created_at)`, khoá chính `(card_id, answer_norm)`, chỉ service role ghi/đọc (RLS bật, không policy cho người dùng). Tra cache trước khi gọi AI; các người học khác gõ cùng đáp án sẽ không tốn thêm. Migration mới sau `20261128040000`, đẩy bằng lệnh trong brief trước (nạp `.env.local`, không in bí mật), kiểm tra `migration list` chỉ có migration của bạn chờ.
- Khi AI lỗi, hết quota hoặc chưa cấu hình: trả `{ correct: false, reason: "unavailable" }` (UI vẫn có nút "Tôi trả lời đúng" để tự sửa). Không bao giờ trả 500 cho lỗi AI.
- Response: `{ correct: boolean, source: "local" | "cache" | "ai" | "unavailable" }`.

## Kiểm tra

- Test thuần cho tầng 1 (ca đúng, ca từ phụ bị từ chối, ca không dấu, ca `unsure`). Test route với AI giả lập nếu repo đã có mẫu; nếu không, smoke tay route bằng dev server cổng 3100 (đừng tắt nó).
- Ước lượng chi phí: số token mỗi lần gọi AI đo thực tế qua `ai_token_usage`, ghi vào báo cáo.
- `pnpm test && pnpm typecheck && pnpm lint` xanh.

## Ràng buộc

- Không em dash "—" hay " – ".
- Không đụng phiên omp đang seed IELTS, không sửa file UI.
- Liệt kê **đủ mọi file đã sửa/thêm** trong báo cáo (Claude commit theo danh sách đó).

## Hoàn thành khi

Báo cáo `plans/reports/from-omp-to-claude-261128-0915-meaning-recall-grading-report.md`: file đã đổi, hợp đồng hàm/route cho UI, migration đã đẩy, test, số token mỗi lần AI chấm, kết thúc bằng `Status:` / `Summary:`. Rồi nhắn Claude:

`orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-0915-meaning-recall-grading-report.md, Status: <status>" --enter --json` (handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

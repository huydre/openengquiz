# Brief cho omp: sửa nhãn Part và hội thoại kịch bản trong khoá IELTS

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit, không push**. Model `local/dev` (gateway seed như các lần seed trước). Không sửa UI. Chủ dự án đã duyệt cả hai việc dưới đây.

Bối cảnh: báo cáo của bạn `plans/reports/from-omp-to-claude-261127-2225-seed-ielts-levels-report.md`. UI hiển thị nhãn `question.part === 1 ? "IELTS Part 1" : "IELTS Part 3"` (`src/components/courses/course-v2-speaking.tsx`), nên nhãn sai là lỗi người học nhìn thấy.

## Việc 1: gắn lại nhãn `speaking[].part` theo nội dung câu hỏi

- Phạm vi: cả 210 bài (không chỉ 81 bài lệch mẫu), để mọi nhãn nhất quán.
- Tiêu chí: **Part 1** = câu hỏi về bản thân, thói quen, trải nghiệm cá nhân ("When do you...", "Have you ever...", "Would you rather..."). **Part 3** = câu bàn rộng, trừu tượng, xã hội, so sánh, đánh giá chính sách ("Why do people...", "How should governments...", "What makes..."). Câu đề bài mở đầu (câu 1, khớp catalog) phân theo đúng tiêu chí, không mặc định.
- Cách làm: phân loại bằng model theo lô nhỏ, output JSON có cấu trúc, `temperature 0`; quy tắc rõ ràng (ví dụ có "you/your" về trải nghiệm riêng) có thể chấm cục bộ trước để bớt gọi model. Ghi lại vào `activity_content` qua service role, **chỉ đổi trường `part`**, không đụng nội dung khác.
- Chạy thử 5 bài, in so sánh trước/sau, tự duyệt rồi mới chạy toàn bộ. Có chế độ dry-run.
- Báo cáo: số câu đổi nhãn theo cấp, 10 ví dụ đổi nhãn để Claude duyệt.

## Việc 2: viết lại 7 hội thoại dạng kịch bản ở `foundations`

- Bài: `A new classmate`, `Inside my bag`, `Buying fruit`, `A smaller size`, `On the way to school`, `Rainy afternoon`, `Inviting a friend`.
- Đọc định dạng hội thoại đúng của các bài khác cùng cấp (tình huống hội thoại, không phải kịch bản gắn nhãn người nói) và sinh lại riêng trường đó cho 7 bài, trình độ A1, dùng từ của chính bài. Không sinh lại thẻ, câu Nói hay ngữ pháp.
- Kiểm tra bằng bộ chặn thoại đã có trong script seed. Báo cáo dán nội dung mới của cả 7 bài để Claude duyệt.

## Ràng buộc

- Không em dash "—" hay " – " trong nội dung hay code.
- Script tạm nếu cần đặt trong `scripts/` với tên mô tả; ghi rõ trong báo cáo có nên giữ không. Không đụng file của phiên omp nhập file (`src/lib/vocab/*`, `card-actions.ts`, `next.config.ts`, `package.json`).
- Không in khoá bí mật. `pnpm test && pnpm typecheck && pnpm lint` xanh nếu có sửa code.

## Hoàn thành khi

Báo cáo `plans/reports/from-omp-to-claude-261128-1105-ielts-content-fixes-report.md` (file đã đổi, số liệu, ví dụ, `Status:` / `Summary:`), rồi nhắn Claude:

`orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-1105-ielts-content-fixes-report.md, Status: <status>" --enter --json` (handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

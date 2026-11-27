# Brief cho omp: seed 6 cấp IELTS còn lại

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit**. Model `local/dev` cho mọi việc, kể cả agent con. Không sửa UI (Claude làm UI); được sửa script seed nếu cần.

## Việc cần làm

Database hiện chỉ có cấp `foundations` (30 bài, nội dung v2 đầy đủ). Seed lần lượt 6 cấp còn lại trong `content/courses/ielts.yaml`: `band-3-4`, `band-45-55`, `band-6`, `band-7`, `advanced-1`, `advanced-2`.

1. Mỗi cấp: `pnpm seed:courses --level <slug>`. Script dùng endpoint seed `SEED_AI_BASE_URL/SEED_AI_API_KEY/SEED_AI_MODEL`, chủ sở hữu `SEED_CONTENT_OWNER_ID` (đều có trong `.env.local`, **không in giá trị**). Script sinh 8 thẻ/bài (không trùng từ với cấp trước) và `activity_content` v2 (qua `scripts/seed-activity-content.ts`, đã có kiểm tra chất lượng và thử lại tối đa 3 lần).
2. Nếu một bài trượt kiểm tra hoặc lỗi mạng: chạy lại lệnh hoặc `pnpm seed:lesson-activities --level <slug>` (chỉ điền bài còn thiếu `activity_content`). Không ghi đè bài đã có.
3. Sau mỗi cấp, **tự kiểm chất lượng** bằng truy vấn đọc (service role, không in secret), báo trong báo cáo:
   - đủ 30 bài, mỗi bài đủ 8 thẻ có `ipa`, `definition_vi`, `example_en`, `example_vi`;
   - từ vựng đúng độ khó của cấp (CEFR trong yaml), không trùng với các cấp trước;
   - 4 câu hỏi nói khác nhau, câu 2 và 4 dùng được từ nhóm A, B; 2 điểm ngữ pháp hợp cấp; `conversation` là tình huống (không phải kịch bản "A:/B:");
   - không có em dash "—" hay " – " trong mọi chuỗi; tiếng Việt tự nhiên.
   Lấy mẫu ít nhất 3 bài/cấp in ra báo cáo (tên bài, 8 từ, 4 câu hỏi, 2 ngữ pháp). Bài kém thì đặt `activity_content = null` cho bài đó và seed lại.
4. Nếu script lỗi do code (không phải mạng), sửa script tối thiểu, chạy `pnpm test && pnpm typecheck && pnpm lint`, ghi rõ trong báo cáo.

## Ràng buộc

- Không dùng nội dung, tên bài hay danh sách từ của OpenQuiz.
- Không dùng em dash "—" và " – " ở bất cứ đâu.
- Không đụng migration đã đẩy; không tắt dev server cổng 3100.
- Seed chậm (khoảng 5 phút/bài với model dev): chạy nền, theo dõi log, đừng bỏ dở giữa chừng.

## Hoàn thành khi

- 7 cấp đều có 30 bài với nội dung v2 đầy đủ (hoặc ghi rõ bài nào còn thiếu và vì sao).
- Báo cáo `plans/reports/from-omp-to-claude-261127-2225-seed-ielts-levels-report.md`: số bài/cấp, mẫu nội dung, các lần thử lại, vấn đề chất lượng, kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

- **Khi xong toàn bộ**, nhắn Claude bằng orca-cli: `orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261127-2225-seed-ielts-levels-report.md, Status: <status>" --enter --json` (nếu handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

# Brief cho omp: tham khảo cấu trúc lộ trình của OpenQuiz

Project: `/Users/hnam/orca/projects/openengquiz`. Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit**.

## Mục tiêu

User muốn lộ trình có sẵn của app **tham khảo** cách OpenQuiz (https://openquiz.ai/) tổ chức lộ trình tiếng Anh, để `content/paths.yaml` sát với thực tế người học Việt Nam hơn. **Chỉ tham khảo cấu trúc, không sao chép nội dung.**

## Được lấy (cấu trúc, thông tin mô tả)

- Danh mục lộ trình tiếng Anh: nhóm (IELTS, TOEIC, THPT, CEFR, For Work...), tên lộ trình, trình độ/mục tiêu.
- Trong mỗi lộ trình: số bộ, **chủ đề** từng bộ (ví dụ "Gia đình", "Môi trường"), số từ mỗi bộ, thứ tự.
- Cách họ gợi ý lộ trình theo mục tiêu/trình độ, các tính năng ở trang lộ trình (tiến độ, học tiếp...).

## Không được lấy

- **Không** lưu vào repo danh sách từ, nghĩa, ví dụ, câu hỏi, đoạn văn hay bất kỳ nội dung thẻ nào của OpenQuiz. Không viết script crawl tự động.
- **Không** đặt tên lộ trình/bộ trùng nguyên văn tên thương mại của họ nếu đó là tên riêng; diễn đạt lại bằng lời của mình (tên chủ đề chung như "Gia đình", "Du lịch" thì được).
- Từ vựng thật của mỗi bộ vẫn do pipeline của mình sinh (`scripts/seed-paths.ts`, phase 05).

## Cách làm

1. Đọc `docs/openquiz-research.md` (mục 3.6 đã có tóm tắt) và `content/paths.yaml`, `scripts/seed-paths.ts`, `src/lib/paths/path-catalog.ts`.
2. Duyệt các trang lộ trình công khai trên openquiz.ai bằng trình duyệt (xem bằng tay từng trang, tốc độ như người dùng). Nếu phải đăng nhập mới xem được thì dừng phần đó và ghi vào báo cáo, không tự đăng nhập/tạo tài khoản.
3. Ghi kết quả tham khảo vào `docs/openquiz-paths-reference.md`: bảng nhóm → lộ trình → số bộ → chủ đề các bộ (đã diễn đạt lại) → số từ/bộ → trình độ; kèm nhận xét điều nên học hỏi cho app mình.
4. Cập nhật `content/paths.yaml` cho sát cấu trúc đó (số bộ, chủ đề, số từ, trình độ, thứ tự), giữ đúng schema mà `seed-paths.ts`/`path-catalog.ts` đang đọc; nếu đổi schema thì sửa code + test tương ứng.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu.
- **Không chạy** `pnpm seed:paths` (Claude sẽ chạy sau khi user duyệt).
- Không sửa code ngoài phạm vi trên. Dev server cổng 3100 chạy trong tab Orca "dev 3100", đừng tắt. Không chạy `pnpm build`.
- Ghi rõ nguồn (URL trang đã xem) trong file tham khảo.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error) nếu có đổi code.
- Báo cáo `plans/reports/from-omp-to-claude-261127-1412-openquiz-paths-reference-report.md`: đã xem những trang nào, phần nào không xem được, thay đổi trong `paths.yaml` (bao nhiêu lộ trình/bộ/từ, ước lượng số lần gọi DeepSeek khi seed), câu hỏi mở. Kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

# Bàn giao tham chiếu cấu trúc OpenQuiz

## Đã xem

- [Trang chủ](https://openquiz.ai/), [danh mục tổng EN](https://openquiz.ai/learning-paths/en), [danh mục tổng VI](https://openquiz.ai/learning-paths/vi) và [danh mục tiếng Anh cho người Việt](https://openquiz.ai/learning-paths/vi/en).
- Mở lần lượt 21 trang chi tiết từ danh mục VI: 8 mục gắn IELTS, 4 THPT, 2 TOEIC, 3 CEFR và 4 For Work. [Bảng tham chiếu](../../docs/openquiz-paths-reference.md) liệt kê URL từng trang, thứ tự chủ đề, số bộ, số từ/bộ và mục tiêu hoặc trình độ nguồn. Với ba nhánh đời sống 100 bộ trùng phạm vi CEFR, bảng chỉ ghi chủ đề mẫu đầu/cuối và không tái tạo các nhánh này.
- Trang công khai cho xem thông tin cấp lộ trình/bộ. Nút ôn SRS trên trang TOEIC yêu cầu đăng nhập, nên dừng tại hộp thoại. Không xác minh gợi ý cá nhân, tiến độ hay học tiếp sau đăng nhập. Không tạo tài khoản, không mở thẻ, không crawl, không lưu danh sách từ, nghĩa, ví dụ hay đề thi từ nguồn.

## Thay đổi và quy mô seed

- `content/paths.yaml`: giữ 18 slug, tăng từ 197 lên 240 bộ và từ 5.188 lên 9.070 thẻ mục tiêu. Điều chỉnh thứ tự IELTS theo chủ đề, mở rộng mỗi nhánh cụm từ/từ nối/luyện nói lên 10 bộ; giữ ba nhánh CEFR 10 bộ cấp thấp rồi 10 bộ cấp cao; điều chỉnh chủ đề và cỡ bộ THPT, họ từ, giao tiếp và For Work. TOEIC gom 50 bộ nhỏ thành 20 tình huống công sở. Ôn thi THPT dùng 10 dạng kỹ năng, không ghi năm đề vì không dùng đề gốc. Dùng tên nội bộ và CEFR biên soạn, không coi mục tiêu band là quy đổi CEFR.
- Giữ schema và pipeline seed. Không vượt 20 bộ/lộ trình hoặc 60 từ/bộ. `src/lib/paths/path-data.test.ts` kiểm thứ tự đủ 10 + 10 cấp CEFR thay vì ghim số từ IELTS cũ.
- Ước tính cho catalog trắng: **900 lượt DeepSeek** nếu cache trống, mọi ứng viên đều dùng được và không retry. Tính 450 batch theo tổng `ceil(words / 25)` trên từng bộ, nhân 2 lượt (chọn từ và bổ sung dữ liệu thẻ). Cache hoặc slug có sẵn làm giảm số lượt; ứng viên trùng, thẻ thiếu dữ liệu và retry JSON làm tăng. Trần lý thuyết trước khi áp quota là 5.720 lượt: 1.430 batch theo tổng `ceil(words / 15) + 3` trên từng bộ, tối đa 4 lượt/batch nếu cả hai bước đều retry. Quota thực tế là 1.500 lượt/ngày. Không gọi DeepSeek hoặc Supabase trong lần kiểm này.

## Kiểm tra và câu hỏi mở

- Parser seed đọc đủ 18 lộ trình, 240 bộ, 9.070 thẻ mục tiêu; không có chủ đề trùng tên trong cùng lộ trình. `pnpm test && pnpm typecheck && pnpm lint` qua: 65 test, 0 lỗi lint, 5 cảnh báo vendor có sẵn. Không chạy seed hoặc build; không dừng dev server, tạo branch/worktree hay commit.
- Khi duyệt seed, chốt ngân sách và lịch chạy. Nếu slug đã tồn tại, script bỏ qua thay vì cập nhật; quyết định cách xử lý nội dung đã seed trước khi chạy lại. Duyệt chất lượng CEFR và thẻ sinh rồi mới công khai.
- Có cần tách TOEIC thành nhiều lộ trình để giữ bộ ngắn không? Chỉ khảo sát tiếp gợi ý và tiến độ trên OpenQuiz nếu có tài khoản được cấp quyền.

Status: DONE
Summary: Đã đối chiếu 21 trang chi tiết công khai, cập nhật catalog 18 lộ trình với 240 bộ và 9.070 thẻ mục tiêu; kiểm tra qua, không sao chép nội dung và không chạy seed.

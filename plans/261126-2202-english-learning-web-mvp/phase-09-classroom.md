# Phase 09: Lớp học

Status: **hoãn** (27/11/2026, user quyết định làm sau). Không chặn phase 10, 11.

Context: [plan.md](plan.md) · Research mục 3.8

## Requirements

- Giáo viên tạo lớp → mã/link mời; học sinh tham gia bằng mã; giáo viên xoá thành viên.
- Giao bài: bộ từ hoặc lộ trình + chế độ yêu cầu (Learn, Quiz, Dictation, Speaking…) + hạn nộp + điểm đạt.
- Học sinh: danh sách bài cần làm, trạng thái (chưa làm / đang làm / hoàn thành / trễ hạn).
- Báo cáo: tiến độ từng học sinh, điểm, từ cả lớp hay sai nhất; xuất CSV.
- Bài Speaking: giáo viên nghe lại ghi âm và chấm/nhận xét thêm.

## Files tạo

- migration: `classes(id, owner_id, name, join_code)`, `class_members(class_id, user_id, role)`, `assignments(id, class_id, set_id|path_id, modes[], due_at, pass_score)`, `submissions(id, assignment_id, user_id, session_id, score, status, teacher_comment, graded_at)`
- `app/(app)/classes/{page,new/page,join/page,[id]/page,[id]/manage/page,[id]/assignments/[aid]/page}.tsx`
- `app/api/classes/[id]/report/route.ts` (CSV)

## Steps

1. RLS: giáo viên đọc dữ liệu học của học sinh **chỉ trong phạm vi bài giao** của lớp mình.
2. Gắn `study_sessions` với `assignment_id` để tự tạo submission khi học xong.
3. Báo cáo bằng SQL view/RPC, có index.
4. Thông báo trong app khi có bài mới / sắp hết hạn (email: để sau).

## Validation

- Học sinh lớp A không thấy dữ liệu lớp B; giáo viên không thấy bộ private không liên quan của học sinh.
- Nộp trễ hạn đánh dấu "trễ".
- Báo cáo lớp 50 học sinh tải < 2s.

## Risks

- Ghi âm học sinh được giáo viên nghe → nêu rõ khi tham gia lớp (user xác nhận không có người dùng < 16 tuổi).

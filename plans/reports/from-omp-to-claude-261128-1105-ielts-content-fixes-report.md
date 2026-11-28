# Báo cáo sửa nội dung IELTS

Status: DONE
Summary: Đã đối chiếu 840 câu Nói trên 210 bài, sửa 144 nhãn và thay 7 kịch bản bằng tình huống luyện nói A1. Supabase xác nhận 138 bài được cập nhật; đọc lại đủ 210 bài, không đổi trường ngoài phạm vi.

## Nhãn Part

Dùng gateway seed `local/dev` (alias `dev`), `temperature: 0`, JSON có cấu trúc, lô 7 bài. Dry-run 5 bài trước khi chạy toàn khóa: `After waking` và `Best study time` giữ `1,1,1,3`; `Remote teamwork`, `Affordable reliable energy` và `Small benefits and severe harm` đổi câu mở đầu từ Part 1 sang Part 3. Đã duyệt 20 câu mẫu trước khi chạy tiếp, không ghi Supabase ở bước này.

Sau lượt toàn khóa, hiệu chỉnh 44 nhãn do model đề xuất: câu kể trải nghiệm hoặc lựa chọn cá nhân không tự thành Part 3 vì dùng từ khó; câu phân tích chính sách không tự thành Part 1 vì có `you/your`. Đối chiếu câu mở đầu với catalog, không mặc định nhãn theo vị trí.

| Cấp | Câu đã xét | Part 1 sang 3 | Part 3 sang 1 | Tổng đổi | Trong đó câu mở đầu |
| --- | ---: | ---: | ---: | ---: | ---: |
| `foundations` | 120 | 0 | 1 | 1 | 0 |
| `band-3-4` | 120 | 1 | 1 | 2 | 0 |
| `band-45-55` | 120 | 8 | 0 | 8 | 8 |
| `band-6` | 120 | 32 | 1 | 33 | 30 |
| `band-7` | 120 | 33 | 0 | 33 | 30 |
| `advanced-1` | 120 | 31 | 0 | 31 | 30 |
| `advanced-2` | 120 | 36 | 0 | 36 | 30 |
| **Tổng** | **840** | **141** | **3** | **144** | **128** |

### 10 ví dụ đã đổi

| Bài | Câu | Trước / sau | Nội dung |
| --- | ---: | --- | --- |
| Window view | 4 | 3 / 1 | Do you like a view with flowers or a view with cars? Why? |
| An unexpected day off | 4 | 3 / 1 | On an unexpected day off, would you stay in or decide to go somewhere new? Why? |
| Snacks for a trip | 2 | 1 / 3 | Which is easier to pack for a short bus ride, crackers or dried fruit? |
| Stress and shopping | 1 | 1 / 3 | How can people avoid buying things after a stressful day? |
| Remote teamwork | 1 | 1 / 3 | When does remote work make teamwork harder? |
| Pedestrian streets | 3 | 3 / 1 | What would make you choose a different drop-off point on a busy shopping day? |
| Subsidies and inequality | 2 | 1 / 3 | If your town introduced a blanket electricity subsidy, which households would capture the largest share of the savings? |
| Hidden costs of low prices | 1 | 1 / 3 | Why might a low-price policy create unexpected costs later? |
| Sharing productivity gains | 1 | 1 / 3 | How can employers share gains from improved productivity? |
| Small benefits and severe harm | 1 | 1 / 3 | How should a decision maker weigh a widespread small benefit against a severe local harm? |

## 7 tình huống Foundations

Dựa vào mẫu cùng cấp: mô tả bối cảnh bằng tiếng Việt, giao nhiệm vụ luyện nói tiếng Anh, không gán tên người nói. Gateway có trả lại cả kịch bản và đầu ra thừa mục, nên không ghi nguyên văn. Bản cuối biên tập từ bối cảnh, mục tiêu và từ vựng của từng bài. Cả 7 qua bộ chặn `activityContentProblems` của seed và đối chiếu ít nhất hai mục từ với thẻ của chính bài.

- **A new classmate:** Bạn gặp một bạn mới trước giờ vào lớp. Chào bạn ấy bằng “Good morning!”, hỏi tên bằng “What’s your name?” rồi giới thiệu tên mình.
- **Inside my bag:** Bạn sắp đi học nhưng chưa tìm thấy hộp bút và hộp cơm. Nhờ người nhà tìm giúp “pencil case” và “lunch box”, rồi nói trong cặp đã có gì.
- **Buying fruit:** Bạn và một người bạn ghé chợ mua trái cây cho buổi dã ngoại. Nói bạn muốn mua “one melon” và “two peaches”, rồi hỏi bạn ấy muốn mua thêm gì.
- **A smaller size:** Bạn đang thử một chiếc áo ở cửa hàng nhưng áo quá rộng. Nói “This is too big.” với nhân viên rồi hỏi “Do you have this in a smaller size?”
- **On the way to school:** Bạn đi bộ đến trường cùng một người bạn. Chỉ cho bạn ấy nơi có “traffic lights” và “crosswalk”, rồi cùng sang đường.
- **Rainy afternoon:** Trời mưa nên bạn và một người bạn ở nhà. Hỏi bạn ấy muốn “play cards” hay “do a puzzle”, rồi chọn một trò để chơi cùng nhau.
- **Inviting a friend:** Bạn thấy một người bạn ở sân chơi. Dùng “Do you want to play?” để rủ bạn ấy, rồi cùng “pick a game” để chơi.

## File và kiểm chứng

- Supabase: chỉ cập nhật `course_lessons.activity_content` bằng service role với điều kiện JSONB cũ khớp. Đọc lại 210 bài và đối chiếu toàn bộ JSON với bản trước cộng đúng 144 đổi nhãn và 7 đổi tình huống. Không ghi thẻ; câu hỏi, bản dịch, ngữ pháp và các trường khác giữ nguyên. Chạy lại với cùng bản đã duyệt: 0 cập nhật, 210 bài khớp.
- Repo: chỉ giữ báo cáo này. Đã gỡ script một lần `scripts/fix-ielts-activity-content.ts` sau khi kiểm chứng; không nên giữ trong repo vì chỉ phục vụ đợt sửa này. Snapshot trước sửa và dữ liệu đã duyệt còn ở `/tmp/openengquiz-ielts-261128-1105-v2.json` và `/tmp/openengquiz-ielts-261128-1105-v2.json.dialogues` ngoài repo.
- `bun --conditions=react-server scripts/seed-activity-content.check.ts` qua. `pnpm test && pnpm typecheck && pnpm lint` qua với 201 test, 0 lỗi lint, 5 cảnh báo UI có sẵn.
- Không sửa UI, không chạm file của phiên nhập liệu, không commit, không push.

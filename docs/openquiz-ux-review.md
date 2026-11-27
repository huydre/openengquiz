# Trải nghiệm OpenQuiz trong vai người học (27/11/2026)

Dùng thử bằng tài khoản thật của user qua Playwright: Khoá học tiếng Anh, cấp Band 4.5–5.5, bài "Where Do You Live?". Ghi lại trải nghiệm để làm lại cho OpenEngQuiz; **chỉ học cách tổ chức và UX**, không lấy linh vật, hình, tên bài hay câu chữ của họ. Ảnh chụp: `.playwright-mcp/oq-*.png` (không commit).

## 1. Khoá học và bài học

- Vào khoá học thì sidebar tự thu gọn còn cột icon, màn hình tập trung vào bản đồ bài.
- Đầu trang tối giản: hai nút chọn (ngôn ngữ, cấp độ) và hai liên kết nhỏ (Mục tiêu, Góp ý). Không có thẻ lớn.
- Mỗi bài trên bản đồ có **vòng tiến độ quanh icon** (bài đang học có cung xanh tô một phần).
- Bấm vào bài → hộp thoại **danh sách hoạt động** (đã xong có dấu tích, bấm vào hoạt động nào cũng được) + nút "Tiếp tục".
- **Một bài = 7 hoạt động xen kẽ**, không phải 7 bước tuyến tính:
  1. Nói (câu hỏi mở đầu)
  2. Học từ vựng: **4 từ + 1 điểm ngữ pháp**
  3. Nói (câu hỏi nối tiếp)
  4. Nói (câu hỏi khác)
  5. Học từ vựng: 4 từ + 1 ngữ pháp
  6. Nói
  7. Hội thoại
- Trong "Học từ vựng" có ~18 bước nhỏ; với mỗi từ: thẻ → đọc từ (chấm phát âm) → **câu hỏi nói yêu cầu dùng chính từ đó** ("Hãy thử dùng crowded /ˈkraʊ.dɪd/ trong câu trả lời"). Từ mới được dùng ngay trong câu nói thật.

## 2. Bước nói (Speaking)

- Câu hỏi lớn, mỗi từ gạch chân chấm (bấm tra nghĩa); nhãn "IELTS Part 1"; công tắc dịch, nút nghe.
- Trợ giúp gọn dạng chữ: Xem gợi ý · Bí ý tưởng? · Xem định nghĩa.
- Hai nút lớn: **Bắt đầu nói** / **Nhập**. Chế độ nhập là **một ô một dòng** (mic nhỏ trái, mũi tên gửi phải), không nhãn, không hướng dẫn.
- **Không bắt chờ**: gửi xong câu trả lời hiện ngay trong khung "Đang đánh giá câu trả lời...", nút **Tiếp tục bấm được ngay**; nhận xét về sau ~1,5–3 s.
- Nhận xét: "✓ Đã sử dụng từ trong câu trả lời", điểm band (tổng + Ngữ pháp, Từ vựng, Mạch lạc), Gợi ý có giọng điệu, "Câu trả lời band cao" (từ nâng cấp tô xanh lá, cụm hay gạch chân chấm xanh dương, nghe và dịch ngay trong dòng). Thử lại / Tiếp tục.

## 3. AI Call (Hội thoại) - khác biệt lớn nhất

- **Màn gọi điện, không phải khung chat**: gia sư lớn giữa màn hình trong vòng sáng chuyển động khi AI nói; "Chạm để ngắt lời (Enter)"; bộ đếm lượt 0/4; nút thoát "Tôi chưa thể hội thoại".
- Bảng gợi ý bên cạnh: "Thử dùng các từ này nhé" (chip từ của bài) + Xem câu hỏi · Dịch câu hỏi? · Xem gợi ý · Bí ý tưởng? · Chế độ chat. **Không hiện chữ mặc định** (luyện nghe), muốn thì bấm "Xem câu hỏi".
- **Rảnh tay**: AI nói xong là tự chuyển sang nghe; im lặng thì "Không nghe thấy gì. Chạm để nói lại." + nút **Nói (Enter)**. Sau một lúc im lặng hiện "Để AI hướng dẫn bạn từng câu nhé?" (Để sau / Bật hướng dẫn).
- **Chế độ chat** (tuỳ chọn): tin AI là thẻ rộng, mỗi từ bấm tra được, nút loa; ngay trong tin AI có "Bạn hãy thử dùng các từ sau…" với **chip từ mới cho từng lượt** + Xem gợi ý · Bí ý tưởng? · Dịch câu hỏi?. Tin người học có "Đánh giá câu trả lời" (xin nhận xét khi muốn) và nút xoá. Thanh dưới: **nút Nói rộng** + badge lượt, nút bàn phím, nút quay về chế độ gọi.
- Độ trễ đo được: chữ trả lời của AI bắt đầu hiện **~1,3 s**, xong **~2,6 s** sau khi gửi.

## 4. So với OpenEngQuiz hiện tại

| Điểm | OpenQuiz | OpenEngQuiz hiện tại |
|---|---|---|
| AI Call | Màn gọi điện, rảnh tay, ngắt lời được | Khung chat, phải bấm ghi/dừng/gửi |
| Gợi ý khi nói | Chip từ mới mỗi lượt + trợ giúp gọn | Không có trong cuộc gọi |
| Chờ phản hồi | Không chặn, hiện ngay câu của mình | Phải chờ chép lời rồi mới gửi |
| Giọng AI | Bắt đầu nghe gần như ngay | Kokoro tạo cả câu, 1–4 s mới phát |
| Cấu trúc bài | 7 hoạt động xen kẽ, 4 từ/lần, dùng từ ngay | 7 bước tuyến tính, học hết từ rồi mới nói |

## 5. Nên làm

1. **AI Call dạng gọi điện rảnh tay**: tự nghe sau khi AI nói (phát hiện im lặng để tự gửi), chạm/Enter để ngắt lời, bảng gợi ý với chip từ của lượt, chế độ chat làm tuỳ chọn.
2. **Giảm trễ giọng nói**: stream chữ của AI, tách câu và tạo giọng **từng câu** ngay khi câu đầu xong (không chờ cả đoạn); chép lời bằng Groq (~0,6 s).
3. **Không chặn người học**: hiện câu trả lời ngay, nhận xét về sau.
4. (Cần user quyết) **Tổ chức lại bài học** thành 7 hoạt động xen kẽ, 4 từ + 1 ngữ pháp mỗi lần, có câu hỏi nói dùng từ vừa học.

## 6. Đặc tả bài học cần làm (đo kỹ lần 2, 27/11/2026)

Bấm vào bài trên bản đồ → hộp thoại danh sách **7 hoạt động** (icon theo loại, dòng phụ: câu hỏi hoặc "4 từ, 1 ngữ pháp"; đã xong có dấu tích và gạch ngang; bấm vào hoạt động nào cũng được) + nút **Tiếp tục** (mở hoạt động chưa xong đầu tiên).

| # | Loại | Nội dung |
|---|---|---|
| 1 | Nói | Câu hỏi mở đầu của bài (vd "Where do you live?") |
| 2 | Học từ vựng | Nhóm A: 4 từ + 1 điểm ngữ pháp |
| 3 | Nói | Câu hỏi nối tiếp (dùng được từ nhóm A) |
| 4 | Nói | Câu hỏi khác |
| 5 | Học từ vựng | Nhóm B: 4 từ + 1 điểm ngữ pháp |
| 6 | Nói | Câu hỏi khác |
| 7 | Hội thoại | AI Call theo chủ đề bài, gợi ý từ của bài |

Mỗi hoạt động mở đầu bằng **gia sư dẫn 1 đến 3 câu** (phụ đề Anh/Việt, 0.9x, Ẩn bản dịch, Nghe lại, Bỏ qua → "Học tiếp").

Thanh trên của hoạt động: ← , tên bài, "Phần N • Bài M", `n / 7`, thanh tiến độ bài; dưới đó nhãn dạng bài (Review Cards, Multiple Choice, Fill in the Blank, Speaking, Listen & Speak) + `k / 18` + thanh tiến độ hoạt động.

**Hoạt động Nói**: nhãn "IELTS Part 1/3", câu hỏi lớn (mỗi từ gạch chấm, bấm tra), công tắc dịch, nút nghe; Xem gợi ý · Bí ý tưởng? · Xem định nghĩa; "Đang nói: English"; **Bắt đầu nói** / **Nhập** (ô 1 dòng, mic trái, gửi phải). Gửi xong hiện ngay câu trả lời + "Đang đánh giá câu trả lời..." + Thử lại / **Tiếp tục bấm được ngay**. Nhận xét: "✓ Đã sử dụng từ" (nếu có từ mục tiêu), điểm band tổng + Ngữ pháp/Từ vựng/Mạch lạc, Gợi ý (giọng điệu), Câu trả lời band cao (tô xanh từ nâng cấp, gạch chấm cụm hay, nghe/dịch).

**Hoạt động Học từ vựng (18 bước nhỏ)**:
1. Bước 1 đến 5 **Review Cards**: thẻ lật (trước: từ, "Vocabulary - /IPA/", loa, công tắc tự phát; sau: nghĩa Việt, đồng nghĩa gạch chấm, ví dụ nghiêng + loa + dịch), Previous/Next, chấm trang, phím tắt. Sau mỗi thẻ từ: **"Hãy nói từ sau"** (từ, IPA, nghĩa; chấm phát âm, Bạn nói / AI phát âm, 3 thanh điểm, phân tích từng từ, Thử lại (Tab) / Tiếp tục). Thẻ 5 là **ngữ pháp** (mặt trước tên cấu trúc + "Grammar"; mặt sau giải thích tiếng Việt + ví dụ); thẻ cuối nút **Start Practice**.
2. Bước 6 đến 9 **nhớ nghĩa đến khi thuộc**: hiện từ + IPA, người học gõ nghĩa tiếng Việt, "n / 4 mastered"; đúng thì tăng; sai/"Tôi không biết" hiện "Đáp án đúng" + "Ví dụ" (loa, dịch) + Tiếp tục + **"Tôi trả lời đúng (Tab)"**; từ sai quay lại hàng đợi.
3. Bước 10, 12, 14, 16 **Fill in the Blank**: câu ví dụ có chỗ trống, gợi ý "word - /IPA/", gõ từ, Kiểm tra / Tôi không biết, cùng phản hồi như trên.
4. Bước 11, 13, 15, 17 **Speaking dùng từ**: câu hỏi do AI tạo cho đúng từ đó (có trạng thái "Đang tạo câu hỏi Speaking cho từ X..."), "Hãy thử dùng **X** (word) - /IPA/ trong câu trả lời", nhận xét như hoạt động Nói + "✓ Đã sử dụng từ trong câu trả lời".
5. Bước 18 **Listen & Speak (shadowing)**: câu ẩn chữ, nút loa lớn, 0.9×, tên giọng; Bắt đầu nói / gõ; Enter để nói/gửi; chấm phát âm câu.

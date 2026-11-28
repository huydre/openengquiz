# Bàn giao logic nhập từ vựng

## File đã đổi

- `src/lib/vocab/parse-vocab-sheet.ts`: ánh xạ header Việt/Anh, fallback A/B, lấy tiêu đề, kiểm tra dữ liệu và loại trùng.
- `src/lib/vocab/parse-vocab-text.ts`: parser CSV dùng chung và API dán chữ.
- `src/lib/vocab/read-vocab-file.ts`: đọc XLSX/CSV cục bộ, giới hạn 2 MB, chọn sheet.
- `src/lib/vocab/parse-vocab-sheet.test.ts`: kiểm tra sheet, CSV và các tổ hợp phân cách dán chữ.
- `src/app/(app)/sets/card-actions.ts`: thêm `importVocabCards`.
- `next.config.ts`: giới hạn body Server Actions 48 MiB, đủ cho 500 thẻ theo kích thước tối đa của schema sau khi mã hoá. Đây là giới hạn toàn app ở Next, không đổi giới hạn đọc file 2 MiB hay giới hạn từ proxy/hosting.
- `package.json`, `pnpm-lock.yaml`: thêm `read-excel-file` (lock phiên bản `9.3.20`), không dùng gói `xlsx`.
- `plans/reports/from-omp-to-claude-261128-1045-vocab-file-import-report.md`: báo cáo này.

Không sửa UI, `parseBulkCards`, schema DB hoặc file mẫu. Không commit/push. Không dừng hay khởi động lại dev server 3100 bằng lệnh.

## Hợp đồng cho UI

- `@/lib/vocab/read-vocab-file`: `readVocabFile(file: File): Promise<VocabSheetResult>`. Chỉ `.xlsx` và `.csv`, tối đa 2 MiB; lỗi đọc/định dạng trả qua `Error.message` tiếng Việt. File không được upload. XLSX dùng sheet đầu có header nhận diện được; nếu tất cả không có header thì dùng sheet đầu có dữ liệu, cột A/B.
- `@/lib/vocab/parse-vocab-sheet`: `parseVocabRows(rows: unknown[][]): VocabSheetResult`. Kết quả `{ cards: CardInput[]; skipped: { row: number; reason: string }[]; columns; title: string | null }`. `columns` chứa tên header thật, `{}` khi dùng cột A/B. `skipped.row` tính từ 1 theo dòng file. `title` lấy từ dòng tiêu đề riêng phía trên header. Nếu có cột nghĩa, cần ít nhất một trong hai nghĩa Việt/Anh có dữ liệu.
- `@/lib/vocab/parse-vocab-text`: `parseVocabText(text, { termSeparator, cardSeparator }?)` trả `VocabSheetResult`, `title` luôn `null`. Mặc định `tab` + `newline`; `termSeparator` nhận `tab`, `comma` hoặc chuỗi literal; `cardSeparator` nhận `newline` hoặc `semicolon`. TSV hơn hai cột dùng lại nhận diện header. Với `semicolon`, `skipped.row` là vị trí mục dán tính từ 1. Lỗi phân cách/ngoặc kép trả qua `skipped`.
- `@/app/(app)/sets/card-actions`: `importVocabCards({ setId?, title?, cards }): Promise<{ setId: string; added: number; duplicates: string[] } | { error: string }>`. Gửi 1 đến 500 `CardInput`, không gửi `File`. Tạo bộ riêng tư nếu không có `setId`; UI truyền tên file đã bỏ phần mở rộng hoặc tiêu đề người dùng chọn. Tiêu đề được trim, tối đa 200 ký tự; fallback `Bộ từ nhập từ file`. Với `setId`, chỉ chủ bộ được nhập. Bỏ từ trùng với DB hoặc trong lô; `duplicates` chứa từ bị bỏ theo thứ tự đầu vào. Chèn một lần với position liên tiếp; nếu lô chèn lỗi, xoá bộ vừa tạo và báo riêng nếu xoá lỗi. Hai yêu cầu ghi đồng thời có thể tranh chấp giống `bulkAddCards` hiện có; không đổi schema DB.

## Kiểm tra

- Smoke `readVocabFile` với `Tu_Vung_Tieng_Anh_Hoan_Chinh.xlsx` trong Chromium headless: **79 thẻ, 0 dòng bỏ qua**. Tiêu đề `DANH SÁCH TỪ VỰNG TIẾNG ANH TỔNG HỢP (ĐÃ KIỂM TRA & HIỆU ĐÍNH)`; thẻ đầu `disabilities`, cuối `give nature a hand`; sheet thống kê không được nhập.
- Smoke `importVocabCards` với Supabase giả lập: từ chối người không có quyền, loại trùng, nối position, trim tiêu đề khi tạo bộ riêng tư, xoá bộ khi chèn lỗi. Không thử ghi DB thật vì cấu hình hiện trỏ tới Supabase từ xa.
- `pnpm test && pnpm typecheck && pnpm lint` qua: 205 test, 33 file; lint 0 lỗi, 5 cảnh báo trong file UI không sửa.
- Smoke encoder React/Next với 500 thẻ độ dài tối đa, dùng ký tự cần escape: 43.211.269 byte, dưới 48 MiB. Không gửi yêu cầu live.
- Audit dependency production: không thấy advisory cho `read-excel-file` hoặc bốn dependency mới đi kèm trong kết quả registry.

Status: DONE
Summary: Logic nhập XLSX/CSV và dán chữ sẵn sàng nối UI. File mẫu đọc 79 thẻ; test, typecheck và lint qua.

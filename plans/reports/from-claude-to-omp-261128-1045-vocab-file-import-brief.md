# Brief cho omp: nhập bộ từ từ file Excel/CSV (phần logic)

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit, không push**. Model `local/dev`. **Không làm UI** (Claude làm dropzone, bảng xem trước, nút nhập).

## Mục tiêu

Người học tải file `.xlsx` hoặc `.csv` danh sách từ để tạo bộ từ mới, hoặc thêm vào bộ từ có sẵn. File mẫu thật: `/Users/hnam/Downloads/Tu_Vung_Tieng_Anh_Hoan_Chinh.xlsx` (chỉ đọc, đừng commit file này). Cấu trúc:

- Sheet 1 "Từ vựng Tiếng Anh": dòng 1 là tiêu đề gộp ô ("DANH SÁCH TỪ VỰNG..."), dòng 2 là header: `STT | Từ mới (Word / Phrase) | Loại từ (POS) | Cách phát âm (IPA) | Nghĩa tiếng Việt | Ví dụ (Example) | Từ đồng nghĩa (Synonyms) | Từ trái nghĩa (Antonyms) | Ghi chú sửa lỗi chính tả`, sau đó ~79 dòng dữ liệu.
- Sheet 2 là thống kê, bỏ qua (chọn sheet đầu tiên có header nhận diện được).

## Yêu cầu

1. **Đọc file ở trình duyệt** (không upload file lên server): thêm thư viện nhỏ, an toàn, còn bảo trì để đọc `.xlsx` phía client (gợi ý `read-excel-file`; **không dùng** gói `xlsx` trên npm vì bản npm cũ có lỗ hổng). CSV tự parse (có dấu ngoặc kép, dấu phẩy trong ô, BOM UTF-8). Giới hạn file 2 MB.
2. **Hàm thuần** `src/lib/vocab/parse-vocab-sheet.ts`:
   - `parseVocabRows(rows: unknown[][]): VocabSheetResult` với `{ cards: CardInput[]; skipped: { row: number; reason: string }[]; columns: Partial<Record<"term"|"part_of_speech"|"ipa"|"definition_vi"|"definition_en"|"example_en"|"example_vi"|"synonyms", string>>; title: string | null }` (`row` là số dòng thật trong file, 1-based; `columns` ghi tên header đã khớp để UI hiển thị).
   - Tự tìm dòng header trong ~10 dòng đầu bằng bí danh không phân biệt hoa thường/dấu, khớp theo chữ chứa trong header, cả tiếng Việt lẫn tiếng Anh (ví dụ: term: "từ", "từ mới", "word", "term", "vocabulary", "phrase"; definition_vi: "nghĩa", "nghĩa tiếng việt", "meaning", "vietnamese"; definition_en: "definition", "english meaning"; part_of_speech: "loại từ", "pos", "part of speech"; ipa: "phát âm", "ipa", "pronunciation"; example_en: "ví dụ", "example"; example_vi: "dịch ví dụ", "example translation"; synonyms: "đồng nghĩa", "synonym"). Cẩn thận "Từ đồng nghĩa" và "Từ trái nghĩa" chứa chữ "từ": không được nhận nhầm là cột term. Bỏ qua cột STT, trái nghĩa, ghi chú (bảng `cards` không có chỗ lưu).
   - Không có header nhận diện được: coi 2 cột đầu là từ và nghĩa (giống nhập dán chữ hiện có).
   - `title`: dòng tiêu đề phía trên header nếu có (ví dụ "DANH SÁCH TỪ VỰNG..."), để UI gợi ý tên bộ.
   - Làm sạch: trim, gộp khoảng trắng, bỏ dòng trống, IPA giữ nguyên, synonyms tách bằng `,` `;` `/`, bỏ trùng. Dòng thiếu từ hoặc thiếu nghĩa (khi có cột nghĩa) → `skipped` với lý do tiếng Việt. Từ trùng trong file (không phân biệt hoa thường) → giữ dòng đầu, các dòng sau vào `skipped`. Dữ liệu phải qua `cardSchema` (`src/lib/vocab/card-schema.ts`); dòng vi phạm → `skipped`.
   - Hàm đọc file `readVocabFile(file: File): Promise<VocabSheetResult>` (client-only, ví dụ `src/lib/vocab/read-vocab-file.ts`) chọn sheet, gọi `parseVocabRows`. Lỗi đọc → ném lỗi có thông điệp tiếng Việt.
3. **Server action** (đặt cạnh `src/app/(app)/sets/card-actions.ts` hoặc file mới trong `src/app/(app)/sets/`):
   - `importVocabCards(input: { setId?: string; title?: string; cards: CardInput[] }): Promise<{ setId: string; added: number; duplicates: string[] } | { error: string }>`.
   - Không có `setId`: tạo bộ từ mới của người dùng (riêng tư, theo cách `createSet` đang làm; tiêu đề trim, mặc định tên file do UI gửi). Có `setId`: kiểm tra quyền như `ownedSet`.
   - Tối đa 500 thẻ một lần (zod `cardSchema`). Bỏ qua từ đã có trong bộ (dùng `readSetTerms`/`cardTermKey` như `bulkAddCards`), trả danh sách `duplicates` thay vì báo lỗi cả lô. Chèn một lần, position nối tiếp. Tạo bộ mới + chèn thẻ: nếu chèn thẻ lỗi thì xoá bộ vừa tạo (không để bộ rỗng). `revalidatePath` phù hợp.
4. **Test**: `parse-vocab-sheet.test.ts` dùng dữ liệu giống file mẫu (dòng tiêu đề, header 9 cột, synonyms nhiều giá trị, dòng trống, trùng, thiếu nghĩa, file không header 2 cột, header tiếng Anh). Test CSV parser (ngoặc kép, BOM). Nếu được, smoke đọc file mẫu thật qua script tạm (đừng commit) và ghi số thẻ đọc được vào báo cáo.
5. `pnpm test && pnpm typecheck && pnpm lint` xanh.

## Ràng buộc

- Không em dash "—" hay " – ".
- Không sửa UI, không đụng phiên omp khác, không tắt dev server 3100.
- Liệt kê **đủ mọi file đã sửa/thêm** (kể cả `package.json`, `pnpm-lock.yaml`) trong báo cáo.

## Hoàn thành khi

Báo cáo `plans/reports/from-omp-to-claude-261128-1045-vocab-file-import-report.md`: file đã đổi, hợp đồng hàm/action cho UI, kết quả đọc file mẫu, test, kết thúc bằng `Status:` / `Summary:`. Rồi nhắn Claude:

`orca terminal send --terminal term_5c778c63-8c46-4d6a-a518-569d84532dad --text "omp xong: plans/reports/from-omp-to-claude-261128-1045-vocab-file-import-report.md, Status: <status>" --enter --json` (handle stale: `orca terminal list --json`, tìm tabId `05b3c319-99f8-4d1c-a13a-d23788686b7a`).

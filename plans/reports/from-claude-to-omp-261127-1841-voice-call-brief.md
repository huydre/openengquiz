# Brief cho omp: làm lại AI Call thành cuộc gọi rảnh tay, độ trễ thấp

Project: `/Users/hnam/orca/projects/openengquiz`, branch `feat/mvp-core`. Làm trực tiếp, **không tạo branch/worktree, không commit**. Model `local/dev` cho mọi việc, kể cả agent con.

## Vì sao

User chê AI Call: UI xấu, giọng trễ, UX tệ. Claude đã dùng thử sản phẩm tham khảo trong vai người học, kết quả ở **`docs/openquiz-ux-review.md`** (đọc kỹ mục 3, 4, 5). Chỉ học cách tổ chức và UX; **không** dùng linh vật, hình hay câu chữ của họ. Giữ style sáng của app.

## Code hiện có (đọc trước)

- UI: `src/app/(app)/study/[setId]/call/call-session.tsx` (dùng ở trang AI Call riêng và bước hội thoại của bài học qua `onComplete`).
- API: `src/app/api/conversation/route.ts`, `[threadId]/turn/route.ts` (stream chữ), `[threadId]/finish/route.ts`; logic `src/lib/ai/conversation*.ts`.
- Giọng: `src/lib/speech/play-tts.ts` (`playTtsTrack`, `prefetchTts`, `ttsUrl` → `GET /api/tts`, Kokoro, cache Storage), gia sư `src/components/tutor/` (`TutorNarration`, `TutorAvatar`).
- Ghi âm: `src/components/audio/audio-recorder.tsx` (WAV 16 kHz qua AudioWorklet, có mức âm `level`), chép lời `POST /api/speaking/transcribe` (Groq ~0,6 s, dự phòng Whisper VPS).

## Việc cần làm

1. **Màn gọi điện (mặc định)**: gia sư lớn giữa màn hình (dùng/mở rộng `TutorAvatar` hoặc nhân vật trong `TutorNarration`) với vòng sáng phản ứng theo trạng thái: AI đang nói / đang nghe (theo mức âm mic) / đang nghĩ. Trên cùng: thoát, tên cuộc gọi, bộ đếm lượt `n/N`. Không hiện chữ mặc định; có nút **Xem câu hỏi** (hiện câu AI vừa nói), **Dịch câu hỏi**, **Xem gợi ý**, **Bí ý tưởng?**, **Chế độ chat**. Bảng **"Thử dùng các từ này"**: chip từ/cụm cho **từng lượt** (LLM trả kèm theo lượt, lấy từ từ vựng của bài/bộ).
2. **Rảnh tay**: AI nói xong → tự mở mic nghe. **Phát hiện im lặng** (VAD theo năng lượng trên mức âm hiện có): người học nói rồi im ~1,2 s thì tự dừng và gửi; chưa nói gì trong ~8 s thì "Không nghe thấy gì. Chạm để nói lại" + nút **Nói (Enter)**. **Chạm hoặc Enter để ngắt lời** AI đang nói. Có nút "Tôi chưa thể hội thoại" (thoát nhẹ nhàng) và sau im lặng lâu thì gợi ý chế độ hướng dẫn từng câu (đơn giản: hiện câu gợi ý để đọc theo).
3. **Giảm trễ** (mục tiêu: người học nghe tiếng AI ≤ ~2 s sau khi nói xong):
   - Chép lời ngay khi dừng (Groq), không chờ người học bấm.
   - Stream chữ của AI; **tách câu** khi stream và gọi TTS **từng câu** ngay khi câu đầu xong, phát nối tiếp (hàng đợi), không chờ cả đoạn. Dùng `prefetchTts`/`ttsUrl`.
   - Không chặn: câu của người học hiện ngay.
4. **Chế độ chat (tuỳ chọn)**: tin AI là thẻ rộng, **mỗi từ bấm tra nghĩa** (popover, `/api/lookup`), nút loa; trong tin AI có chip "thử dùng các từ" + Xem gợi ý / Bí ý tưởng? / Dịch. Tin người học có "Đánh giá câu trả lời" (gọi nhận xét khi muốn). Thanh dưới: **nút Nói rộng** + badge lượt, nút bàn phím (gõ), nút về chế độ gọi.
5. Giữ hành vi kết thúc/tổng kết hiện có và tích hợp với bài học (`onComplete`), RLS/quota hiện có. Không lưu audio.

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu (kể cả lọc khỏi câu AI hiển thị nếu tiện: thay bằng dấu phẩy).
- Next 16: dữ liệu theo request trong `<Suspense>`, **không** export `runtime`/`dynamic`; không sửa proxy. AI/giọng nói chỉ ở server, kiểm quota. Không đọc/in secret.
- Component: ưu tiên Watermelon (`pnpm dlx shadcn@latest search @watermelon -q <từ khoá>`, cài thì `yes n |`), `@/components/ui/select`, `LogoLoader`, `Button`. Icon lucide. Tôn trọng `prefers-reduced-motion`.
- Migration nếu cần: chỉ viết file (timestamp sau `20261127170100`), không tự đẩy. JSX dễ đọc, comment tiếng Anh, file kebab-case. Không `pnpm build`; dev server cổng 3100 trong tab Orca "dev 3100", đừng tắt.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error); test cho phần thuần (VAD/ngưỡng im lặng, tách câu khi stream, hàng đợi phát).
- Đo và ghi độ trễ thực tế (gửi → chữ đầu tiên → âm thanh đầu tiên) với DeepSeek + Kokoro thật qua hàm server (không cần đăng nhập).
- Chụp ảnh màn gọi (AI nói / đang nghe / gợi ý mở) và chế độ chat bằng trang preview tạm **dưới `/shared/tmp-...`**, xoá sau khi chụp; lưu ảnh vào `plans/reports/`.
- **Chỉ ghi báo cáo khi xong toàn bộ, kể cả agent con**: `plans/reports/from-omp-to-claude-261127-1841-voice-call-report.md`, kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

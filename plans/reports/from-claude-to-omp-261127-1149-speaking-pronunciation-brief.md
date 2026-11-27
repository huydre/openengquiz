# Brief cho omp: phase 06 (luyện nói + chấm phát âm)

Project: `/Users/hnam/orca/projects/openengquiz`. Làm trực tiếp trong thư mục này, **không tạo worktree/branch, không commit**.

## Đọc trước

- `AGENTS.md`, `README.md` (mục "Dịch vụ giọng nói"), `docs/code-standards.md`
- `plans/261126-2202-english-learning-web-mvp/phase-06-ai-speaking-pronunciation.md` (yêu cầu chính)
- `docs/speech-alternatives-research.md` (vì sao bỏ Azure, kết quả thử dịch vụ)
- Dùng lại, **không sửa**:
  - `src/lib/speech/client.ts`: `assessPronunciation(audio, text, strictness)` trả `PronunciationResult` (điểm 0..1 cho câu, từng từ, từng âm; `issues` là danh sách lỗi có `kind`, `word`, `expected`/`heard` IPA, `features`), `isSpeechServiceConfigured()`, `SpeechServiceError`.
  - `src/lib/ai/{client,quota,quota-rules}.ts` (feature `speaking`, `pronunciation` đã có hạn mức), mẫu structured output ở `src/lib/vocab/enrich-vietnamese.ts` (AI SDK 7: `generateText` + `Output.object`).
  - `src/lib/supabase/{server,admin}.ts`, trang bộ từ `src/app/(app)/sets/[id]/page.tsx`, khung chế độ học `src/app/(app)/study/[setId]/`.

## Claude đang làm song song (đừng sửa các file này)

- `src/app/api/tts/route.ts` và `src/lib/speech/play-tts.ts`: phát âm mẫu bằng Kokoro. Hợp đồng để bạn dùng: client gọi `playTts(text, { voice? })` từ `@/lib/speech/play-tts` (tự fallback `speechSynthesis`). Nếu file chưa có khi bạn cần, cứ import theo hợp đồng này.
- `src/app/(app)/sets/flashcard-viewer.tsx`, `src/components/study/study-question.tsx`, `services/speech/**`, `src/lib/speech/client.ts`.

## Việc cần làm

1. **Ghi âm** (`src/components/audio/`): xin quyền mic, tối đa 60 giây, hiện mức âm và thời gian. **Ghi WAV PCM 16 kHz mono bằng Web Audio API** (tự encode WAV), không dùng MediaRecorder webm/opus: thử nghiệm cho thấy opus làm điểm phát âm thấp hơn rõ (0,46 so với 0,73 cùng một câu); WAV cũng tránh lỗi định dạng trên Safari iOS. Có màn xin đồng ý lần đầu, nói rõ audio chỉ dùng để chấm và không lưu.
2. **Luyện phát âm** `/pronunciation`: đọc theo câu mẫu (câu ví dụ của thẻ, hoặc tự gõ) → `POST /api/speaking/assess` chế độ scripted → hiện điểm accuracy/fluency/completeness, tô đỏ từ sai, chi tiết âm vị, nút nghe mẫu (`playTts`).
3. **Speaking với từ mục tiêu** `/study/[setId]/speaking`: LLM sinh câu hỏi mở theo từ + trình độ (`profiles.level`), cache theo `(term, level)` nếu tiện; người học trả lời bằng giọng nói → phản hồi: có dùng đúng từ không, sửa ngữ pháp (gạch/thay) + giải thích tiếng Việt ngắn, câu mẫu tự nhiên hơn, ước lượng CEFR, điểm phát âm theo từ.
4. **STT cho câu trả lời tự do**: nếu có env `GROQ_API_KEY` thì dùng Groq Whisper (`whisper-large-v3-turbo`, qua AI SDK nếu có provider phù hợp, hoặc fetch API OpenAI-compatible) ở server; nếu không thì client dùng Web Speech API (`SpeechRecognition`, en-US) để lấy transcript gửi kèm audio; trình duyệt không hỗ trợ thì cho người học xem/sửa transcript bằng tay. Sau đó chấm phát âm với chính transcript làm câu mẫu.
5. **Gợi ý tiếng Việt từ `issues`**: hàm thuần chuyển lỗi âm vị (IPA + feature như `backness`, `voicing`) thành câu gợi ý tiếng Việt ngắn, có test Vitest. Gợi ý ưu tiên các lỗi hay gặp của người Việt (/θ/, /ð/, âm cuối, /ʃ/ vs /s/, nguyên âm dài/ngắn).
6. **API** `src/app/api/speaking/{question,assess}/route.ts`: yêu cầu đăng nhập, kiểm quota (`pronunciation` cho scripted, `speaking` cho có LLM), giới hạn file 5 MB / 60 giây, timeout 30 giây. Dịch vụ giọng nói chưa cấu hình → 503 + thông báo thân thiện; AI chưa cấu hình → vẫn chấm phát âm, chỉ bỏ phần phản hồi ngữ pháp.
7. **Lưu kết quả**: migration `speaking_attempts(id, user_id, card_id null, mode, prompt_text, transcript, pron jsonb, feedback jsonb, created_at)` có RLS chỉ chủ sở hữu. **Không lưu audio** (quyết định: giảm rủi ro dữ liệu giọng nói; plan cũ định lưu 30 ngày, ghi lại thay đổi này vào phase-06). Trang `/speaking/history` liệt kê lượt luyện gần đây.
8. Thêm lối vào: chế độ "Luyện nói" trong khu Học của trang bộ từ, mục `/pronunciation` trong sidebar (`src/components/layout/nav-items.ts`), thêm route vào `PROTECTED_PREFIXES` (`src/lib/supabase/proxy.ts`).

## Ràng buộc

- **Không dùng em dash "—" và " – "** ở bất cứ đâu.
- UI tiếng Việt, style sáng edtech, ưu tiên component Watermelon (`pnpm dlx shadcn@latest view/add @watermelon/<tên>`, ví dụ `audio-player-with-waveform`; khi cài từ chối ghi đè: `yes n |`).
- Next 16 Cache Components: dữ liệu theo request nằm trong `<Suspense>`; `params`/`searchParams` là Promise; **không** export `runtime`/`dynamic`.
- Mọi lời gọi AI/dịch vụ giọng nói chỉ ở server. Không đọc/in giá trị secret.
- Migration: chỉ viết file trong `supabase/migrations/` (timestamp sau `20261127095700`), **không tự đẩy**; ghi tên vào báo cáo.
- JSX dễ đọc, comment code tiếng Anh, file kebab-case. Không chạy `pnpm build`; đừng tắt dev server cổng 3100.

## Hoàn thành khi

- `pnpm test && pnpm typecheck && pnpm lint` qua (0 error); log dev server không lỗi compile khi mở các trang mới.
- Nếu `.env.local` có `SPEECH_SERVICE_URL`/`SPEECH_SERVICE_TOKEN` (đang có): thử gọi `/api/speaking/assess` thật bằng một file WAV (ví dụ tạo bằng `say -o x.aiff "..." && afconvert -f WAVE -d LEI16@16000 -c 1 x.aiff x.wav`) với phiên đăng nhập sẵn có trong Chrome nếu được.
- Cập nhật status/checklist `phase-06-ai-speaking-pronunciation.md`, dòng Status `plan.md`, `README.md` (biến `GROQ_API_KEY` tuỳ chọn), `.env.example`.
- **Chỉ ghi báo cáo khi đã xong toàn bộ, kể cả mọi agent con**: `plans/reports/from-omp-to-claude-261127-1149-speaking-pronunciation-report.md` (file đã đổi, migration cần đẩy, cách kiểm tra, việc còn lại, câu hỏi mở), kết thúc bằng:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
```

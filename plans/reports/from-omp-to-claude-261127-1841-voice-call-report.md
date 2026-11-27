# Bàn giao AI Call rảnh tay

Phạm vi: dữ liệu, API, hook/state và test. `CallSession` và `CallMessageTools` là markup chức năng tối giản. Claude có thể thay markup mà không cần viết lại điều phối phiên gọi.

## Hook và props cho UI

Module UI nằm tại `src/app/(app)/study/[setId]/call/`.

### `useCallSession(options: CallSessionOptions): CallSessionState`

- Options bắt buộc: `setId: string`, `aiEnabled: boolean`, `scenarios: { id: string; label: string }[]`, `cardCount: number`, `maxTurns: number`, `resume: { threadId: string; scenario: string; messages: CallMessage[]; finished?: boolean } | null`. Tùy chọn `onComplete?: (threadId: string) => Promise<void>` cho bài học. `CallMessage = { role: "user" | "assistant"; content: string; terms?: string[] }`. `resume` là giá trị khởi tạo; đổi phiên bằng cách đổi `key` hoặc dùng `newCall()`.
- `CallSessionProps` là `CallSessionOptions` cộng `setTitle: string`, `warning?: string | null`. Trang bộ từ truyền trần 15; bước 7 IELTS truyền trần 5 và chỉ chốt sau ít nhất 4 lượt. Gọi riêng cần ít nhất 1 lượt. `onComplete` chỉ nhận `threadId` đã chốt; gọi riêng nhận `summary` trong state.
- Dữ liệu: `threadId`, `scenario`, `messages`, `userTurns`, `assistantIndex`, `assistant`, `summary`, `finished`, `ended`, `canFinish`. `assistantIndex` trỏ vào `messages`; bằng `-1` khi chưa có tin gia sư. `ended` báo đã chốt hoặc đã đạt trần; không thay thế `finished`.
- Hiển thị: `view: "call" | "chat"`, `state: "idle" | "listening" | "speaking" | "thinking"`, `busy: "start" | "turn" | "finish" | undefined`, `pendingText`, `streaming`, `error`, `speaking`, `micActive`, `micLevel` (0 đến 1), `canTalk`, `consent`, `silence`, `guided`, `offerGuide`, `paused`, `keyboard`, `typed`. `messages` chỉ có tin đã xác nhận; `pendingText` và `streaming` là phần tạm. Chế độ gọi không hiện chữ gia sư mặc định. Dùng `assistant.terms ?? []` cho chip lượt hiện tại.
- Hành động: `setScenario(id)`, `startCall()`, `changeView(view, showKeyboard?)`, `setTyped(text)`, `toggleKeyboard()`, `sendTurn(textOrWav)`, `talk()`, `replay(text, listenAfter?)`, `allowMic()`, `pauseCall()`, `resumeCall()`, `enableGuide()`, `dismissGuide()`, `finishCall()`, `newCall()`. `startCall`, `sendTurn`, `finishCall` trả `Promise<void>`. Dùng `changeView("chat", true)` để mở ô gõ. `resumeCall()` bỏ trạng thái pause; người học bấm Nói hoặc nghe lại để mở mic. `replay(text, true)` chỉ mở mic sau phát trong chế độ gọi; UI không truyền `true` khi `ended`.
- Enter nằm ở markup, không nằm trong hook: gọi `talk()` khi `canTalk`, bỏ qua Enter trong input, button hoặc dialog. `talk()` ngắt giọng và mở mic, hoặc dừng/gửi mic đang chạy. Lượt cuối có thể ngắt giọng nhưng không mở thêm mic. Ngắt giọng không hủy lượt đang ghi; nếu WAV lượt mới đến sớm, hook giữ một WAV chờ xác nhận lượt trước. Đổi mode, pause hoặc unmount dọn audio đang chờ.
- `consent` báo cần nhắc về micro trước khi gọi `allowMic()`. Browser vẫn có thể từ chối quyền; hook trả thông báo trong `error`. `offerGuide` bật sau khoảng 8 giây chưa nghe người học. `enableGuide()` bật chế độ; UI gọi `useCallAssist(...).request("hint")` để lấy câu tiếng Anh đọc theo.

### Trợ giúp, tra từ, media

- `use-call-assist.ts`: `useCallAssist(threadId, index): CallAssistState` trả `{ result, request(action), busy, error }`; `result` là map theo action. Gắn theo `key` gồm thread và index để không tái dùng cache của tin khác. `index` là vị trí tin đã lưu, không tính tin tạm. `translate`, `hint`, `ideas` cho tin gia sư; `evaluate` cho tin người học.
- `call-client.ts`: `lookupCallMeaning(term, signal?)` gọi lookup và trả nghĩa tiếng Việt, dự phòng tiếng Anh; `cleanCallText(text)` lọc dấu dài; `readCallReply(response, onEvent)` đọc NDJSON và trả `{ text, terms }` khi `done`, báo lỗi khi stale/error hoặc stream kết thúc thiếu `done`. `splitQuestion(text)` trong `src/lib/courses/course-question.ts` cấp `{ value, term }` cho UI tra từng từ mà vẫn giữ chữ và dấu gốc.
- `src/lib/speech/use-call-mic.ts`: `useCallMic({ onAudio, onSilence, onError })` trả `{ start, stop, cancel, active, level }`; `onAudio` nhận WAV PCM mono 16 kHz, `onError` nhận `mic-denied` hoặc `mic-unavailable`. VAD ngưỡng 0,02, tự gửi sau 1.200 ms im sau tiếng nói; chưa nói sau 8.000 ms thì không gửi WAV. Hook phiên gọi đã điều phối mic, không cần dùng cả hai hook cho cùng màn.
- `src/lib/speech/call-reply-audio.ts`: `splitCallReplyText(buffered, final?)` trả `{ chunks, rest }`; `createCallReplyAudio({ onSpeaking, onError?, ... })` trả `{ push, finish, stop }`. Đẩy câu đầu vào TTS trước khi toàn đoạn xong, nạp trước câu kế bằng `prefetchTts`, phát qua `playTtsTrack`/`ttsUrl`.

## API và dữ liệu

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /api/conversation` | `{ setId, scenario }` | `{ threadId }` của cuộc gọi trống |
| `POST /api/conversation/[threadId]/turn` mở đầu | `{ mode: "text", start: true, expectedTurns: 0 }` | JSON `{ greeting, terms }` |
| `POST /api/conversation/[threadId]/turn` thường | JSON `{ mode: "text", text, expectedTurns }` hoặc multipart `mode=audio`, `audio` WAV PCM mono 16 kHz, `expectedTurns`, tùy chọn `transcript` | NDJSON: `{ type: "transcript", text }`, các `{ type: "delta", text }`, kết thúc bằng `{ type: "done", text, terms }`, `{ type: "stale" }` hoặc `{ type: "error", error }` |
| `POST /api/conversation/[threadId]/assist` | `{ action: "translate" \| "hint" \| "ideas" \| "evaluate", messageIndex }` | `{ text }`, kể cả cuộc gọi đã chốt |
| `POST /api/conversation/[threadId]/finish` | `{}` | `{ summary: { used_terms, unused_terms, errors: [{ original, correction, explanation_vi }], note_vi } }` |
| `GET /api/lookup?term=...` | Term URL-encoded | UI đọc `data.definition_vi`, dự phòng `data.definition_en` |

`expectedTurns` đếm tin người học đã xác nhận. `messageIndex` bắt đầu từ 0, theo thứ tự `created_at, id` của tin đã lưu. `done` chỉ đến sau khi RPC ghi nguyên tử tin người học, tin gia sư và chip. `stale` yêu cầu tải lại thay vì tự gửi lại. WAV chỉ dùng để chép lời, không lưu. Quota và RLS giữ ở server. Groq được ưu tiên, Whisper VPS dự phòng.

DeepSeek từng trả output trống khi gộp reply và chip vào structured stream. Đường cuối stream chữ thường; tạo chip song song và dùng `[]` nếu riêng tác vụ chip lỗi. UI bắt đầu TTS theo delta, không đợi chip. Chip chỉ lấy từ thẻ trong bộ, giữ trong `chat_messages.suggested_terms` để resume cả gọi riêng và IELTS; tin cũ có thể không có chip. Gọi riêng không resume nhầm thread `course`.

`20261127190000_chat_message_terms.sql` đã được Claude đẩy theo thông báo. Không sửa migration đã đẩy, không tạo migration thay thế. Migration này thêm đúng cột liên quan lỗi `42703`; chưa xác minh lại DB từ xa. Nếu `42703` còn sau deploy, kiểm tra DB mà app đang trỏ tới có cột và đúng phiên bản RPC trước khi tạo migration mới.

## Xác minh và độ trễ

- `pnpm test`: 97 test, 21 file qua. Có test VAD, tách câu qua delta (kể cả số thập phân), queue phát/ngắt, NDJSON chia chunk và stale/truncated. Lint: 0 lỗi, 5 cảnh báo vendor cũ. Typecheck riêng AI Call qua.
- `pnpm typecheck` toàn repo chưa qua: `TS2307` ở `src/app/api/courses/lessons/[lessonId]/activities/route.ts` và `src/lib/courses/course-data.ts` vì thiếu `lesson-activities`. Dev server sau đó trả HTTP 500 do thiếu `@/components/courses/course-activity-lesson`; trước thay đổi ngoài phạm vi, bốn route hội thoại trả 401 khi chưa đăng nhập. Không sửa module bài học ngoài phạm vi. Chưa chạy luồng HTTP đăng nhập trên Supabase đích.
- Chromium với HTTP mô phỏng và mic tạo tín hiệu: mở phiên, ngắt giọng, VAD tự gửi WAV, cập nhật lượt và chip, hiện hướng dẫn sau im lặng, pause, chuyển chat, gửi text, tổng kết. Fixture bài học chặn chốt trước lượt 4 và callback nhận đúng `threadId`. SQL cô lập: ghi chip, thứ tự tin, stale, finish, chặn ghi sau finish và RLS giữa hai người dùng; đã rollback. Xóa fixture và probe.
- Probe provider thật, một lượt `deepseek-flash` + Kokoro `af_heart`: gửi đến delta đầu **1.023 ms**; câu đầu hoàn chỉnh **1.023 ms**; Kokoro tổng hợp câu đầu **1.810 ms**; nhận đủ bytes audio đầu tại khoảng **2.833 ms** từ lúc gửi. Stream chữ kết thúc **2.842 ms**; greeting **1.334 ms**; assist hint **1.202 ms**. Mốc 2.833 ms là `ArrayBuffer` audio hoàn chỉnh từ hàm server, không phải TTFB hay lúc loa bắt đầu phát. Chưa tính VAD, STT, DB/auth, mạng trình duyệt hoặc phát loa; mốc nghe trong khoảng 2 giây chưa được chứng minh.

Status: DONE_WITH_CONCERNS
Summary: Đã bàn giao dữ liệu, API, hook và markup chức năng cho Claude. 97 test qua; lint không lỗi. Typecheck toàn repo bị chặn bởi module bài học thiếu, mốc audio server 2,83 giây vượt mục tiêu và chưa xác minh Supabase đích.

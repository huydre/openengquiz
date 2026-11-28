# Đo tốc độ TTS miễn phí và cách các app học tiếng Anh xử lý

Ngày 2026-11-28, đo từ máy ở Việt Nam (mạng gia đình), 3 lượt mỗi ca, từ chưa từng gọi.

## Số đo

| Nguồn | Từ đơn (byte đầu) | Câu ~80 ký tự | Ghi chú |
|---|---|---|---|
| Google Translate `translate_tts` (không chính thức) | 0.33 đến 0.44 s | 0.28 đến 0.41 s | Gọi thẳng từ trình duyệt, ~11 KB/từ |
| Youdao `dictvoice` (không chính thức) | 0.38 đến 0.55 s | 0.57 đến 0.65 s | US/UK, giọng từ điển |
| Edge TTS (edge-tts 7.3.1, không chính thức) | 0.53 đến 0.65 s tới audio đầu | 0.53 đến 1.14 s | Từ IP gia đình; IP datacenter có thể bị chặn |
| App hiện tại, file đã cache, qua `/api/tts` (omp đo) | 1.3 s | - | Function Vercel ở iad1 |
| App, file đã cache, URL CDN trực tiếp (omp đo) | 0.11 s | - | Không qua route |
| App, cache trình duyệt (omp đo) | 0.01 s | - | |
| App, từ mới qua Kokoro (omp đo) | 2.9 s | 9.6 s | |
| Free Dictionary API | không có audio cho "perseverance" | - | Không phải từ nào cũng có |

## Các app học tiếng Anh mã nguồn mở dùng gì

| App | Sao | TTS |
|---|---:|---|
| Qwerty Learner | ~24k | Youdao dictvoice, gọi thẳng từ trình duyệt |
| Earthworm (nguồn của Julebu) | ~11k | Youdao dictvoice (`apps/client/composables/user/pronunciation.ts`) |
| Read Frog | ~10.5k | Edge TTS |
| Word Atlas (7.298 từ IELTS) | ~5.4k | **ElevenLabs `eleven_v4_turbo` sinh sẵn một lần** (UK + US), phát file tĩnh (`scripts/atlas/gen_word_audio.py`) |
| MuJing | ~4.9k | Youdao |
| Echo Loop | ~5k | TTS của hệ điều hành (flutter_tts) + Piper chạy trên máy, có bảng cache |
| Enjoy | ~40k | AI TTS trả phí bằng key người dùng; edge-tts cho phát âm từ vựng |

## Kết luận

- Nguồn trực tiếp nhanh nhất là Google Translate (~0.35 s), rồi Youdao, Edge. Cả ba đều **không chính thức**: không có điều khoản cho phép, có thể bị chặn hoặc giới hạn theo IP bất cứ lúc nào (openai.fm của app vừa gặp đúng chuyện này).
- Nhanh hơn tất cả là **file sinh sẵn trên CDN** (0.11 s) hoặc đã nằm trong cache trình duyệt (0.01 s). Đây là cách Word Atlas làm.
- Lựa chọn chính thức, miễn phí: **Google Cloud Text-to-Speech** (cần bật billing): 4 triệu ký tự/tháng miễn phí cho giọng Standard và WaveNet, 1 triệu cho Neural2/Chirp 3 HD (theo trang giá, cần kiểm lại trên trang live). Đủ để sinh sẵn toàn bộ ~170.000 ký tự nội dung và phục vụ từ mới của người dùng. Chưa đo độ trễ vì cần key.

## Nguồn

- https://github.com/RealKai42/qwerty-learner
- https://github.com/cuixueshe/earthworm
- https://github.com/designfuchen/word-atlas
- https://github.com/tangshimin/MuJing
- https://github.com/echo-loop/Echo-Loop
- https://github.com/mengxi-ream/read-frog
- https://cloud.google.com/text-to-speech/pricing
- https://cloud.google.com/text-to-speech

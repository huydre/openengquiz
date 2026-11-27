# Thay thế Azure Speech bằng giải pháp miễn phí

Nghiên cứu ngày 27/11/2026, phục vụ phase 06 (luyện nói + chấm phát âm) và TTS của phase 02. Giá và hạn mức lấy từ bài viết/trang dự án, có chỗ mâu thuẫn; kiểm tra lại trang gốc trước khi chốt.

## Azure cần thay 3 việc

| Việc | Dùng ở đâu | Khó thay? |
|---|---|---|
| Chuyển giọng nói thành chữ (STT) | Luyện nói tự do với AI, AI Call | Dễ |
| Chấm phát âm theo câu mẫu (âm vị, độ trôi chảy) | Speaking, chấm phát âm | **Khó nhất** |
| Đọc chữ thành giọng (TTS) | Phát âm thẻ, Dictation, AI Call | Dễ |

Azure F0 chỉ miễn phí 5 giờ STT/tháng, hạn mức không nâng được; không tìm thấy hạn mức miễn phí riêng cho chấm phát âm. Với web miễn phí cho nhiều người dùng, F0 hết rất nhanh.

## Lựa chọn

### Chấm phát âm

| Lựa chọn | Ưu | Nhược |
|---|---|---|
| **Pronunciada** (Apache-2.0, model ZIPA CC BY 4.0) | Chấm theo câu mẫu, điểm 0 đến 1 cho câu, từng từ, từng âm; fluency, completeness, gợi ý lỗi; có chế độ trả JSON giống Azure (`pronunciada serve --azure-compat`); chạy CPU, model lượng tử 71 MB, RAM ~0.3 GB, ~65 ms/câu 1 luồng | Chỉ Python (không có bản WebAssembly) nên cần một server riêng; dự án nhỏ (21 sao); độ chính xác "ngang Azure" là tự công bố |
| **OpenPronounce** (Wav2Vec2 + DTW) | Có endpoint `POST /pronunciation`, điểm accuracy/fluency/prosody, chỉ ra từ sai và âm nghe được | License không thống nhất (bản gốc AGPL-3.0, AGPL ép công khai mã nếu chạy dịch vụ); cũng phải tự host |
| Whisper + so khớp chữ | Không cần model riêng | Chỉ biết từ nào sai/thiếu, không chấm được âm vị; Whisper hay tự "sửa" giọng sai thành đúng |

### STT

| Lựa chọn | Ghi chú |
|---|---|
| **Groq Whisper** (free tier) | Whisper Large V3/Turbo, không cần thẻ; khoảng 20 request/phút, 2.000/ngày, 28.800 giây audio/ngày, file tối đa 25 MB (số liệu từ bài so sánh, cần xác minh). Gọi từ server, hợp với Vercel |
| Web Speech API của trình duyệt | Miễn phí, không cần key; chỉ Chrome/Edge/Safari, chất lượng và quyền riêng tư phụ thuộc trình duyệt; tốt làm phương án dự phòng |
| AssemblyAI / Deepgram | Chỉ là credit dùng thử một lần, không phải miễn phí lâu dài |

### TTS

| Lựa chọn | Ghi chú |
|---|---|
| **Kokoro 82M** (Apache-2.0) | Giọng tự nhiên nhất trong nhóm miễn phí, 28 giọng Anh-Mỹ/Anh-Anh, chạy CPU; chạy được cả trên trình duyệt (WebGPU/WASM) nhưng model ~80 MB, nặng cho điện thoại |
| Piper | Nhẹ hơn, giọng máy hơn; license engine đang tranh cãi (MIT hay GPL-3.0) |
| `speechSynthesis` của trình duyệt | Đang dùng; miễn phí, chất lượng tuỳ máy |

Gemini API có thể có free tier cho audio/TTS nhưng nguồn mâu thuẫn và hạn mức free hay đổi; không nên làm phương án chính.

## Đề xuất

Một **dịch vụ giọng nói tự host trên Hugging Face Spaces (CPU miễn phí)** + Groq cho STT:

```text
Trình duyệt ──ghi âm──> Next.js (server, kiểm quota) ──┬─> Groq Whisper (STT, free tier)
                                                        └─> HF Space: Pronunciada (chấm phát âm)
                                                                     + Kokoro (TTS, sinh 1 lần, cache Supabase Storage)
Trình duyệt: speechSynthesis / Web Speech API làm dự phòng khi dịch vụ lỗi
```

- Luyện đọc câu mẫu: gửi audio + câu mẫu tới Pronunciada.
- Nói tự do: Groq Whisper ra chữ → DeepSeek sửa ngữ pháp → Pronunciada chấm với chính bản chữ đó làm câu mẫu.
- TTS: Kokoro sinh mỗi từ/câu một lần, lưu Supabase Storage, lần sau dùng lại. Chi phí gần như 0.

Rủi ro cần chấp nhận:
- Space miễn phí ngủ khi lâu không dùng, lần gọi đầu chậm (cold start); CPU dùng chung nên giờ cao điểm có thể chậm.
- Pronunciada còn mới: cần **thử với giọng người Việt** trước khi chốt (10 đến 20 bản ghi, so với cảm nhận/Azure).
- Groq free tier có thể đổi chính sách: giữ Web Speech API làm dự phòng.

## Đã chốt (27/11/2026)

User có VPS riêng nên **không dùng HF Spaces**: Pronunciada + Kokoro chạy Docker trên VPS (`services/speech/`, xem README). Đã thử: giọng Mỹ đúng 99%, đọc sai từ 73% (bắt đúng 2 từ sai), giọng Việt (TTS macOS) 73% với lỗi /ð/, /ɜ˞/, /eɪ/; chấm ~0,6 s/câu, TTS ~0,5 đến 1,4 s, RAM ~630 MB.

Còn mở:
- File webm/opus (định dạng trình duyệt ghi) cho điểm thấp hơn wav cùng nội dung (0,46 so với 0,73): kiểm tra lại bằng bản ghi thật từ trình duyệt; nếu lệch, cho trình duyệt ghi WAV/PCM.
- ~~HTTPS công khai cho production~~: đã mở `https://speech.techlaai.io.vn` qua Cloudflare Tunnel (27/11/2026).
- STT cho nói tự do: Groq Whisper (cần key) hoặc Web Speech API.

## Việc tiếp theo (bản gốc của đề xuất)

1. Thử nghiệm nhanh (spike): chạy Pronunciada local, ghi 10 đến 20 câu giọng Việt, xem điểm có hợp lý không.
2. Tạo HF Space (Docker) chạy Pronunciada + Kokoro, bảo vệ bằng token bí mật để chỉ server app gọi được.
3. Tạo key Groq (miễn phí).
4. Cập nhật plan: thay Azure trong `plan.md`, phase 02 (TTS) và phase 06.

## Nguồn

- [Pronunciada](https://pronunciada.dev/), [GitHub moglearn/pronunciada](https://github.com/moglearn/pronunciada)
- [OpenPronounce](https://github.com/Halleck45/OpenPronounce), [openpronounce.github.io](https://openpronounce.github.io/)
- [Free Speech-to-Text APIs (2026): Real Limits Compared](https://spokenly.app/blog/free-speech-to-text-apis), [Free Whisper API Tested](https://toolfreebie.com/free-whisper-api-compared/), [AssemblyAI: best free STT APIs 2026](https://www.assemblyai.com/blog/the-top-free-speech-to-text-apis-and-open-source-engines)
- [Best Open Source TTS Models 2026](https://micdrop.dev/blog/top-open-source-text-to-speech-models), [Kokoro Web](https://github.com/eduardolat/kokoro-web), [Chrome built-in TTS và TTS miễn phí trên trình duyệt](https://mer.vin/2026/11/chrome-built-in-neural-tts-free-browser-text-to-speech/)
- [Azure Speech quotas and limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits), [Azure Speech pricing](https://azure.microsoft.com/en-gb/pricing/details/cognitive-services/speech-services/)
- [Gemini API free tier 2026](https://apidog.com/blog/gemini-api-free-tier/), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits.md.txt)

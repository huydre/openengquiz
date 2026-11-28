# Research: các nền tảng học tiếng Anh miễn phí dùng TTS nào

Ngày 2026-11-28. Nguồn: mã nguồn GitHub (đọc trực tiếp), issue tracker, bài so sánh 2026. Bị giới hạn tốc độ GitHub code search giữa chừng nên vài repo chưa soi hết.

## Các app đang dùng gì

| App | Sao GitHub | TTS | Ghi chú |
|---|---:|---|---|
| Qwerty Learner (`RealKai42/qwerty-learner`) | ~24k | **Youdao dictvoice** `dict.youdao.com/dictvoice?audio=<từ>&type=1/2` (UK/US) | Gọi thẳng từ trình duyệt bằng `<audio preload=auto>`; không server, không cache riêng. API không chính thức. |
| Read Frog (`mengxi-ream/read-frog`) | ~10.5k | **Edge TTS** (giọng neural của Microsoft Edge "Read aloud") | `src/entrypoints/background/edge-tts.ts`; chạy trong extension trên máy người dùng. Endpoint không chính thức. |
| Enjoy / everyone-can-use-english (`ZuodaoTech/...`) | ~40k | AI TTS trả phí (OpenAI/Azure) bằng key của người dùng; notebook phát âm từ vựng dùng **edge-tts** | Tạo audio một lần rồi lưu thành tài nguyên. |
| Anki (HyperTTS add-on) | - | Tổng hợp nhiều dịch vụ: Google, Edge, Azure, Forvo... | Sinh audio một lần, lưu kèm thẻ. |
| OpenQuiz | - | Backend riêng `/api/tts/get-word-mp3` | Cache MP3 theo từ. |
| OpenEngQuiz (mình) | - | openai.fm (GPT-4o mini TTS, không chính thức) + Kokoro tự host | Cache MP3 trong Supabase Storage. |

Điểm chung của các app nhanh: **audio được tạo một lần và phát thẳng từ CDN/cache** (hoặc từ một endpoint từ điển có sẵn), không sinh lại mỗi lần bấm.

## Các lựa chọn TTS miễn phí

| Lựa chọn | Chất lượng | Độ trễ | Rủi ro |
|---|---|---|---|
| Edge TTS (không chính thức) | Rất tốt (neural, nhiều giọng US/UK) | Nhanh | Microsoft chặn bản cũ bằng 403 từ 10/2026, phải nâng edge-tts 7.3.x; IP datacenter/VPN hay bị chặn; không có điều khoản cho phép dùng. Không hợp làm nguồn chính trên server. |
| Youdao dictvoice (không chính thức) | Tốt cho **từ đơn** (giọng từ điển) | Nhanh, gọi thẳng từ trình duyệt | Không có điều khoản; máy chủ Trung Quốc; không đọc tốt câu dài. |
| Kokoro-82M (Apache 2.0) | Tốt nhất trong nhóm mã nguồn mở | Chậm trên CPU yếu (đo VPS mình: 2.7 đến 3.5 s/từ) | Sạch giấy phép. Đã chạy sẵn. |
| Piper (engine GPL-3.0, giọng mỗi cái một giấy phép) | Khá | Nhanh hơn Kokoro trên CPU | Giấy phép GPL cho engine, cần kiểm từng giọng. |
| Kitten TTS Nano 0.8 (Apache 2.0) | Trung bình | Nhẹ nhất nhưng không nhanh hơn | Đừng nhầm với Kitten TTS 2 (giới hạn thương mại). |
| Web Speech API (`speechSynthesis`) | Tuỳ máy | Gần như tức thì | Giọng khác nhau giữa các máy. App đã dùng làm fallback khi lỗi. |
| Free Dictionary API (bản ghi thật) | Người thật đọc | Nhanh | Không tìm thấy giấy phép cho file audio; không phải từ nào cũng có. |

## Kết luận

1. Không có dịch vụ TTS **vừa miễn phí, vừa chính thức, vừa nhanh** để gọi trực tiếp lúc phát. Các app nhanh đều **sinh trước và cache**, hoặc dựa vào endpoint không chính thức (Youdao, Edge).
2. Với mình, độ trễ hiện tại chủ yếu do kiến trúc chứ không do engine: function Vercel chạy ở Mỹ (iad1), route `/api/tts` thêm khoảng 1.2 s cho từ đã cache, và từ mới phải chờ sinh 3 đến 8 s. Đổi engine không giải quyết được hai điểm này.
3. Khuyến nghị: giữ **Kokoro tự host** (giấy phép sạch, đã chạy) làm engine, kết hợp: chuyển function Vercel sang `sin1`, trình duyệt lấy thẳng file từ CDN Supabase, sinh sẵn audio cho thẻ khoá học/lộ trình và thẻ người dùng khi lưu. Khi đó gần như mọi lần bấm loa chỉ còn khoảng 0.2 s, engine nào cũng được.
4. Tuỳ chọn: dùng **Edge TTS chỉ ở bước sinh trước** (chạy từ máy hoặc VPS, có fallback Kokoro) nếu muốn giọng đẹp hơn, chấp nhận rủi ro endpoint không chính thức. Không nên để người học phụ thuộc trực tiếp vào nó lúc phát.

## Nguồn

- https://github.com/RealKai42/qwerty-learner (`src/hooks/usePronunciation.ts`)
- https://github.com/mengxi-ream/read-frog (`src/entrypoints/background/edge-tts.ts`)
- https://github.com/ZuodaoTech/everyone-can-use-english
- https://github.com/Vocab-Apps/anki-hyper-tts
- https://github.com/rany2/edge-tts
- https://github.com/NousResearch/hermes-agent/issues/140990 (Edge TTS 403 từ 10/2026)
- https://github.com/danieldang7ngo-design/Superfreetts/issues/5
- https://picovoice.ai/blog/on-device-tts/
- https://localaimaster.com/blog/best-local-tts-models
- https://texttolab.com/blog/open-source-text-to-speech
- https://github.com/limone308/freeDictionaryAPI

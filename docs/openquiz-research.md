# Research OpenQuiz.ai: Sản phẩm, công nghệ, mô hình kinh doanh

- Cập nhật: 26/11/2026
- Phương pháp: research trước đó (tổng hợp nguồn public) + **kiểm chứng trực tiếp bằng Playwright** trên `https://openquiz.ai` (đã đăng nhập, tài khoản free), đọc bundle JS public, header HTTP của backend.
- Ký hiệu: ✅ đã kiểm chứng trực tiếp · 📄 theo nguồn công bố/bên thứ ba · 💡 suy luận / đề xuất thiết kế.

---

## 0. Tóm tắt nhanh (TL;DR)

| Hạng mục | Kết luận |
|---|---|
| Định vị | "Learn the word. Then say it." - flashcard miễn phí + AI luyện nói dùng chính từ vừa học ✅ |
| Core loop | Bộ từ (study set) → 9 chế độ học → SRS → Speaking/Hội thoại với AI ✅ |
| Mô hình | Freemium: học cơ bản free không giới hạn; AI giới hạn 3–5 lượt/tháng; Premium 199k/tháng · 349k/quý · 860k/năm ✅ |
| Frontend | React SPA build bằng Vite, Tailwind + Radix (shadcn), lucide icons, Lottie ✅ |
| Backend | Python (dấu hiệu FastAPI), host trên **Railway**, sau Cloudflare; request ký HMAC ✅ |
| Auth | Firebase Authentication (Google/Apple) + Firebase Messaging ✅ |
| AI/Voice | STT realtime qua **ElevenLabs** (socket.io, PCM 16 kHz); TTS có fallback Web Speech API ✅ |
| Thanh toán web | **SePay** - chuyển khoản VietQR; mobile qua App Store / Google Play ✅ |
| Điểm mới so với research cũ | MCP server `mcp.openquiz.ai` cho ChatGPT/Claude/Gemini; hệ gamification (streak, freeze, coins, shop, lootbox, ranking); hạn mức Free cụ thể ✅ |

---

## 1. Tổng quan

| Thông tin | Chi tiết |
|---|---|
| Sản phẩm | OpenQuiz AI - Web · iOS · Android · Chrome Extension ✅ |
| Doanh nghiệp | Công ty TNHH OpenQuiz, MST 2902266403, Nghệ An, hoạt động từ 04/03/2026 📄 |
| Ngôn ngữ giao diện | en, vi, ko, zh, zh-Hant (+ landing ja, th) ✅ |
| Số liệu tự công bố | 120K người học/tháng, 100M từ đã được nói, 50+ ngôn ngữ, Top #4 App Store & Top #5 Google Play (Aug 2026) ✅ (hiển thị trên landing, chưa kiểm toán độc lập) |
| Bên thứ ba | Android 100K+ lượt tải, Extension ~30K users, Top 9 Education VN (AppInsider) 📄 |
| Kênh cộng đồng | Facebook, Discord, TikTok, Instagram, Threads ✅ |
| Sứ mệnh (About) | "Help 10 million learners turn passive vocabulary into active speaking fluency" ✅ |
| Đối thủ | Trực tiếp: Quizlet, Anki, Knowt · Gián tiếp: Duolingo, ELSA Speak, Speak |

---

## 2. Bài toán & Value Proposition

Pain point gốc (trang About ✅): người học đọc hiểu tốt, thi điểm cao nhưng **đơ khi phải nói** - công cụ cũ (Quizlet, Anki) chỉ tối ưu ghi nhớ thụ động.

| Vấn đề | Giải pháp OpenQuiz |
|---|---|
| Học trước quên sau | SRS (Again/Hard/Good/Easy) ✅ |
| Tốn thời gian tạo thẻ | Tạo bộ từ bằng ảnh/AI, tra từ tự động điền IPA/nghĩa/ví dụ ✅ |
| Biết từ nhưng không nói được | Speaking mode: AI hỏi, bắt dùng từ mục tiêu trong câu trả lời ✅ |
| Không biết phát âm đúng/sai | Đánh giá phát âm theo từ, so sánh "Bạn nói" vs "AI phát âm" ✅ |
| Không có người luyện | Chế độ Hội thoại (chat thread + voice) ✅ |
| Không biết học gì | Lộ trình gợi ý theo ngôn ngữ/kỳ thi/trình độ ✅ |
| Giáo viên khó theo dõi | Lớp học, giao bài, chấm bài, ghi âm bài nộp, xếp hạng ✅ |
| Khó duy trì thói quen | Streak, freeze, coins, ranking tháng, lootbox ✅ |

**Core insight:** một đơn vị dữ liệu (từ vựng) được tái sử dụng cho mọi chế độ học. Một thẻ thực tế ✅:

```json
{
  "term": "adopt",
  "wordType": "verb",
  "pronunciation": "/ə'dɒpt/",
  "synonyms": ["take in", "embrace", "accept"],
  "definition": "nhận nuôi",
  "example": "They decided to adopt a child from another country.",
  "imageUrl": null,
  "srsState": "new | learning | review | relearning",
  "dueDate": "...",
  "lastReviewedAt": "..."
}
```

---

## 3. Tính năng (đã kiểm chứng trên UI và route của app)

### 3.1. Chế độ học trên một bộ thẻ ✅

Trang `/study-set/:id` hiển thị 9 tab:

| Tab UI | Route | Ghi chú |
|---|---|---|
| Kết hợp | `/comprehensive/:id` | Bài học tổng hợp nhiều dạng, chia lesson |
| Đề xuất | `/ai-study/:id` | AI gợi ý cách học |
| Speaking | (PronunciationAssessment) | Nói câu dùng từ, chấm phát âm, sửa ngữ pháp, gợi ý trình độ (B1…) |
| Hội thoại | `/conversation/:id/:threadId` | Chat thread với AI, có lịch sử |
| Ngữ pháp | `/grammar/:id` | Dịch câu, chấm % đúng; lưu điểm ngữ pháp (`/saved-grammar`) |
| Đọc hiểu | `/reading/:id` | Đoạn văn sinh từ bộ từ |
| Học | `/study/:id` | Learn mode: trắc nghiệm, điền từ, nghe chép, phân đoạn |
| Test/Game | `/exam/:id`, `/game/:gameType/:id` | Bài test + game có điểm (`/game/score`) |
| Nghe chép | `/dictation/:id` | Nghe và gõ từ / định nghĩa |

Ngoài ra: flip card (phím ←/→, Space), sắp xếp theo trạng thái, đánh dấu sao, **luyện viết tay + in PDF** (`/writing-practice/:id/print`), canvas viết tự do (FreehandWritingCanvas cho chữ Hán/Kanji).

### 3.2. Thuật toán "Học" (Learn mode) ✅: đọc từ bundle `studyAlgorithm`

- Thẻ có 3 trạng thái phiên: `not-started` / `learning` / `mastered`.
- Số phân đoạn = `ceil(n / 7 * 2)`; cỡ phân đoạn **4, 5 hoặc 7 thẻ** tùy tỷ lệ đã thành thạo (>70% → 4, >50% → 5, còn lại 7).
- Phân đoạn sau trộn: tối đa 4 thẻ vừa trả lời sai + tối đa 3 thẻ mới + thẻ đang học.
- Nếu >30% đã thành thạo, chèn lại ~15% thẻ mastered để ôn xen kẽ.
- Loại câu hỏi random theo hướng: term→definition, definition→term, synonym, pronunciation; 4 đáp án (1 đúng + 3 nhiễu lấy từ cùng bộ).

→ Logic thuần client, không cần AI - đúng nguyên tắc "không dùng AI cho thứ backend/logic làm được".

### 3.3. Spaced Repetition ✅

- Trang `/repetition-study` (theo bộ thẻ hoặc cả lộ trình), nút **Again / Hard / Good / Easy**.
- State: `new → learning → review`, sai thì `relearning`; server trả `due_date`, `isDueToday` (API `/user-srs/summary`, `/user-srs/wsets`).
- Mô hình state trùng với Anki/FSRS; chưa xác định chính xác là FSRS hay SM-2 (tính lịch ở server). 💡
- Free: giới hạn **6 lượt ôn/ngày**, đếm trong `localStorage` (`repetition_daily_count`) ✅. Gói năm giữ SRS **trọn đời** kể cả khi hết hạn.

### 3.4. AI Speaking & phát âm ✅

- Ghi âm trên trình duyệt → `AudioContext` 16 kHz → PCM16 → stream qua **socket.io** tới `/elevenlabs-stt/socket.io` (proxy của backend tới ElevenLabs STT), nhận `fast_transcription_result` (text + phrases). Timeout 30s.
- Kết quả hiển thị: đã dùng từ đúng hay chưa, sửa ngữ pháp kiểu gạch-thay, mức CEFR, gợi ý trả lời dài hơn, từ phát âm chưa chuẩn ("người bản xứ nghe khó hiểu").
- TTS: dùng audio server; khi lỗi fallback `speechSynthesis` của trình duyệt; Free có giới hạn lượt nghe/ngày.
- Nhà cung cấp LLM và chấm phát âm: **chưa lộ ra phía client** (đều qua backend).

### 3.5. Lộ trình học ✅

- Tag tiếng Anh: IELTS, TOEIC, PTE, CELPIP, CEFR, For Work, Grammar, THPT (API `learning-paths/recommended?exam=…&user_level=…&native_lang=vi`).
- Ví dụ "Vocabulary For IELTS": 20 bộ, 1.142 từ, mỗi bộ ~57 từ theo chủ đề.
- Có tiếng Trung (HSK), Nhật (JLPT), Hàn (TOPIK); người dùng tự tạo lộ trình (`/create-learning-path`).
- Mở một lộ trình sẽ **tự động lưu** vào tài khoản ("Đã lưu lộ trình").
- Khoá học Speaking riêng (`/courses/:level/part/:n/lesson/:n`) - Free 1 bài.

### 3.6. Tạo nội dung ✅

- Tạo bộ thẻ thủ công, thêm ảnh (tìm/upload ảnh: `/image-search/upload`).
- Tạo bằng ảnh / AI (Free 5 lượt/tháng).
- Tra từ (`VocabularyLookupDialog`): kết hợp backend + nguồn ngoài (Google Translate endpoint, dictionaryapi.dev, freedictionaryapi, MyMemory) - dấu hiệu dùng API miễn phí để giảm chi phí.
- Thư mục bộ thẻ (`/wset-folders`), "Từ của tôi" (`/user-words`) lưu từ từ extension.

### 3.7. Chrome Extension 📄 + ✅

- Shadowing, nghe chép, đục lỗ, dịch trên YouTube/Netflix/web; lưu từ vào tài khoản. Free: shadowing 5 lượt/tháng, các tính năng còn lại không giới hạn ✅ (bảng giá).
- Có thêm "OpenQuiz Video" (video ngắn học từ) trên trang chủ ✅.

### 3.8. Lớp học (B2B2C) ✅

API cho thấy hệ thống lớp khá sâu: tạo lớp, mời học sinh, giao bộ thẻ/lộ trình, **thư viện bài tập**, bài làm có thời gian, **bài luận (essay)**, chấm điểm (`/submissions/:id/grade`), **ghi âm bài nộp**, thống kê theo từ, bảng xếp hạng bài tập. Free không giới hạn.

### 3.9. Gamification & tăng trưởng ✅ (chưa có trong research cũ)

| Cơ chế | Chi tiết |
|---|---|
| Streak | Chuỗi ngày học, hiệu ứng lửa |
| Freeze | Đóng băng streak (`/freeze/use`), mua bằng coins |
| Coins | Thưởng streak, milestone, rank tháng; Premium nhận **x2 coins** |
| Shop / Avatar | Mua vật phẩm, trang bị avatar |
| Lootbox | Mở hộp quà, có trang công bố tỷ lệ (`/lootbox/:code/odds`) |
| Ranking | Xếp hạng tháng, thưởng coin theo hạng |
| Referral | Mời bạn nhận Premium (`/referral/*`), gói Premium nhóm (`payment-qr-group/:plan/:groupSize`) |
| Campaign | Banner ưu đãi có đếm ngược + "còn 16/100 suất" |
| Thảo luận | `/discussion/:slug` - cộng đồng/UGC |

### 3.10. Kết nối AI qua MCP ✅ (điểm khác biệt mới)

- MCP server: `https://mcp.openquiz.ai/mcp` (HTTP transport).
- Hướng dẫn 1-click cho **ChatGPT** (plugin), **Claude** (custom connector + có trong Claude directory), **Claude Code** (`claude mcp add --transport http --scope user openquiz …`), **Gemini CLI**.
- Ý nghĩa: người dùng học/tạo bộ thẻ ngay trong chatbot → biến đối thủ "chatbot AI đa năng" thành kênh phân phối.

---

## 4. Mô hình kinh doanh & giá ✅

### 4.1. Bảng giá (trang `/pricing`, 26/11/2026)

| Gói | Giá | Quy đổi/tháng | Ghi chú |
|---|---|---|---|
| Miễn phí | 0đ | - | Không giới hạn bộ từ/lộ trình |
| Premium 1 tháng | 199.000đ | 199.000đ | |
| Premium 3 tháng | 349.000đ (gạch 540.000đ) | ~116.000đ | |
| Premium 1 năm | 860.000đ (gạch 1.188.000đ, "-60%") | ~72.000đ | Giữ **trọn đời** SRS + Ví dụ & từ đồng nghĩa |

Chính sách giá (24/11/2026) khớp các mức trên ✅. Mức cũ 159k/790k không còn xuất hiện.

### 4.2. Free vs Premium (hạn mức cụ thể) ✅

| Tính năng | Free | Premium |
|---|---|---|
| Nghe chép, chế độ "Học", tạo bộ thủ công, thêm ảnh, quản lý lớp | Không giới hạn | Không giới hạn |
| Speaking (luyện nói với từ) | 3 lượt/tháng | Không giới hạn |
| Hội thoại | 3 lượt/tháng | Không giới hạn |
| Ngữ pháp | 3 lượt/tháng | Không giới hạn |
| Đọc hiểu | 3 bài/tháng | Không giới hạn |
| Khoá học Speaking | 1 bài | Không giới hạn |
| Tạo bộ từ bằng ảnh/AI | 5 lượt/tháng | Không giới hạn |
| Đánh giá phát âm | 5 lượt/tháng | Không giới hạn |
| SRS | Giới hạn (6 lượt/ngày) | Không giới hạn (trọn đời với gói năm) |
| Ví dụ & từ đồng nghĩa | Bị giới hạn | Không giới hạn (trọn đời với gói năm) |
| Extension: nghe chép/đục lỗ/dịch | Không giới hạn | Không giới hạn |
| Extension: shadowing | 5 lượt/tháng | Không giới hạn |

Nhận xét: phân tách đúng theo **chi phí biên** - thứ không tốn AI thì free, thứ gọi STT/LLM/TTS thì giới hạn. "Trọn đời SRS" là đòn bẩy đẩy gói năm (tăng cash upfront, giảm churn cảm nhận).

### 4.3. Thanh toán ✅

- Web: **SePay / VietQR** (chuyển khoản ngân hàng quét QR, có form xuất hoá đơn) → thanh toán 1 lần theo kỳ. FAQ trang giá: "không tự động ràng buộc".
- App: App Store / Google Play auto-renew (admin dashboard có thống kê `apple/premium`, `google/premium`).
- ⚠️ Mâu thuẫn tài liệu: Trial Policy ghi "auto-renewable subscriptions", FAQ pricing ghi "không tự động ràng buộc" → thực tế khác nhau theo kênh (web one-off, store auto-renew) nhưng văn bản chưa nói rõ.
- Có gói Premium nhóm (`premium-group`) và Premium miễn phí qua referral/campaign.

### 4.4. Mô hình doanh thu giả định 💡

Dựa trên 120K MAU tự công bố, ARPPU giả định ~100.000đ/tháng (pha trộn gói năm ~72k và tháng 199k):

| Tỷ lệ trả phí | Người trả phí | MRR | ARR |
|---|---|---|---|
| 1% | 1.200 | 120tr | 1,44 tỷ |
| 3% | 3.600 | 360tr | 4,32 tỷ |
| 5% | 6.000 | 600tr | 7,2 tỷ |
| 10% | 12.000 | 1,2 tỷ | 14,4 tỷ |

Chưa trừ phí store (15–30%), thuế, chi phí AI, nhân sự, marketing. **Không phải doanh thu thực tế.**

### 4.5. Cơ cấu chi phí 💡

| Hạng mục | Mức | Cách OpenQuiz giảm (quan sát ✅) |
|---|---|---|
| STT realtime (ElevenLabs) | Cao | Giới hạn 3–5 lượt/tháng ở Free |
| LLM (hội thoại, ngữ pháp, đọc hiểu, sinh bộ từ) | TB–cao | Hạn mức + Premium |
| TTS | TB | Fallback Web Speech API, giới hạn nghe/ngày |
| Tra từ/dịch | Thấp | Dùng API free (dictionaryapi.dev, MyMemory, Google gtx) |
| Hosting (Railway), Cloudflare, Firebase | Thấp–TB | PaaS, không tự vận hành hạ tầng |

---

## 5. Kiến trúc kỹ thuật (quan sát thực tế) ✅

### 5.1. Sơ đồ

```
Browser (React SPA, Vite) ─┬─ Firebase Auth (identitytoolkit) / FCM
                           ├─ Cloudflare (openquiz.ai, bot challenge)
                           ├─ openquiz-be-production.up.railway.app  (REST /api/*, ký HMAC)
                           │     └─ /elevenlabs-stt/socket.io  → ElevenLabs STT
                           │     └─ LLM / TTS / chấm phát âm (ẩn sau backend)
                           ├─ openquiz-analytics-production.up.railway.app (event tracking riêng)
                           ├─ Microsoft Clarity (session replay/heatmap)
                           ├─ SePay (VietQR checkout)
                           └─ mcp.openquiz.ai/mcp  ← ChatGPT / Claude / Gemini
```

### 5.2. Stack

| Layer | Công nghệ | Bằng chứng |
|---|---|---|
| Frontend | React, Vite, code-splitting theo route (~200 chunk) | `assets/vendor-react-*.js`, comment build `landing/build.mjs … vite` |
| UI | Tailwind, Radix/shadcn (sheet, popover, accordion…), lucide icons, Lottie | Tên chunk |
| Landing SEO | HTML tĩnh sinh từ template, đa ngôn ngữ, OG/Twitter meta | `/vi/`, `/en/...-vocabulary/` |
| Backend | Python, nhiều khả năng **FastAPI** | Lỗi `{"detail":"Not Found"}`, `/docs` & `/openapi.json` đã tắt |
| Hosting | Railway (edge hkg1), có môi trường `-dev` | Header `server: railway-hikari` |
| Bảo vệ API | `X-Request-Signature` HMAC + timestamp | `{"detail":"Missing request signature"}` |
| Auth | Firebase Auth (Google/Apple), Firebase Messaging | `vendor-firebase`, `identitytoolkit` |
| Realtime | socket.io (websocket/polling) | `sttCapture` chunk |
| Feature flags | localStorage `oq-flag-*` | `appFlags` chunk |
| Analytics | Clarity + service analytics tự viết | network requests |
| Mobile | App iOS/Android riêng (kênh billing store) | Store links |

### 5.3. API surface (rút gọn từ bundle) ✅

| Domain | Endpoint tiêu biểu |
|---|---|
| User | `/user-info/`, `/user-info/settings`, `/user-activities/list` |
| Bộ từ | `/words/wset`, `/words/wsets/studying`, `/wset-folders/move` |
| Lộ trình | `/learning-paths/recommended`, `/learning-paths/saved`, `/learning-paths/tags` |
| SRS | `/user-srs/summary`, `/user-srs/wsets` |
| AI chat | `/chat/threads`, `/chat/threads/:id/messages` |
| Khoá học | `/courses/available`, `/courses/progress` |
| Lớp học | `/classes/:id/exercises/:eid/submissions/:sid/grade`, `/recording`, `/ranking`, `/word-stats` |
| Gamification | `/freeze/use`, `/shop/items`, `/shop/purchase`, `/lootbox/open`, `/game/session/start` |
| Tăng trưởng | `/referral/claim`, `/user-campaigns/active-campaign`, `/premium-group/*` |
| MCP | `/mcp/connections` |
| Admin | `/admin/campaigns`, `/admin/ads`, `/admin/apple|google/premium/daily-stats` |

### 5.4. Quan sát về bảo mật / chất lượng ⚠️

- **Bí mật HMAC nằm ở client** → chỉ chống scraping thô, không phải cơ chế bảo mật thực sự.
- **Hạn mức SRS Free đếm ở localStorage** - nếu server không kiểm lại thì có thể vượt bằng cách xoá storage (chưa kiểm chứng phía server, không thử).
- Route và API **admin nằm trong bundle public** (`/admin`, `/admin/pitch-deck/:variant`, thống kê doanh thu store) - an toàn chỉ khi server phân quyền chặt.
- Firebase web API key public là bình thường (bảo vệ bằng rules/authorized domains).

---

## 6. Thị trường & tăng trưởng

| Kênh | Bằng chứng |
|---|---|
| SEO programmatic | Hàng loạt landing: `/en/korean-vocabulary/`, `/en/japanese-grammar/`, `/en/quizlet-alternatives/`, `/vi/tu-vung-hsk/`, blog, learning-guides, worksheet in được ✅ |
| Social video | TikTok, Threads, Instagram, nhúng video review trên landing ✅ |
| Extension | Gặp người học tại YouTube/Netflix ✅ |
| AI assistants (MCP) | ChatGPT/Claude/Gemini connector ✅ |
| Classroom | Giáo viên kéo học sinh vào ✅ |
| Referral / Premium nhóm | Mời bạn, mua theo nhóm ✅ |
| Gamification | Streak/coins/ranking giữ chân ✅ |
| Urgency marketing | Banner "còn 16/100 suất" + đếm ngược; giá trị "16/100" không đổi giữa các lần tải trang trong phiên ✅ - nhiều khả năng là FOMO cố định |

Growth loop 💡: Bộ thẻ do người dùng/giáo viên tạo → chia sẻ, SEO, lớp học → người mới → học free → chạm hạn mức AI → Premium.

---

## 7. So sánh đối thủ

| Tiêu chí | OpenQuiz | Quizlet | Anki | Knowt |
|---|---|---|---|---|
| Flashcard | Có | Có | Có | Có |
| SRS | Có (Again/Hard/Good/Easy) | Học thích ứng | Rất sâu (FSRS) | Có |
| AI tạo tài liệu | Có (ảnh/AI) | Có | Qua add-on | Có |
| AI luyện nói + chấm phát âm | **Trọng tâm** | Không | Qua add-on | Không |
| Lớp học + chấm bài nói | Có | Có | Không | Có |
| Gamification | Streak, coins, shop, lootbox | Ít | Không | Ít |
| Kết nối chatbot (MCP) | **Có** | - | - | - |
| Thanh toán nội địa | VietQR | Thẻ quốc tế | Free (iOS trả phí) | Thẻ |
| Đối tượng | Người học ngoại ngữ (VN trước) | Học nói chung | Người cần ghi nhớ | Học sinh/SV |

Khoảng trống OpenQuiz khai thác: **giao điểm app ghi nhớ × app luyện nói AI**, cộng lợi thế bản địa (giao diện Việt, VietQR, lộ trình THPT).

---

## 8. UI/UX

- Giao diện dark, sidebar trái: Trang chủ · Khoá học · Đã tạo · Lớp học · Xếp hạng · Tra từ · Tạo bộ thẻ · Tạo lộ trình · Hình nền · Báo lỗi ✅.
- Trang chủ (đã đăng nhập): banner ưu đãi, lộ trình gợi ý theo tag, khoá học, "Truy cập gần đây", promo Video/Extension/Referral/App ✅.
- Onboarding có tour (`useDriverTour`), onboarding-practice cho người mới ✅.
- Study set: nhiều tab chế độ ngang hàng → mạnh về lựa chọn nhưng dễ gây bối rối người mới (có tab "Đề xuất" để giảm tải) 💡.
- Paywall dạng overlay khóa + "LockedWordsTeaser" (che bớt từ trong SRS) ✅.

| Điểm mạnh | Rủi ro |
|---|---|
| Một bộ từ - mọi cách học | 9 chế độ dễ quá tải lựa chọn |
| Phản hồi nói cụ thể (ngữ pháp, phát âm, CEFR) | Hạn mức 3 lượt/tháng chạm paywall rất sớm |
| Gamification đầy đủ | Lootbox + FOMO countdown có thể gây phản cảm / rủi ro quy định |
| Bản địa hóa VN tốt | Văn bản chính sách gia hạn chưa nhất quán |

---

## 9. Bảo mật & quyền riêng tư 📄

- Privacy Policy: thu thập tài khoản, dữ liệu học, nội dung tạo, ảnh, **bản ghi âm và transcript**; chia sẻ với nhà cung cấp AI/thanh toán/hạ tầng; không bán dữ liệu; cho phép xoá tài khoản.
- Hoàn tiền: chủ yếu cho lỗi kỹ thuật chưa khắc phục, yêu cầu trong 7 ngày.
- Quan sát thêm ✅: Microsoft Clarity ghi session (cần nêu trong policy/consent); giọng nói đi qua bên thứ ba (ElevenLabs).

---

## 10. SWOT

| S - Điểm mạnh | W - Điểm yếu |
|---|---|
| Speaking gắn với từ vựng cá nhân | Chi phí STT/LLM theo lượt |
| Free tier rộng cho học cơ bản | Phụ thuộc ElevenLabs/LLM bên thứ ba |
| Stack PaaS gọn, ship nhanh (Railway, Firebase) | Một số kiểm soát quan trọng nằm ở client |
| Gamification + lớp học + MCP | Thông tin chính sách gia hạn mâu thuẫn |
| Thanh toán VietQR, nội dung THPT/IELTS | Chưa có bằng chứng độc lập về hiệu quả học |

| O - Cơ hội | T - Thách thức |
|---|---|
| Mở rộng quốc tế (đã có ko/zh/ja/th) | Quizlet/Knowt thêm AI speaking |
| B2B trung tâm ngoại ngữ (lớp, chấm bài nói) | ChatGPT/Gemini voice mode miễn phí |
| Phân phối qua chatbot (MCP) | Giá API biến động |
| Ngách chuyên ngành (y tế, kỹ thuật, business đã có) | Quy định lootbox/quảng cáo khan hiếm |

---

## 11. Bài học khi xây sản phẩm tương tự 💡

1. **Data model trung tâm**: `word` (kiến thức dùng chung) tách khỏi `review_state` (trạng thái theo user) - OpenQuiz trả `srsState`, `dueDate` theo user ✅.
2. **Logic thuần trước, AI sau**: Learn mode, quiz, nhiễu đáp án đều là thuật toán client ✅; chỉ dùng AI cho nói/hội thoại/sinh nội dung.
3. **Paywall theo chi phí biên** + quota theo tháng; enforce ở server.
4. **Stream audio** (PCM16 16 kHz qua websocket) để giảm độ trễ STT ✅.
5. **Tận dụng API miễn phí/fallback** (Web Speech TTS, dictionary API) để hạ chi phí.
6. **Kênh phân phối mới**: MCP server cho chatbot, extension, SEO programmatic.
7. **MVP stack gợi ý** (Java dev): Spring Boot modular monolith + PostgreSQL + Redis; hoặc theo OpenQuiz: FastAPI + Railway + Firebase Auth để ship nhanh.

### Roadmap MVP tham khảo (12 tuần, 1 dev) 💡

| Ưu tiên | Tính năng |
|---|---|
| P0 | Auth, Study Set, Flashcard, Learn mode, Quiz, Dictation |
| P0 | SRS (FSRS) + tiến độ |
| P1 | AI tạo bộ từ từ văn bản/ảnh |
| P1 | Speaking: STT streaming + LLM chấm dùng từ/ngữ pháp |
| P2 | Hội thoại, phát âm, lớp học, thanh toán VietQR |
| P3 | Gamification, extension, MCP server, mobile |

### KPI nên đo

MAU/DAU, activation (hoàn thành phiên đầu), D1/D7/D30, review completion, speaking completion, free→paid, churn, LTV/CAC, **AI cost per session**, MRR/ARR. North Star 💡: số từ người dùng **dùng đúng trong câu nói** sau N ngày.

---

## 12. Đánh giá tổng thể (chủ quan)

| Tiêu chí | Điểm |
|---|---|
| Ý tưởng / định vị | 9/10 |
| Giá trị cho người dùng | 8.5/10 |
| Ứng dụng AI | 8.5/10 |
| Độ rộng tính năng | 9/10 |
| Mô hình kinh doanh | 8.5/10 |
| Kỹ thuật (tốc độ ship) | 8/10 |
| Rào cản sao chép | 6/10 |

Điều đáng học nhất: **một đơn vị kiến thức → nhiều cách học → SRS → dùng thật (nói) → phản hồi**, bọc bởi gamification và nhiều kênh phân phối.

---

## 13. Nguồn

| Nguồn | Dùng cho |
|---|---|
| https://openquiz.ai/ (đăng nhập, Playwright) | Trang chủ, lộ trình, study set, chế độ học |
| https://openquiz.ai/pricing | Giá, hạn mức Free/Premium |
| https://openquiz.ai/vi/ | Landing, số liệu tự công bố |
| https://openquiz.ai/en/about.html | Sứ mệnh, câu chuyện |
| https://openquiz.ai/vi/pricing-policy.html | Chính sách giá 24/11/2026 |
| https://openquiz.ai/en/trial-policy.html | Free plan, auto-renew |
| https://openquiz.ai/en/privacy-policy.html, refund-policy.html | Quyền riêng tư, hoàn tiền |
| Bundle JS public `openquiz.ai/assets/*` | Route, API, thuật toán, nhà cung cấp |
| Header backend `openquiz-be-production.up.railway.app` | Hosting, framework |
| Google Play, App Store, Chrome Web Store, masothue.com, Stringers, AppInsider | Số liệu bên thứ ba (từ research trước) |

## Giới hạn & câu hỏi còn mở

- Chưa dùng thử Speaking/Hội thoại (tránh tiêu hết lượt Free) nên chất lượng chấm chưa đánh giá trực tiếp.
- Chưa xác định: nhà cung cấp LLM, TTS, chấm phát âm; thuật toán SRS chính xác (FSRS hay SM-2); server có enforce hạn mức SRS hay không.
- Doanh thu, số người trả phí, quy mô đội ngũ, vốn: không có dữ liệu public.
- Tab Orca `d9e57e0d-…` không tồn tại trong Orca browser lúc research; đã dùng browser của Playwright MCP (đang đăng nhập sẵn).

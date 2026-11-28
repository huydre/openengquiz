# Code Standards

## UI

### Phong cách: edtech vui tươi (kiểu Duolingo, nhận diện riêng)

Chỉ lấy *phong cách chung*; **không** dùng màu đặc trưng, linh vật, font hay minh hoạ của Duolingo.

| Thành phần | Quy ước |
|---|---|
| Màu | `primary` xanh lá mạ `#72C700`, `secondary` xanh trời, `accent`/`brand-orange` cam nắng, `brand-grape` tím; mỗi màu nút có biến `-edge` (cạnh đáy tối hơn) |
| Font | Nunito (subset `vietnamese`), tiêu đề `font-extrabold`/`font-black` |
| Nút | Dày, `rounded-2xl`, chữ in hoa đậm, cạnh đáy `shadow-[0_4px_0_var(--primary-edge)]`, bấm thì lún (`active:translate-y-1 active:shadow-none`), đã đặt sẵn trong `src/components/ui/button.tsx` |
| Thẻ/khung | Viền `border-2`, góc `rounded-3xl`, bóng đáy phẳng `shadow-[0_4px_0_var(--border)]` |
| Chuyển động | Nảy nhẹ (spring), tôn trọng `prefers-reduced-motion` |
| Giọng văn | Ngắn, thân thiện, khích lệ |

Token nằm ở `src/app/globals.css`. Component Watermelon dùng token nên tự đổi theo; chỉ thêm class khi cần.

**Ngoại lệ:** landing `/` và đăng nhập `/login` dùng giao diện tối (class `dark`) theo template `landing-01`; các trang trong app (sau đăng nhập) giữ phong cách sáng ở trên.

**Watermelon UI là thư viện UI chính** (quyết định 26/11/2026).

| Thứ tự ưu tiên | Nguồn | Khi nào dùng |
|---|---|---|
| 1 | Watermelon (`@watermelon/*`) | Mặc định cho mọi màn hình, block và component có tương tác/animation |
| 2 | shadcn/ui gốc (`src/components/ui/`) | Primitive nền (button, input, label, sheet…) mà Watermelon dựng lên trên, hoặc khi Watermelon không có |
| 3 | Sora UI (`@soralabs/*`) | Chỉ khi cả hai nguồn trên không có thứ cần; ghi rõ lý do trong PR |

Không tự viết component mới nếu Watermelon đã có bản tương đương.

### Thêm component

```bash
pnpm dlx shadcn@latest list @watermelon            # xem danh mục (~1.178 mục)
pnpm dlx shadcn@latest view @watermelon/<tên>       # xem file + dependency trước khi cài
pnpm dlx shadcn@latest add @watermelon/<tên>
```

- Xem trước giao diện tại https://ui.watermelon.sh.
- Nhiều mục có biến thể `<tên>-base` (theme-ready, bám CSS variables của project) → **ưu tiên bản `-base`** để đồng bộ màu/dark mode.
- Chỉ cài khi thật sự dùng; mỗi mục có thể kéo thêm dependency (vd `react-icons`, `react-use-measure`).
- Đọc file vừa cài trước khi dùng (code từ registry ngoài): không gọi mạng/đọc storage ngoài mục đích component.
- Không sửa file vendor trừ khi cần; nếu sửa, ghi chú `// modified:` ở đầu file để lần cập nhật sau không bị đè mất.

### Thư mục

CLI tự đặt file theo loại item: `registry:ui` vào `src/components/ui/`, `registry:component` vào `src/components/watermelon/` hoặc `src/components/watermelon-ui/`.

| Thư mục | Nội dung |
|---|---|
| `src/components/ui/` | shadcn primitive (button đã chỉnh theo phong cách) + Watermelon loại ui (`sidebar`, `skeleton`) |
| `src/components/watermelon-ui/` | Phụ thuộc của Watermelon (`tooltip-animated`) |
| `src/components/sora-ui/` | Sora UI (hạn chế dùng) |
| `src/components/<feature>/` | Component của app, ghép từ các nguồn trên |

### Đang dùng

| Màn hình | Mẫu Watermelon | Ghi chú |
|---|---|---|
| Landing `/` | template `landing-01` | Giữ giao diện tối kiểu tech của template (user chọn, 26/11/2026). Code đã chuyển thành code của app ở `src/components/landing/`: nội dung viết lại, đổi `react-router-dom` sang `next/link`, hugeicons sang lucide; bỏ logo/link Watermelon, testimonial người thật, các section demo component và ảnh từ server ngoài |
| Đăng nhập `/login` | `auth-01` (`src/components/ui/auth-01.tsx`) | Nền tối giống landing (lưới chấm, logo). Đã sửa vendor để ẩn ô mật khẩu, thêm `loading`/`notice`/`formReplacement`, nút gửi màu phẳng; đăng nhập bằng link email hoặc Google, không có mật khẩu |
| Khung app | `sidebar` | `collapsible="icon"` (thu gọn còn cột icon 4,5rem, có tooltip), nhóm "Học"/"Công cụ", mục to chữ đậm in hoa, mỗi mục một màu icon, mục đang mở (cả trang con) viền `primary`; icon/màu/nhóm khai báo trong `app-sidebar.tsx` theo `href`. Tự chuyển thành sheet trên mobile; lưu trạng thái đóng/mở vào cookie `sidebar_state` |
| Ô chọn (dropdown) | `select` (`src/components/ui/select.tsx`) | Radix Select, đã chỉnh style edtech; dùng thay mọi `<select>` gốc. `SelectItem` không được có value rỗng (dùng giá trị đại diện như `all`, `new`); trong form dùng prop `name` để có input ẩn |
| Chọn số (cộng/trừ) | `stepper-base` (`src/components/watermelon/stepper.tsx`) | Đã sửa: nút `type="button"` (an toàn trong form), nhãn cho trình đọc màn hình, prop `step`, `label`; style edtech. Trong form gửi giá trị bằng `<input type="hidden">`. Dùng thay `<input type="number">` |
| Khung đóng/mở | `collapsible` (`src/components/ui/collapsible.tsx`) | Radix Collapsible; dùng thay `<details>` gốc. Mũi tên xoay bằng `group-data-[state=open]:rotate-180` |
| Hộp thoại Khoá học | `@watermelon/dialog` (`src/components/ui/dialog.tsx`) | Radix Dialog với `asChild` và Motion; dùng cho chọn cấp, mục tiêu, sổ từ. Bắt buộc có `DialogTitle`. |
| Tra nghĩa và lịch sử bài học | `@watermelon/popover` (`src/components/ui/popover.tsx`) | Mỗi từ trong câu hỏi có nút mở nghĩa qua `/api/lookup`. Popover lịch sử chỉ hiển thị lượt trả lời thuộc bài hiện tại. |
| Trạng thái đang tải | (tự làm, không có sẵn trong registry) | `LogoLoader` (`src/components/layout/logo-loader.tsx`): ô logo nảy, chỉ CSS (keyframes trong `globals.css`) nên dùng được làm `Suspense` fallback ở Server Component; hiện sau 150 ms, đứng yên khi `prefers-reduced-motion`. Dùng cho mọi fallback, `label` mô tả việc đang tải, `size="sm"` cho chỗ nhỏ |
| Onboarding, bộ từ, tra từ | Primitive sẵn có | Dùng `Button` và token màu của app; form và thẻ dữ liệu dùng viền dày, góc tròn |
| Flashcard học từ | Component của app | `flip-card` trong registry hiện là thẻ hồ sơ lật khi rê chuột, không hỗ trợ điều khiển bàn phím cần cho học từ; viewer của app hỗ trợ click, Space, phím mũi tên và `aria-live` |

### Player Khoá học IELTS

- Player dùng bảy hoạt động xen kẽ; học viên chọn bất kỳ hoạt động nào trong bài đã mở. Bài kế tiếp chỉ mở khi đủ bảy hoạt động hoàn tất. Nguồn thứ tự và bước nhỏ: `src/lib/courses/lesson-activities.ts`.
- `advance_course_activity` là RPC tiến độ chỉ dành cho service role. Lượt nói v2 lưu theo bài, hoạt động và bước nhỏ; API lưu câu trả lời trước, chấm sau để không chặn chuyển bước. Band chỉ là ước lượng luyện tập, không phải điểm IELTS chính thức.
- `TutorNarration` nhận phụ đề `{ en, vi }` và `onComplete`; phát lại, đổi tốc độ và bỏ qua dùng chung với player cũ. Tiếng đọc cache theo giọng, văn bản và tốc độ.
- Chỉ chuyển sang player v2 khi bài có `activity_content`. Giữ luồng cũ trước khi áp migration và bổ sung nội dung. Hai nhóm từ v2 ghi danh SRS riêng; hội thoại dùng `CallSession` và dấu hoàn tất xác nhận ở server.

### Hội thoại AI

- `CallSession` dùng chung cho bộ từ và bài IELTS. Mặc định là màn gọi ẩn câu gia sư; chat cho phép tra từng từ, gõ và xin nhận xét theo lượt.
- `useCallMic` ghi WAV trong trình duyệt. Mở mic sau khi giọng gia sư dừng; ngắt lời bằng nút hoặc Enter. VAD tự gửi sau khoảng 1,2 giây im sau tiếng nói, hoặc mời thử lại nếu không nghe tiếng nói trong khoảng 8 giây. Không lưu bản ghi.
- Route `/api/conversation/[threadId]/turn` gửi bản chép trước rồi stream câu trả lời. `createCallReplyAudio` phát câu hoàn chỉnh đầu tiên khi stream chưa xong, nạp trước các câu sau. Không phụ thuộc vào việc người học mở chat hay gợi ý.
- `useCallSession` giữ tiến độ, trạng thái gọi và vòng đời audio, không phụ thuộc markup. `useCallAssist` tải trợ giúp theo chỉ số tin đã lưu. Gợi ý từ được lưu trong `chat_messages.suggested_terms` cùng tin gia sư; `done` chỉ gửi sau khi ghi thành công.

### Lint với code vendor

Code từ registry giữ nguyên bản gốc. `eslint.config.mjs` hạ `react-hooks/set-state-in-effect` và `react-hooks/refs` xuống **warning** chỉ cho các file vendor; code của app vẫn bị chặn ở mức error.

### Gợi ý mapping theo tính năng

| Tính năng | Mục Watermelon nên xem trước |
|---|---|
| Landing | `hero-*`, `landing-01`, `bento-01/02` |
| Đăng nhập | `auth-01` … `auth-13` |
| Khung app | `sidebar`, `theme-toggler` |
| Flashcard | `flip-card`, `card-swipe` |
| Tiến độ / streak | `progress`, `labeled-progress-indicator` |
| Speaking / phát âm | `audio-player-with-waveform` |
| Chế độ học | `fluid-tabs`, `continuous-tabs` |

## Học và streak

- Phiên Học chỉ hoàn tất khi mọi thẻ qua nhận diện rồi nhớ lại. Ôn sai hủy trạng thái thuộc của thẻ đó.
- Meaning Recall chấm cục bộ với `gradeMeaningLocally`. Chỉ gửi `unsure` đến `POST /api/courses/meaning-check` (`cardId`, `answer` tối đa 120 ký tự). Server đọc thẻ khóa học theo quyền người học; cache chỉ service role truy cập. Lượt chấm AI thành công trên cache miss tính vào quota 200 lượt/ngày theo giờ Việt Nam; `source: "unavailable"` vẫn cho phép người học tự xác nhận.
- `sync_streak()` tính ngày Việt Nam có `user_daily_activity.reviews + studied > 0` hoặc có hoạt động khóa học hoàn tất (`course_activity_progress.completed_at`). Mỗi ngày chỉ tính một lần. Hoạt động khóa học không tăng `reviews` hay `studied`; ngày đóng băng giữ chuỗi nhưng không tạo hoạt động thật hay XP.
- Bảng hạng tuần dùng `reviews + studied + 10 × số hoạt động khóa học hoàn tất + 5 × số lượt luyện nói`, tính từ thứ Hai 00:00 đến trước thứ Hai kế tiếp theo giờ Việt Nam. `studied` hiện đếm phiên đã lưu, không đếm thẻ.

## Chung

- TypeScript strict; file kebab-case.
- Đọc/ghi dữ liệu người dùng qua Supabase với RLS; không dùng secret key ở client.
- Mọi lời gọi AI đi qua server và `assertQuota` / `recordUsage` (`src/lib/ai/quota.ts`).
- Next.js 16 bật Cache Components: truy cập cookies/searchParams phải nằm trong `<Suspense>`.
- Trước khi xong việc: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.

# Báo cáo seed 6 cấp IELTS

Supabase xác nhận đủ 7 cấp: **210 bài, 210 hoạt động v2, 1.680 thẻ**. Không còn bài thiếu hoạt động. `foundations` có sẵn, giữ nguyên.

| Cấp | CEFR | Bài | V2 | Thẻ | Bài có nhãn Nói khác mẫu `1,1,1,3` |
| --- | --- | ---: | ---: | ---: | ---: |
| `foundations` | A1 | 30 | 30 | 240 | 0 |
| `band-3-4` | A2 | 30 | 30 | 240 | 0 |
| `band-45-55` | B1 | 30 | 30 | 240 | 2 |
| `band-6` | B2 | 30 | 30 | 240 | 17 |
| `band-7` | C1 | 30 | 30 | 240 | 29 |
| `advanced-1` | C1 | 30 | 30 | 240 | 27 |
| `advanced-2` | C2 | 30 | 30 | 240 | 6 |

## Kiểm chất lượng

- Đọc bằng service role sau khi sửa. Mỗi bài có đúng 8 thẻ, đủ IPA, nghĩa tiếng Việt và ví dụ song ngữ; không trùng mục từ đã chuẩn hóa giữa các bài hoặc cấp. Không thấy dấu gạch bị cấm trong dữ liệu đã đọc.
- Sáu cấp mới: mỗi bài có 4 câu Nói khác nhau, câu mở đầu khớp catalog, 2 mục ngữ pháp khác tên, và tình huống hội thoại, không phải kịch bản gắn nhãn người nói. Đã duyệt từ theo CEFR, khả năng dùng nhóm A/B ở câu 2/4, ngữ pháp và cách diễn đạt tiếng Việt bằng đọc nội dung; các mục ngữ nghĩa không phải kết quả của bộ kiểm tự động.
- Còn **81 bài** có `speaking[].part` khác mẫu trong prompt, dù đủ 4 câu. Không đổi nhãn hàng loạt: cần đối chiếu câu hỏi cụ thể với dạng Part 1 hoặc Part 3.
- `foundations` có 7 đoạn hội thoại dạng lời thoại từ trước, ngoài phạm vi seed: `A new classmate`, `Inside my bag`, `Buying fruit`, `A smaller size`, `On the way to school`, `Rainy afternoon`, `Inviting a friend`.

## Lượt thử lại và sửa nội dung

- A2: sinh lại các bài thiếu thẻ; chọn cụm rồi bổ sung thẻ cho `Asking for quiet`. Chỉnh câu Nói trên 24 bài trong lượt duyệt chính, rồi chỉnh `A broken light` và `An unexpected day off` sau kiểm mẫu.
- B1: backfill `Learning independence`, `Without my device`, `Library or cafe`, `After a busy week`. Chỉnh câu Nói trên 19 bài trong lượt duyệt chính và sửa thêm câu 4 của `Without my device` sau kiểm mẫu.
- B2: nối checkpoint sau khi gateway mất kết nối. Backfill `Organizing an event`, `Keeping a routine during a move`, `Simple rules for habits`, `Conflicting news`. Chỉnh câu Nói trên 13 bài.
- Band 7: cứu thẻ `Who pays for energy savings`, backfill `Entry standards and access` và `Risk without alarm`, điền `Convenience as a default` khi trường hoạt động còn null. Chỉnh câu Nói trên 21 bài.
- Nâng cao 1: nối checkpoint sau timeout, cứu thẻ `Behind the percentage`, soạn trực tiếp `A clear opt-out` sau khi gateway tiếp tục timeout. Backfill `Conflicting evidence`, `Apology versus remedy`, `Behavior versus preference`; điền `Durable voluntary agreements` khi còn null. Chỉnh câu Nói trên 20 bài qua hai lượt.
- Nâng cao 2: lượt sinh gốc gặp timeout, `ECONNRESET` và thiếu thẻ. Chia yêu cầu nhỏ qua gateway `local/dev`, hợp nhất 24 bản nháp cứu được với 6 bài đã giữ từ lượt gốc. Công bố cấp bằng `pnpm seed:courses --level advanced-2`. Điền `Persuasive concessions` khi còn null; chỉnh câu Nói ở `Translating humor`, `What adaptations reveal` và `An author’s explanation`.

## Script và kiểm tra

- Seed dùng alias gateway `dev` trỏ tới `local/dev`. Hai entrypoint dùng adapter OpenAI-compatible. Thêm checkpoint và chặn nội dung trả về dưới dạng thoại. Không dùng nội dung OpenQuiz; không sửa UI hay migration đã đẩy.
- `bun --conditions=react-server scripts/seed-activity-content.check.ts`, `pnpm test`, `pnpm typecheck`, `pnpm lint`: đã chạy sau thay đổi script. 162 test qua, typecheck qua, lint 0 lỗi và 5 cảnh báo UI có sẵn. Dev server cổng `3100` trả HTTP 200 sau audit cuối.

## Mẫu từ Supabase sau sửa

### foundations

**A short break**
- Từ nhóm A: `take a break`, `sit down`, `close my eyes`, `go for a walk`. Nhóm B: `listen to music`, `have a snack`, `in the morning`, `after lunch`.
- Nói: 1) When do you take a break in your day? 2) What do you do when you take a break? 3) Do you go for a walk after lunch? 4) Why do people need short breaks?
- Ngữ pháp: Hiện tại đơn: I + động từ; Cụm từ chỉ thời gian.

**A tidy room**
- Từ nhóm A: `make my bed`, `pick up my clothes`, `hang up my jacket`, `fold my shirts`. Nhóm B: `put my shoes by the door`, `put my books on the shelf`, `put my toys in a box`, `put my dirty clothes in the laundry basket`.
- Nói: 1) How do you make your room tidy? 2) When do you make your bed? 3) Where do you put your shoes when you get home? 4) Is it easier to find things in a tidy room? Why?
- Ngữ pháp: Hiện tại đơn: I + động từ; put + đồ vật + nơi chốn.

**Inviting a friend**
- Từ nhóm A: `do you want to play?`, `let's play a game!`, `can i play too?`, `come and play!`. Nhóm B: `pick a game.`, `start the game.`, `your turn!`, `my turn!`.
- Nói: 1) Who would you invite to play a game? 2) What games do you play with friends? 3) What do you say when you want to join a game? 4) Why is it important to wait for your turn?
- Ngữ pháp: Let's + động từ; Can I + động từ?.

### band-3-4

**A changed morning**
- Từ nhóm A: `last year`, `this year`, `these days`, `an hour earlier`. Nhóm B: `half an hour later`, `wake up at seven`, `get up straight away`, `stay in bed longer`.
- Nói: 1) How has your morning routine changed this year? 2) What time did you wake up on weekdays last year? 3) On weekends, do you get up straight away or stay in bed longer? 4) Why do some people get up straight away on weekdays but stay in bed longer at weekends?
- Ngữ pháp: Quá khứ đơn và hiện tại đơn; Khoảng thời gian + earlier hoặc later.

**A broken light**
- Từ nhóm A: `Excuse me.`, `ceiling light`, `The light isn't working.`, `light bulb`. Nhóm B: `light switch`, `lamp`, `turn on`, `go out`.
- Nói: 1) How do you report a broken light politely? 2) Where is the ceiling light in your room, and when do you use it most? 3) Have you ever changed a light bulb yourself? 4) Why is it useful to tell hotel staff when a lamp will not turn on?
- Ngữ pháp: Hiện tại tiếp diễn: isn't working; Nhờ giúp lịch sự: Could you…?.

**An unexpected day off**
- Từ nhóm A: `day off`, `be canceled`, `sleep in`, `take it easy`. Nhóm B: `stay in`, `meet up with a friend`, `have time to`, `decide to`.
- Nói: 1) How did you spend an unexpected day off? 2) Would you sleep in or get up early if your morning class were canceled? 3) Who do you usually meet up with when you have free time? 4) On an unexpected day off, would you stay in or decide to go somewhere new? Why?
- Ngữ pháp: Quá khứ đơn: was/were canceled; decide to / have time to + động từ.

### band-45-55

**A delay that helped**
- Từ nhóm A: `be held up`, `be stuck in traffic`, `miss a connection`, `train cancellation`. Nhóm B: `get back on track`, `change of plans`, `take a detour`, `have time to spare`.
- Nói: 1) When did a delayed journey turn out well? 2) Have you ever been held up on your way to an important event? 3) What do you usually do when you're stuck in traffic? 4) How can a change of plans make a trip better?
- Ngữ pháp: Past simple + past continuous; Although + mệnh đề.

**Without my device**
- Từ nhóm A: `run out of battery`, `won't turn on`, `check the connection`, `try a different charger`. Nhóm B: `Could I borrow your phone?`, `use a backup device`, `switch to the web version`, `work offline`.
- Nói: 1) How did you solve a problem without your usual device? 2) What do you usually do when your phone runs out of battery? 3) Have you ever had to work offline because your device wouldn't turn on? 4) How can a school help students work offline or use a backup device when their usual devices stop working?
- Ngữ pháp: Could I + động từ nguyên mẫu?; If + hiện tại đơn, can + động từ nguyên mẫu.

**Stress and shopping**
- Từ nhóm A: `impulse buy`, `shopping list`, `stick to a budget`, `wish list`. Nhóm B: `wait until tomorrow`, `empty your cart`, `close the app`, `saved card details`.
- Nói: 1) How can people avoid buying things after a stressful day? 2) What do you do with your shopping list or wish list when you feel tempted to buy something extra? 3) Do you usually make a shopping list? Why or why not? 4) How does saving card details make impulse buying easier, and what might help shoppers wait until tomorrow?
- Ngữ pháp: Should + động từ nguyên mẫu; If + hiện tại đơn, can + động từ nguyên mẫu.

### band-6

**Early specialization**
- Từ nhóm A: `specialize early`, `keep your options open`, `transferable skills`, `get a feel for`. Nhóm B: `try your hand at`, `build a solid foundation`, `deepen your expertise`, `narrow down your options`.
- Nói: 1) Should beginners specialize early in their careers? 2) When you start a new job, do you prefer to specialize early or keep your options open? 3) How can trying your hand at different tasks help you build transferable skills? 4) When should people narrow down their options and focus on deepening their expertise?
- Ngữ pháp: By + V-ing: Nêu cách thực hiện; Whereas: Đối chiếu hai lựa chọn.

**Phone-free time**
- Từ nhóm A: `set ground rules`, `hear everyone out`, `pick a time slot`, `put phones away`. Nhóm B: `phone basket`, `charging station`, `mute notifications`, `set a timer`.
- Nói: 1) How could a family agree on phone-free time? 2) When do you usually put your phone away at home? 3) Would you rather mute notifications or leave your phone at a charging station during dinner? Why? 4) How can a phone basket and a timer help a family stick to a screen-free period without starting arguments?
- Ngữ pháp: How about + V-ing?; As long as + mệnh đề.

**Talking about uncertainty**
- Từ nhóm A: `voice a concern`, `ask for clarification`, `check your understanding`, `an open-ended question`. Nhóm B: `acknowledge someone's feelings`, `offer reassurance`, `make a list`, `jot down`.
- Nói: 1) What makes uncertainty easier to discuss with others? 2) When you're unsure about instructions, do you ask for clarification right away or jot down your questions for later? 3) What can a team leader do to make it easier for people to voice a concern? 4) How can you offer reassurance without making promises you can't keep?
- Ngữ pháp: Câu hỏi gián tiếp để hỏi lại; May, might, could để nói về khả năng.

### band-7

**Subsidies and inequality**
- Từ nhóm A: `blanket subsidy`, `per-unit subsidy`, `benefit incidence`, `capture the lion's share`. Nhóm B: `eligibility threshold`, `benefit cliff`, `exclusion error`, `low take-up`.
- Nói: 1) When might an energy subsidy widen inequality? 2) If your town introduced a blanket electricity subsidy, which households would capture the largest share of the savings? 3) How can benefit incidence help explain why high-consumption households capture the lion's share of a blanket per-unit subsidy? 4) How could governments redesign an eligibility threshold to soften a benefit cliff without making low take-up or exclusion errors worse?
- Ngữ pháp: The more …, the more …; Were + chủ ngữ + to + động từ.

**Access versus participation**
- Từ nhóm A: `waiting list`, `drop out`, `on paper`, `prohibitive cost`. Nhóm B: `competing demands`, `opportunity cost`, `information gap`, `digital exclusion`.
- Nói: 1) Why does availability not always lead to equal participation? 2) Have you ever been on a waiting list for a course or activity? What did you do while you waited? 3) Why might people drop out of a training programme that looks accessible on paper? 4) How should local authorities decide whether to tackle high costs, digital exclusion, or gaps in information first?
- Ngữ pháp: Even if và even though; Đảo ngữ với Not until.

**Hidden costs of low prices**
- Từ nhóm A: `externalize costs`, `foot the bill`, `remediation costs`, `defer maintenance`. Nhóm B: `maintenance backlog`, `cut corners on quality control`, `shorten service life`, `life-cycle cost`.
- Nói: 1) Why might a low-price policy create unexpected costs later? 2) When choosing a cheaper service, how would you tell whether the provider is deferring maintenance or shifting costs to someone else? 3) Why might a company defer maintenance to keep prices low, even if this creates a maintenance backlog? 4) How can buyers account for maintenance backlogs and a shorter service life when comparing the life-cycle cost of competing products?
- Ngữ pháp: Đảo ngữ với Only later; Điều kiện hỗn hợp: quá khứ và hiện tại.

### advanced-1

**Conflicting evidence**
- Từ nhóm A: `findings are mixed`, `point in opposite directions`, `at odds with`, `inconclusive`. Nhóm B: `on balance`, `the weight of evidence`, `with one important caveat`, `interpret with caution`.
- Nói: 1) How should a speaker describe evidence that points in different directions? 2) When two reports point in opposite directions, what would persuade you to call the findings inconclusive rather than choose a side? 3) When studies point in opposite directions, what should carry more weight: sample size, study design, or consistency across studies? Why? 4) How should a policymaker explain that the weight of evidence favours one option but still needs to be interpreted with caution?
- Ngữ pháp: While + mệnh đề: đối chiếu kết quả; On balance + suggest(s) + mệnh đề: kết luận có chừng mực.

**Invisible costs of overuse**
- Từ nhóm A: `usage meter`, `usage quota`, `request backlog`, `congestion signal`. Nhóm B: `cost attribution`, `incur a marginal cost`, `mask scarcity`, `crowd out other users`.
- Nói: 1) What happens when nobody can see the cost of overusing a shared service? 2) Have you ever changed how often you used a shared service after seeing a usage meter or hitting a usage quota? 3) How can flat-rate pricing mask scarcity even when each extra request incurs a marginal cost? 4) When heavy users crowd out other users, should providers rely on cost attribution, usage quotas, or congestion signals? What trade-offs matter most?
- Ngữ pháp: Đảo ngữ với Only when; Điều kiện hỗn hợp: quá khứ → hiện tại.

**Sharing productivity gains**
- Từ nhóm A: `pro rata`, `gainsharing`, `profit-sharing pool`, `earmark a share of profits`. Nhóm B: `distribute a profit-linked bonus`, `benchmark productivity against a baseline`, `share verified cost savings`, `set a payout threshold`.
- Nói: 1) How can employers share gains from improved productivity? 2) If your team had a profit-sharing pool, would you distribute it pro rata or divide it equally? Why? 3) How should employers benchmark productivity against a baseline without rewarding teams for gains they did not cause? 4) When should employers distribute a profit-linked bonus based on verified cost savings rather than set a payout threshold based on output?
- Ngữ pháp: Điều kiện giới hạn: only if; Nhượng bộ giả định: even if.

### advanced-2

**Consistent treatment and injustice**
- Từ nhóm A: `formal equality`, `substantive equality`, `entrench disadvantage`, `facially neutral rule`. Nhóm B: `indirect discrimination`, `similarly situated`, `historical baseline`, `cumulative disadvantage`.
- Nói: 1) When can consistent treatment sustain an unjust outcome? 2) Have you ever followed a facially neutral rule that made it harder for you to participate at school or work? 3) If you led a team, what would you change to promote substantive equality rather than settle for formal equality? 4) How should courts assess claims of indirect discrimination when people who seem similarly situated face different levels of cumulative disadvantage?
- Ngữ pháp: Đảo ngữ với Only by; Mệnh đề nhượng bộ với Even if.

**Minimum protections across borders**
- Từ nhóm A: `regulatory floor`, `mutual recognition`, `jurisdictional arbitrage`, `race to the bottom`. Nhóm B: `align baseline safeguards`, `preserve regulatory autonomy`, `cross-border enforcement`, `upward harmonisation`.
- Nói: 1) How should competing jurisdictions agree on a minimum protection? 2) What regulatory floor would you want for your personal data when shopping abroad? 3) Would mutual recognition of professional qualifications make you more willing to work abroad? 4) How can cross-border enforcement preserve regulatory autonomy without weakening consumer protection?
- Ngữ pháp: Đảo ngữ điều kiện với Should; Đảo ngữ với Only if.

**Reversibility in practice**
- Từ nhóm A: `path dependence`, `exit costs`, `legacy dependency`, `contractual lock-in`. Nhóm B: `practical rollback`, `decommissioning liability`, `retain an exit route`, `irrecoverable expenditure`.
- Nói: 1) What makes a decision reversible in practice rather than only on paper? 2) What exit costs have made you stick with a service you wanted to leave? 3) When has a legacy dependency limited your choices at work? 4) How can organizations retain an exit route when decommissioning liability is unclear?
- Ngữ pháp: Đảo ngữ với Had; Mệnh đề nhượng bộ với No matter how.

Status: DONE_WITH_CONCERNS
Summary: Đủ 7 cấp, 210 bài v2 và 1.680 thẻ. Còn 81 bài có nhãn Nói khác mẫu và 7 lời thoại có sẵn ở Foundations.

// Built from Watermelon UI feature-3 (registry.watermelon.sh): copy and checklist on the left,
// overlapping preview cards on the right. Content is OpenEngQuiz's progress tracking.
import Link from "next/link";

const POINTS = [
  "Chuỗi ngày học liên tiếp và số thẻ đến hạn ôn",
  "Từ đã thành thạo, đang học và chưa học trong từng bộ",
  "Lịch sử luyện nói với nhận xét và band từng lần",
  "Tiến độ khoá học theo từng bài và từng cấp",
];

export function LandingProgressFeature() {
  return (
    <section className="w-full py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-muted/60 text-muted-foreground inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1 text-sm font-extrabold">
            <span className="bg-primary h-2 w-2 rounded-full" />
            Theo dõi tiến độ
          </div>
          <h2 className="text-4xl leading-tight font-black tracking-tight text-balance md:text-5xl">Thấy rõ mình tiến bộ mỗi ngày</h2>
          <p className="text-muted-foreground max-w-lg text-lg">
            Mọi lần ôn thẻ, mỗi câu trả lời và từng bài học đều được ghi lại, nên bạn biết nên học gì tiếp theo.
          </p>
          <ul className="space-y-2.5">
            {POINTS.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="bg-primary/15 grid size-6 shrink-0 place-items-center rounded-full">
                  <span className="bg-primary size-2.5 rounded-full" />
                </span>
                <span className="text-muted-foreground font-semibold">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="bg-primary text-primary-foreground inline-flex h-12 items-center rounded-2xl px-6 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none"
          >
            Bắt đầu theo dõi
          </Link>
        </div>

        <div aria-hidden="true" className="bg-muted/60 relative flex justify-center rounded-[2rem] border-2 p-8">
          <div className="relative h-[380px] w-full max-w-md">
            <div className="bg-card absolute top-0 left-0 w-[260px] space-y-2 rounded-2xl border-2 p-4 shadow-[0_4px_0_var(--border)]">
              <p className="text-muted-foreground text-xs font-bold">Bộ từ: Daily routine</p>
              <p className="text-3xl font-black">72<span className="text-muted-foreground text-sm">% thành thạo</span></p>
              <div className="flex gap-2 text-[11px] font-extrabold">
                <span className="bg-primary/15 text-primary-edge rounded-md px-2 py-0.5">18 thành thạo</span>
                <span className="bg-accent/20 text-accent-foreground rounded-md px-2 py-0.5">5 đang học</span>
              </div>
            </div>

            <div className="bg-card absolute top-28 right-0 z-10 w-[240px] space-y-3 rounded-2xl border-2 p-4 shadow-[0_6px_0_var(--border)]">
              <p className="text-muted-foreground text-xs font-bold">Hôm nay</p>
              <p className="text-sm"><span className="font-black">3 hoạt động</span> <span className="text-muted-foreground">đã xong</span></p>
              <div className="flex h-2 w-full gap-1">
                <div className="bg-primary w-[40%] rounded-full" />
                <div className="bg-secondary w-[35%] rounded-full" />
                <div className="bg-brand-orange w-[25%] rounded-full" />
              </div>
              <div className="text-muted-foreground flex gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1"><span className="bg-primary size-2 rounded-full" />Học từ</span>
                <span className="flex items-center gap-1"><span className="bg-secondary size-2 rounded-full" />Luyện nói</span>
                <span className="flex items-center gap-1"><span className="bg-brand-orange size-2 rounded-full" />Ôn tập</span>
              </div>
            </div>

            <div className="bg-card absolute bottom-8 left-10 w-[260px] space-y-3 rounded-2xl border-2 p-4 shadow-[0_4px_0_var(--border)]">
              <div className="flex items-center justify-between text-sm">
                <span className="font-extrabold">Luyện nói</span>
                <span className="text-muted-foreground text-xs font-bold">Lần gần nhất</span>
              </div>
              <p className="text-sm"><span className="font-black">Band 6.5</span> <span className="text-muted-foreground">tăng 0.5 so với lần trước</span></p>
              <div className="flex gap-2 text-[11px] font-extrabold">
                <span className="bg-primary/15 text-primary-edge rounded-md px-2 py-0.5">Trôi chảy</span>
                <span className="bg-brand-grape/15 text-brand-grape rounded-md px-2 py-0.5">Từ vựng</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

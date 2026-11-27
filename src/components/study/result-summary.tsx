import Link from "next/link";
import { CheckCircle2, RotateCcw, Target, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardDefinition, type StudyCard, type StudyMode } from "@/lib/study/study-types";

type Attempt = { card_id: string; answer: string; correct: boolean };

function verdict(accuracy: number) {
  if (accuracy >= 90) return { title: "Xuất sắc!", text: "Bạn nắm gần như trọn bộ từ này." };
  if (accuracy >= 70) return { title: "Làm tốt lắm!", text: "Ôn lại vài từ bên dưới là chắc chắn." };
  if (accuracy >= 40) return { title: "Đang tiến bộ!", text: "Học lại một lượt nữa để nhớ lâu hơn." };
  return { title: "Khởi đầu tốt!", text: "Từ mới cần vài lượt mới nhớ, cứ tiếp tục nhé." };
}

/** End-of-session screen: score ring, accuracy, and the words to review. */
export function ResultSummary({ mode, setId, cards, attempts, score, total, onRestart }: {
  mode: StudyMode;
  setId: string;
  cards: StudyCard[];
  attempts: Attempt[];
  score: number;
  total: number;
  onRestart: () => void;
}) {
  const right = attempts.filter((attempt) => attempt.correct).length;
  const wrongAttempts = attempts.filter((attempt) => !attempt.correct);
  const accuracy = attempts.length ? Math.round((right / attempts.length) * 100) : 0;
  const ringValue = mode === "game" ? accuracy : total ? Math.round((score / total) * 100) : 0;
  const { title, text } = verdict(accuracy);
  // One review row per card, keeping the learner's last wrong answer.
  const review = [...new Map(wrongAttempts.map((attempt) => [attempt.card_id, attempt])).values()];
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <section className="space-y-5">
      <div className="bg-card relative overflow-hidden rounded-[2rem] border-2 p-8 text-center shadow-[0_6px_0_var(--border)]">
        <div aria-hidden="true" className="bg-primary/15 absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl" />
        <div className="relative mx-auto size-40">
          <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="12" className="stroke-muted" />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              className={cn("transition-[stroke-dashoffset] duration-1000 ease-out", mode === "game" ? "stroke-brand-orange" : "stroke-primary")}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ringValue / 100)}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div>
              <p className="text-4xl font-black tabular-nums">{mode === "game" ? score : `${score}/${total}`}</p>
              <p className="text-muted-foreground text-xs font-extrabold uppercase">{mode === "game" ? "điểm" : "đúng"}</p>
            </div>
          </div>
        </div>
        <h2 className="relative mt-5 text-3xl font-black tracking-tight">{title}</h2>
        <p className="text-muted-foreground relative mt-1 text-lg">{text}</p>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          <Stat icon={<CheckCircle2 className="text-primary size-5" aria-hidden="true" />} value={right} label="Câu đúng" />
          <Stat icon={<XCircle className="text-destructive size-5" aria-hidden="true" />} value={wrongAttempts.length} label="Câu sai" />
          <Stat icon={<Target className="text-secondary size-5" aria-hidden="true" />} value={`${accuracy}%`} label="Chính xác" />
        </div>

        <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRestart}
            className="bg-primary text-primary-foreground inline-flex h-13 items-center justify-center gap-2 rounded-2xl px-8 font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none"
          >
            <RotateCcw className="size-5" aria-hidden="true" /> Học lại
          </button>
          <Link
            href={`/sets/${setId}`}
            className="bg-card hover:bg-muted inline-flex h-13 items-center justify-center rounded-2xl border-2 px-8 font-extrabold uppercase shadow-[0_4px_0_var(--border)] active:translate-y-1 active:shadow-none"
          >
            Về bộ từ
          </Link>
        </div>
      </div>

      {review.length ? (
        <div className="bg-card rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)]">
          <h3 className="flex items-center gap-2 text-xl font-black">
            <Trophy className="text-accent size-5" aria-hidden="true" /> Từ cần ôn lại <span className="text-muted-foreground">({review.length})</span>
          </h3>
          <ul className="mt-4 divide-y-2">
            {review.map((attempt) => {
              const card = cards.find((item) => item.id === attempt.card_id);
              if (!card) return null;
              return (
                <li key={attempt.card_id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p lang="en" className="text-lg font-black">{card.term}</p>
                    <p className="text-muted-foreground font-semibold">{cardDefinition(card)}</p>
                  </div>
                  <p className="bg-destructive/10 text-destructive w-fit shrink-0 rounded-xl px-3 py-1 text-sm font-bold">
                    Bạn trả lời: {attempt.answer === "true" ? "Đúng" : attempt.answer === "false" ? "Sai" : attempt.answer || "Hết giờ"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="bg-primary/10 text-primary-edge rounded-2xl p-4 text-center font-extrabold">Không sai câu nào. Quá đỉnh!</p>
      )}
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="bg-muted/60 rounded-2xl p-3">
      <div className="flex items-center justify-center gap-1.5">{icon}<span className="text-2xl font-black tabular-nums">{value}</span></div>
      <p className="text-muted-foreground text-xs font-extrabold uppercase">{label}</p>
    </div>
  );
}

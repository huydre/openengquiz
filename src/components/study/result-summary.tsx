import Link from "next/link";
import { cardDefinition, type StudyCard, type StudyMode } from "@/lib/study/study-types";

type Attempt = { card_id: string; answer: string; correct: boolean };

export function ResultSummary({ mode, setId, cards, attempts, score, total }: {
  mode: StudyMode;
  setId: string;
  cards: StudyCard[];
  attempts: Attempt[];
  score: number;
  total: number;
}) {
  const wrong = attempts.filter((attempt) => !attempt.correct);
  return (
    <section className="space-y-5 rounded-3xl border-2 bg-card p-6 shadow-[0_4px_0_var(--border)]">
      <h2 className="text-2xl font-black">Hoàn thành rồi!</h2>
      <p className="text-lg font-bold">
        {mode === "game" ? "Điểm" : "Kết quả"}: {score}/{total}
      </p>
      {wrong.length ? (
        <div className="space-y-3">
          <h3 className="font-extrabold">Xem lại câu sai</h3>
          {wrong.map((attempt, index) => {
            const card = cards.find((item) => item.id === attempt.card_id);
            if (!card) return null;
            return (
              <div key={`${attempt.card_id}-${index}`} className="rounded-2xl border p-3 text-sm">
                <p className="font-bold">{card.term}: {cardDefinition(card)}</p>
                <p className="text-muted-foreground">Bạn trả lời: {attempt.answer || "Chưa trả lời"}</p>
              </div>
            );
          })}
        </div>
      ) : <p>Chính xác hết. Rất tốt!</p>}
      <Link href={`/sets/${setId}`} className="font-bold text-primary underline">
        Về bộ từ
      </Link>
    </section>
  );
}

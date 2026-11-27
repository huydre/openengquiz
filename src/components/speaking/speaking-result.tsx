import { Button } from "@/components/ui/button";
import type { SpeakingFeedback } from "@/lib/ai/speaking-feedback";
import type { PronunciationResult } from "@/lib/speech/client";
import { playTts } from "@/lib/speech/play-tts";
import { pronunciationHint } from "@/lib/speech/pronunciation-hints";

function percent(score: number | null) {
  return score == null ? "Chưa đủ dữ liệu" : `${Math.round(score * 100)}%`;
}

export function SpeakingResult({ pron, transcript, feedback, saved, speaking, ai }: {
  pron: PronunciationResult;
  transcript: string;
  feedback: SpeakingFeedback | null;
  saved: boolean;
  speaking: boolean;
  ai: boolean;
}) {
  const issueIndices = new Set(pron.issues.map((issue) => issue.word_index));
  return (
    <section aria-label="Kết quả luyện nói" className="space-y-4 rounded-3xl border-2 bg-card p-5">
      <h2 className="text-2xl font-black">Kết quả phát âm</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["Tổng điểm", pron.score], ["Độ chính xác", pron.accuracy],
          ["Độ trôi chảy", pron.fluency], ["Độ đầy đủ", pron.completeness],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-muted p-3"><dt>{label}</dt><dd className="font-black">{percent(value)}</dd></div>
        ))}
      </dl>
      {speaking && <p><strong>Bản chép:</strong> <span lang="en">{transcript}</span></p>}
      <p className="text-sm text-muted-foreground">Từ màu đỏ cần luyện thêm. Mở từng từ để xem điểm và âm vị.</p>
      <div className="flex flex-wrap gap-2">
        {pron.words.map((word, index) => {
          const needsWork = word.omitted || word.score < 0.7 || issueIndices.has(index);
          return (
            <details key={index} className="min-w-0 rounded-xl border px-3 py-2">
              <summary className={`cursor-pointer font-bold ${needsWork ? "text-destructive" : ""}`}>
                <span lang="en">{word.text}</span> {word.omitted ? "(bỏ qua)" : percent(word.score)}
                {needsWork && <span className="sr-only">, cần luyện thêm</span>}
              </summary>
              {word.phones.length > 0 && <ul className="mt-2 space-y-1">{word.phones.map((phone, i) => (
                <li key={i}>/{phone.ipa}/: {percent(phone.score)}{phone.heard && phone.heard !== phone.ipa && ` (nghe thành /${phone.heard}/)`}</li>
              ))}</ul>}
              <Button type="button" size="sm" variant="ghost" onClick={() => void playTts(word.text)}>Nghe từ</Button>
            </details>
          );
        })}
      </div>
      {pron.issues.length > 0 && <ul className="list-disc space-y-1 pl-5">
        {pron.issues.map((issue, i) => {
          const hint = pronunciationHint(issue);
          return <li key={i}><strong lang="en">{issue.word ?? "Âm cần luyện"}</strong>
            {issue.expected && ` · âm mẫu /${issue.expected}/`}{issue.heard && ` · nghe thành /${issue.heard}/`}
            {hint && <p>{hint}</p>}
          </li>;
        })}
      </ul>}
      {pron.warnings.length > 0 && <p className="text-sm text-muted-foreground">Dịch vụ ghi nhận vấn đề khi phân tích bản ghi. Hãy thử lại nếu điểm không phản ánh câu bạn nói.</p>}
      {feedback ? (
        <div className="space-y-3 rounded-2xl bg-muted p-4">
          <h3 className="text-xl font-extrabold">Góp ý cho câu trả lời</h3>
          <p><strong>{feedback.usedTarget ? "Đã dùng đúng từ mục tiêu" : "Chưa dùng đúng từ mục tiêu"}:</strong> {feedback.targetNote}</p>
          {feedback.corrections.length > 0 && <ul className="list-disc space-y-2 pl-5">
            {feedback.corrections.map((item, i) => (
              <li key={i}><del lang="en">{item.original}</del>{item.replacement && <> · <ins lang="en">{item.replacement}</ins></>}<p>{item.explanation}</p></li>
            ))}
          </ul>}
          <p><strong>Câu mẫu:</strong> <span lang="en">{feedback.example}</span></p>
          <Button type="button" variant="outline" size="sm" onClick={() => void playTts(feedback.example)}>Nghe câu mẫu</Button>
          <p><strong>CEFR ước lượng cho câu này:</strong> {feedback.cefr}</p>
          <p><strong>Gợi ý nói thêm:</strong> {feedback.suggestion}</p>
        </div>
      ) : ai && <p>Chưa có góp ý AI cho lượt này. Điểm phát âm vẫn có ở trên.</p>}
      <p role="status" className="text-sm text-muted-foreground">{saved ? "Đã lưu kết quả vào lịch sử." : "Chưa lưu được lượt này vào lịch sử. Kết quả vẫn hiển thị ở đây."}</p>
    </section>
  );
}

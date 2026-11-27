import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Download, FileText, PenLine, Printer, Table2, TextCursorInput } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoLoader } from "@/components/layout/logo-loader";
import { ModeIntro, ModeNotice, ModeTopBar } from "@/components/study/mode-shell";

export const metadata = { title: "Phiếu luyện tập" };

const SECTIONS = [
  { icon: Table2, title: "Bảng từ", text: "Từ, phiên âm và nghĩa để ôn nhanh." },
  { icon: PenLine, title: "Dòng kẻ luyện viết", text: "Chép lại từng từ cho nhớ mặt chữ." },
  { icon: TextCursorInput, title: "Bài điền từ", text: "Điền từ vào câu ví dụ, có đáp án cuối phiếu." },
];

export default function Page({ params }: PageProps<"/study/[setId]/worksheet">) {
  return (
    <Suspense fallback={<LogoLoader label="Đang tải phiếu học..." />}>
      <WorksheetContent params={params} />
    </Suspense>
  );
}

async function WorksheetContent({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase.from("study_sets").select("id, title").eq("id", setId).maybeSingle();
  if (!set) notFound();
  const { data: cards, count } = await supabase.from("cards")
    .select("term, definition_vi, definition_en", { count: "exact" })
    .eq("set_id", setId).order("position").order("id").limit(5);
  const total = count ?? 0;
  const pdfUrl = `/api/worksheet/${setId}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <ModeTopBar setId={setId} title={set.title} />
      {!total ? <ModeNotice>Bộ từ chưa có thẻ để in. Thêm thẻ rồi quay lại nhé.</ModeNotice> : null}
      <ModeIntro
        icon={FileText}
        tone="bg-secondary/15 text-secondary"
        title="Phiếu luyện tập"
        description={`Tờ PDF khổ A4 cho ${total} thẻ của bộ "${set.title}", in ra để luyện viết bằng tay.`}
        footer={total ? (
          <>
            <a href={pdfUrl} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground flex items-center gap-2 font-extrabold">
              <Printer className="size-5" aria-hidden="true" /> Mở để in
            </a>
            <a
              href={pdfUrl}
              download
              className="bg-primary text-primary-foreground inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-10 text-base font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none"
            >
              <Download className="size-5" aria-hidden="true" /> Tải PDF
            </a>
          </>
        ) : undefined}
      >
        <div className="grid gap-5 sm:grid-cols-[1fr_15rem]">
          <ul className="space-y-3">
            {SECTIONS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="bg-secondary/15 text-secondary grid size-11 shrink-0 place-items-center rounded-xl"><Icon className="size-5" aria-hidden="true" /></span>
                <span>
                  <span className="block font-extrabold">{title}</span>
                  <span className="text-muted-foreground block text-sm font-semibold">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Paper preview with the first words of the set. */}
          <div aria-hidden="true" className="relative mx-auto w-full max-w-60 rotate-1 rounded-xl border-2 bg-white p-4 text-neutral-800 shadow-[0_6px_0_var(--border)]">
            <p className="text-[10px] font-black tracking-wide text-neutral-500 uppercase">OpenEngQuiz</p>
            <p className="truncate text-sm font-black">{set.title}</p>
            <div className="mt-3 space-y-1.5">
              {(cards ?? []).map((card) => (
                <div key={card.term} className="flex items-baseline justify-between gap-2 border-b border-neutral-200 pb-1 text-[11px]">
                  <span lang="en" className="truncate font-bold">{card.term}</span>
                  <span className="truncate text-neutral-500">{card.definition_vi ?? card.definition_en}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map((line) => <div key={line} className="h-px bg-neutral-300" />)}
            </div>
          </div>
        </div>
      </ModeIntro>
    </div>
  );
}

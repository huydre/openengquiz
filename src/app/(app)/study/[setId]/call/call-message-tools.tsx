"use client";

import { useState } from "react";
import { Eye, EyeOff, Languages, Lightbulb, MessageSquareText, Sparkles, Volume2, Wand2, X } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { splitQuestion } from "@/lib/courses/course-question";
import { playTts } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";
import type { CallAssistAction } from "@/lib/ai/conversation-types";
import { cleanCallText, lookupCallMeaning } from "./call-client";
import { useCallAssist } from "./use-call-assist";

/** A word or phrase that opens its Vietnamese meaning in a popover (fetched on first open). */
function Meaning({ term, label, className }: { term: string; label: string; className?: string }) {
  const [meaning, setMeaning] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup() {
    if (meaning || busy) return;
    setBusy(true);
    try {
      setMeaning(await lookupCallMeaning(term));
    } catch (cause) {
      setMeaning(cause instanceof Error ? cause.message : "Chưa tra được nghĩa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover onOpenChange={(open) => { if (open) void lookup(); }}>
      <PopoverTrigger
        className={cn(
          "cursor-pointer rounded-sm underline decoration-muted-foreground/40 decoration-dotted decoration-2 underline-offset-[6px] hover:decoration-primary hover:text-primary",
          className,
        )}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent lang="vi" className="w-64 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <strong lang="en" className="text-base">{term}</strong>
          <button
            type="button"
            aria-label={`Nghe ${term}`}
            onClick={() => void playTts(term)}
            className="text-secondary hover:bg-muted grid size-8 place-items-center rounded-full"
          >
            <Volume2 aria-hidden="true" className="size-4" />
          </button>
        </div>
        {busy ? <LogoLoader size="sm" label="Đang tra nghĩa" /> : <p className="text-sm">{meaning}</p>}
      </PopoverContent>
    </Popover>
  );
}

/** English text where every word can be tapped for its meaning. */
export function CallWords({ text, className }: { text: string; className?: string }) {
  return (
    <p lang="en" className={cn("whitespace-pre-wrap", className)}>
      {splitQuestion(cleanCallText(text)).map(({ value, term }, index) =>
        term ? <Meaning key={index} term={term} label={value} className="no-underline decoration-transparent hover:underline hover:decoration-primary" /> : value,
      )}
    </p>
  );
}

/** "Try these words" chips for the current turn. */
export function TermChips({ terms, compact }: { terms: string[]; compact?: boolean }) {
  if (!terms.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {terms.map((term) => (
        <li key={term}>
          <Meaning
            term={term}
            // Card terms can be whole phrases ending in punctuation; chips read cleaner without it.
            label={term.replace(/[.!?,;:]+$/, "")}
            className={cn(
              "border-secondary/30 bg-secondary/10 text-secondary-edge hover:bg-secondary/20 hover:text-secondary-edge inline-flex rounded-full border-2 font-bold no-underline",
              compact ? "px-2.5 py-0.5 text-sm" : "px-3 py-1",
            )}
          />
        </li>
      ))}
    </ul>
  );
}

const HELP: { action: CallAssistAction; label: string; icon: typeof Languages }[] = [
  { action: "translate", label: "Dịch câu hỏi", icon: Languages },
  { action: "hint", label: "Xem gợi ý", icon: Lightbulb },
  { action: "ideas", label: "Bí ý tưởng?", icon: Sparkles },
];

/**
 * Help for one tutor message. In the call view it is the side panel (word chips, show question,
 * translate, hint, ideas, chat mode); in chat it is a compact row under the message.
 */
export function CallHelp({ threadId, index, text, terms, callView, guided, offerGuide, onGuide, onDismissGuide, onChat, onReplay }: {
  threadId: string;
  index: number;
  text: string;
  terms: string[];
  callView?: boolean;
  guided?: boolean;
  offerGuide?: boolean;
  onGuide?: () => void;
  onDismissGuide?: () => void;
  onChat?: () => void;
  onReplay?: () => void;
}) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [selected, setSelected] = useState<CallAssistAction | null>();
  // Guided mode opens the hint (a sentence to read along) until the learner picks something else.
  const active = selected === undefined && guided ? "hint" : selected;
  const { result, busy, error, request } = useCallAssist(threadId, index);

  function pick(action: CallAssistAction) {
    const next = active === action ? null : action;
    setSelected(next);
    if (next) void request(next);
  }

  const answer = active ? result[active] : undefined;
  const resultBox = (busy || error || answer) ? (
    <div aria-live="polite" className="bg-muted/60 rounded-2xl p-3 text-sm">
      {busy ? <LogoLoader size="sm" label="Đang chuẩn bị trợ giúp" /> : null}
      {error ? <p role="alert" className="text-destructive font-bold">{error}</p> : null}
      {answer && !busy ? (
        active === "translate" ? <p className="whitespace-pre-wrap">{answer}</p> : <CallWords text={answer} className="leading-relaxed" />
      ) : null}
    </div>
  ) : null;

  const guideOffer = offerGuide && !guided ? (
    <div className="border-accent/50 bg-accent/10 space-y-2 rounded-2xl border-2 p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Wand2 aria-hidden="true" className="text-accent-edge size-4" /> Để gia sư hướng dẫn bạn từng câu nhé?
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => { onGuide?.(); setSelected("hint"); void request("hint"); }}>
          Bật hướng dẫn
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismissGuide}>Để sau</Button>
      </div>
    </div>
  ) : null;

  if (!callView) {
    return (
      <div className="space-y-2">
        {terms.length ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-bold">Thử dùng các từ này trong câu trả lời:</p>
            <TermChips terms={terms} compact />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {HELP.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              aria-expanded={active === action}
              onClick={() => pick(action)}
              className={cn(
                "text-muted-foreground hover:text-foreground text-sm font-bold underline-offset-4 hover:underline",
                active === action && "text-secondary-edge underline",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {resultBox}
      </div>
    );
  }

  const row = "hover:bg-muted flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors";
  return (
    <div className="space-y-4">
      {terms.length ? (
        <div className="space-y-2">
          <p className="text-sm font-extrabold">Thử dùng các từ này nhé</p>
          <TermChips terms={terms} />
        </div>
      ) : null}

      {showQuestion ? (
        <div className="bg-card rounded-2xl border-2 p-3">
          <CallWords text={text} className="text-base leading-relaxed font-semibold" />
        </div>
      ) : null}

      <div className="-mx-1 space-y-0.5">
        {onReplay ? (
          <button type="button" onClick={onReplay} className={row}>
            <Volume2 aria-hidden="true" className="text-secondary size-5" /> Nghe lại câu này
          </button>
        ) : null}
        <button type="button" aria-expanded={showQuestion} onClick={() => setShowQuestion(!showQuestion)} className={row}>
          {showQuestion ? <EyeOff aria-hidden="true" className="text-secondary size-5" /> : <Eye aria-hidden="true" className="text-secondary size-5" />}
          {showQuestion ? "Ẩn câu hỏi" : "Xem câu hỏi"}
        </button>
        {HELP.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            aria-expanded={active === action}
            onClick={() => pick(action)}
            className={cn(row, active === action && "bg-secondary/10 text-secondary-edge")}
          >
            <Icon aria-hidden="true" className="text-secondary size-5" /> {label}
          </button>
        ))}
        {onChat ? (
          <button type="button" onClick={onChat} className={row}>
            <MessageSquareText aria-hidden="true" className="text-secondary size-5" /> Chế độ chat
          </button>
        ) : null}
      </div>
      {resultBox}
      {guideOffer}
    </div>
  );
}

/** Opt-in feedback under a learner message in chat mode. */
export function EvaluateCallReply({ threadId, index }: { threadId: string; index: number }) {
  const { result, request, busy, error } = useCallAssist(threadId, index);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open) void request("evaluate"); }}
        className="text-primary-edge inline-flex items-center gap-1 text-xs font-extrabold hover:underline"
      >
        {open ? <X aria-hidden="true" className="size-3.5" /> : <Sparkles aria-hidden="true" className="size-3.5" />}
        {open ? "Ẩn đánh giá" : "Đánh giá câu trả lời"}
      </button>
      {open ? (
        <div aria-live="polite" className="bg-card w-full max-w-md rounded-2xl border-2 p-3 text-sm">
          {busy ? <LogoLoader size="sm" label="Đang nhận xét" /> : null}
          {error ? <p role="alert" className="text-destructive font-bold">{error}</p> : null}
          {result.evaluate ? <p className="whitespace-pre-wrap">{result.evaluate}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

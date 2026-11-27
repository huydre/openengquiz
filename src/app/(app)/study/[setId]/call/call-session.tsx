"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Check, CircleAlert, ClipboardCheck, Hand, History, Keyboard, MessageSquareText, Mic, MicOff, Phone, PhoneOff, RotateCcw, SendHorizontal, Square, Volume2, Waves, X,
} from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { TutorAvatar } from "@/components/tutor/tutor-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cleanCallText } from "./call-client";
import { CallHelp, CallWords, EvaluateCallReply } from "./call-message-tools";
import { CallOrb, type CallOrbMode } from "./call-orb";
import { useCallSession, type CallSessionOptions } from "./use-call-session";

const CALL_STEPS = [
  { icon: Phone, title: "Gia sư nói trước", text: "Nghe câu hỏi, có thể nghe lại hoặc xem bản dịch." },
  { icon: Waves, title: "Nói rảnh tay", text: "Nói xong dừng một chút, câu tự gửi đi." },
  { icon: ClipboardCheck, title: "Nhận tổng kết", text: "Từ đã dùng, lỗi cần sửa và gợi ý lần sau." },
];

export type CallSessionProps = CallSessionOptions & {
  setTitle: string;
  warning?: string | null;
  /** Start the call on mount (the caller already showed its own start screen). */
  autoStart?: boolean;
};

/**
 * AI Call screen. Defaults to a hands-free phone call (large tutor, hidden text, help panel);
 * chat mode is optional. All call orchestration lives in useCallSession.
 */
export function CallSession(props: CallSessionProps) {
  const { setId, setTitle, scenarios, aiEnabled, cardCount, maxTurns, warning, onComplete, autoStart } = props;
  const call = useCallSession(props);
  const { assistant, assistantIndex, busy, summary, view } = call;
  const inLesson = Boolean(onComplete);

  // Lessons show their own start screen; begin the call right away (once) when asked to.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || call.assistant || call.threadId) return;
    autoStarted.current = true;
    call.changeView("call");
    void call.startCall();
  }, [autoStart, call]);

    // Enter = talk / interrupt / stop and send, unless the learner is typing or using a control.
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, [contenteditable], summary, [role=dialog]")) return;
      if (!call.canTalk) return;
      event.preventDefault();
      call.talk();
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [call]);

  function showChat() {
    call.changeView("chat", true);
    call.resumeCall();
  }

  const turnPill = (
    <span className="bg-card inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-extrabold tabular-nums">
      <MessageSquareText aria-hidden="true" className="text-primary size-4" />
      {call.userTurns}/{maxTurns}
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {!inLesson ? (
        <header className="flex items-center gap-3">
          <Link
            href={`/sets/${setId}`}
            aria-label={`Thoát, về bộ từ ${setTitle}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-10 shrink-0 place-items-center rounded-xl transition-colors"
          >
            <X className="size-6" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-extrabold tracking-wide uppercase">Hội thoại AI</p>
            <p className="truncate font-black">{setTitle}</p>
          </div>
          {assistant && !summary ? (
            <div className="hidden items-center gap-2 sm:flex" aria-label={`Đã nói ${call.userTurns} trên ${maxTurns} lượt`}>
              <span className="flex gap-1" aria-hidden="true">
                {Array.from({ length: maxTurns }, (_, index) => (
                  <span key={index} className={cn("h-2 w-2.5 rounded-full", index < call.userTurns ? "bg-primary" : "bg-muted")} />
                ))}
              </span>
              <span className="text-muted-foreground text-sm font-black tabular-nums">{call.userTurns}/{maxTurns}</span>
            </div>
          ) : null}
          <Link href="/history" className="hover:bg-muted flex h-10 items-center gap-2 rounded-2xl border-2 px-4 text-sm font-extrabold shadow-[0_3px_0_var(--border)] active:translate-y-0.5 active:shadow-none">
            <History className="size-4" aria-hidden="true" /> Lịch sử
          </Link>
        </header>
      ) : null}

      {warning ? <Banner tone="info">{warning}</Banner> : null}
      {call.error ? <Banner tone="error">{call.error}</Banner> : null}

      {!assistant && !call.paused && !summary ? (
        <StartCard
          title={setTitle}
          inLesson={inLesson}
          scenarios={scenarios}
          scenario={call.scenario}
          onScenario={call.setScenario}
          lockScenario={Boolean(busy) || Boolean(call.threadId)}
          disabledReason={!aiEnabled ? "AI chưa được bật trên máy chủ." : !cardCount ? "Bộ từ chưa có thẻ để luyện hội thoại." : null}
          busy={busy === "start"}
          maxTurns={maxTurns}
          onCall={() => { call.changeView("call"); void call.startCall(); }}
          onChat={() => { showChat(); void call.startCall(); }}
        />
      ) : null}

      {call.paused && !summary ? (
        <section className="bg-card mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border-2 p-8 text-center">
          <span className="bg-muted grid size-14 place-items-center rounded-2xl"><MicOff aria-hidden="true" className="text-muted-foreground size-7" /></span>
          <div className="space-y-1">
            <h2 className="text-xl font-black">Tạm dừng cuộc gọi</h2>
            <p className="text-muted-foreground">Không sao cả! Các lượt đã nói vẫn được lưu. Bạn có thể quay lại gọi, hoặc nhắn tin cho dễ hơn.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={call.resumeCall}><Phone /> Quay lại cuộc gọi</Button>
            <Button size="lg" variant="outline" onClick={showChat}><Keyboard /> Nhắn tin</Button>
          </div>
        </section>
      ) : null}

      {assistant && !call.paused && !summary ? (
        view === "call" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <CallStage call={call} inLesson={inLesson} turnPill={turnPill} />
            <aside aria-label="Trợ giúp" className="bg-card h-fit rounded-[2rem] border-2 p-5 shadow-[0_6px_0_var(--border)]">
              <CallHelp
                key={`${call.threadId}:${assistantIndex}`}
                threadId={call.threadId}
                index={assistantIndex}
                text={assistant.content}
                terms={assistant.terms ?? []}
                callView
                guided={call.guided}
                offerGuide={call.offerGuide}
                onGuide={call.enableGuide}
                onDismissGuide={call.dismissGuide}
                onChat={() => call.changeView("chat")}
                onReplay={busy ? undefined : () => call.replay(assistant.content, !call.ended)}
              />
            </aside>
          </div>
        ) : (
          <ChatView call={call} inLesson={inLesson} turnPill={turnPill} />
        )
      ) : null}

      {summary ? <SummaryCard summary={summary} inLesson={inLesson} onNew={call.newCall} /> : null}
    </div>
  );
}

type Call = ReturnType<typeof useCallSession>;

function orbMode(call: Call): CallOrbMode {
  if (call.micActive) return "listening";
  if (call.speaking) return "speaking";
  if (call.state === "thinking" || call.busy === "turn") return "thinking";
  return "idle";
}

/** Status line under the tutor: what is happening and what the learner can do next. */
function callStatus(call: Call): { title: string; hint: string } {
  if (call.busy === "finish") return { title: "Đang tổng kết...", hint: "Gia sư đang xem lại cuộc hội thoại" };
  if (call.micActive) return { title: "Đang nghe bạn...", hint: "Nói xong thì dừng một chút, câu sẽ tự gửi" };
  if (call.speaking) return { title: "Gia sư đang nói", hint: "Chạm vào gia sư để ngắt lời (Enter)" };
  if (call.state === "thinking" || call.busy === "turn") return { title: "Gia sư đang nghĩ...", hint: "Chờ một chút nhé" };
  if (call.ended) return { title: "Đã đủ lượt hội thoại", hint: "Xem tổng kết để biết bạn đã dùng từ nào" };
  if (call.silence) return { title: "Không nghe thấy gì", hint: "Chạm để nói lại (Enter)" };
  return { title: "Đến lượt bạn", hint: "Chạm vào gia sư hoặc nhấn Enter để nói" };
}

function CallStage({ call, inLesson, turnPill }: { call: Call; inLesson: boolean; turnPill: React.ReactNode }) {
  const mode = orbMode(call);
  const status = callStatus(call);
  const { ended } = call;

  return (
    <section
      aria-label="Màn gọi điện"
      className="from-sidebar-accent/70 via-card to-card relative flex min-h-[560px] flex-col items-center overflow-hidden rounded-[2rem] border-2 bg-gradient-to-b p-5 shadow-[0_6px_0_var(--border)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1.5px,transparent_1.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,black,transparent)]" />
      <div className="relative flex w-full items-center justify-between gap-2">
        <span className="bg-card/80 inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-extrabold">
          <span className={cn("size-2 rounded-full", ended ? "bg-muted-foreground" : "bg-primary animate-pulse motion-reduce:animate-none")} />
          {ended ? "Đã xong" : "Đang gọi"}
          {!ended ? <CallTimer /> : null}
        </span>
        {inLesson ? turnPill : null}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 py-4">
        {call.consent ? (
          <div className="bg-card flex max-w-sm flex-col items-center gap-3 rounded-3xl border-2 p-6 text-center shadow-sm">
            <span className="bg-secondary/15 grid size-14 place-items-center rounded-2xl"><Mic aria-hidden="true" className="text-secondary size-7" /></span>
            <h2 className="text-lg font-black">Cho phép dùng micro</h2>
            <p className="text-muted-foreground text-sm">Micro chỉ mở khi đến lượt bạn nói. Âm thanh chỉ dùng để chép lời, không được lưu lại.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={call.allowMic}><Mic /> Cho phép</Button>
              <Button variant="outline" onClick={() => { call.changeView("chat", true); call.resumeCall(); }}><Keyboard /> Dùng bàn phím</Button>
            </div>
          </div>
        ) : (
          <>
            <CallOrb
              mode={mode}
              level={call.micLevel}
              onTap={call.talk}
              disabled={!call.canTalk}
              label={call.micActive ? "Dừng và gửi" : call.speaking ? "Ngắt lời gia sư" : "Nói"}
            />
            <div aria-live="polite" className="space-y-1 text-center">
              <p className="text-2xl font-black">{status.title}</p>
              <p className="text-muted-foreground font-semibold">{status.hint}</p>
            </div>
            {call.pendingText ? (
              <p lang="en" className="bg-primary/10 text-foreground max-w-md rounded-2xl rounded-br-md px-4 py-2 font-semibold">
                {call.pendingText}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="relative grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Button
          variant="ghost"
          onClick={call.pauseCall}
          disabled={call.busy === "finish"}
          className="h-auto max-w-[9.5rem] justify-self-start py-2 text-left whitespace-normal sm:max-w-none"
        >
          Tôi chưa thể hội thoại
        </Button>
        {!ended || call.speaking ? (
          <TalkButton call={call} />
        ) : (
          <Button size="lg" onClick={() => void call.finishCall()} disabled={!call.canFinish}>
            <Check /> Xem tổng kết
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => void call.finishCall()}
          disabled={!call.canFinish || ended}
          aria-label="Kết thúc cuộc gọi"
          className="justify-self-end"
        >
          <PhoneOff /> <span className="hidden sm:inline">Kết thúc</span>
        </Button>
      </div>
    </section>
  );
}

/** Elapsed call time (mm:ss), counted from when the call screen appears. */
function CallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="text-muted-foreground tabular-nums">· {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
}

/** Round talk button: speak, interrupt, or stop and send. */
function TalkButton({ call }: { call: Call }) {
  const Icon = call.micActive ? Square : call.speaking ? Hand : Mic;
  const label = call.micActive ? "Dừng và gửi" : call.speaking ? "Ngắt lời" : "Nói";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={call.talk}
        disabled={!call.canTalk}
        aria-label={`${label} (Enter)`}
        className={cn(
          "grid size-16 place-items-center rounded-full text-white transition-[transform,box-shadow] active:translate-y-1 active:shadow-none disabled:opacity-40",
          call.micActive ? "bg-destructive shadow-[0_5px_0_color-mix(in_oklch,var(--destructive)_70%,black)]" : "bg-primary shadow-[0_5px_0_var(--primary-edge)]",
        )}
      >
        <Icon aria-hidden="true" className={cn("size-7", call.micActive && "fill-current size-6")} />
      </button>
      <span className="text-muted-foreground text-xs font-bold">{label} · Enter</span>
    </div>
  );
}

function ChatView({ call, inLesson, turnPill }: { call: Call; inLesson: boolean; turnPill: React.ReactNode }) {
  const { busy, ended } = call;
  const listRef = useRef<HTMLOListElement>(null);
  const lastIndex = call.messages.length - 1;

  // Keep the newest message in view as the conversation grows or streams.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [call.messages.length, call.streaming, call.pendingText]);

  return (
    <section aria-label="Chế độ chat" className="bg-card flex h-[min(78vh,760px)] flex-col overflow-hidden rounded-3xl border-2">
      <div className="flex items-center justify-between gap-2 border-b-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <TutorAvatar />
          <div>
            <p className="font-extrabold leading-tight">Gia sư</p>
            <p className="text-muted-foreground text-xs font-bold">{call.speaking ? "Đang nói..." : call.state === "thinking" ? "Đang soạn..." : "Đang trò chuyện"}</p>
          </div>
        </div>
        {inLesson ? turnPill : null}
      </div>

      <ol ref={listRef} aria-label="Tin nhắn" className="flex-1 space-y-4 overflow-y-auto p-4">
        {call.messages.map((message, index) => (
          <li key={`${call.threadId}:${index}`}>
            {message.role === "assistant" ? (
              <div className="flex items-start gap-2.5">
                <TutorAvatar className="mt-1" />
                <div className="bg-muted/50 min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-md p-4">
                  <div className="flex items-start gap-2">
                    <CallWords text={message.content} className="flex-1 text-lg leading-relaxed font-semibold" />
                    <button
                      type="button"
                      aria-label="Nghe lại câu này"
                      disabled={Boolean(busy)}
                      onClick={() => call.replay(message.content)}
                      className="text-secondary hover:bg-card grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40"
                    >
                      <Volume2 aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                  {index === lastIndex && !ended ? (
                    <CallHelp threadId={call.threadId} index={index} text={message.content} terms={message.terms ?? []} />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1.5">
                <p lang="en" className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-base font-semibold">
                  {message.content}
                </p>
                <EvaluateCallReply threadId={call.threadId} index={index} />
              </div>
            )}
          </li>
        ))}
        {call.pendingText ? (
          <li className="ml-auto max-w-[85%]">
            <p lang="en" className="bg-primary/70 text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 font-semibold">{call.pendingText}</p>
          </li>
        ) : null}
        {call.streaming ? (
          <li className="flex items-start gap-2.5">
            <TutorAvatar className="mt-1" />
            <p lang="en" className="bg-muted/50 flex-1 rounded-2xl rounded-tl-md p-4 text-lg leading-relaxed font-semibold">{cleanCallText(call.streaming)}</p>
          </li>
        ) : busy === "turn" && !call.streaming ? (
          <li className="flex items-center gap-2.5">
            <TutorAvatar />
            <span className="bg-muted/50 flex gap-1 rounded-2xl px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="bg-muted-foreground/60 size-2 animate-bounce rounded-full motion-reduce:animate-none" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </li>
        ) : null}
      </ol>

      <div className="border-t-2 p-3">
        {ended ? (
          <Button size="lg" className="w-full" onClick={() => void call.finishCall()} disabled={!call.canFinish}>
            <Check /> Xem tổng kết
          </Button>
        ) : call.keyboard ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => { event.preventDefault(); if (call.typed.trim()) void call.sendTurn(call.typed.trim()); }}
          >
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Nói bằng micro" onClick={call.toggleKeyboard}>
              <Mic />
            </Button>
            <input
              aria-label="Câu trả lời tiếng Anh"
              lang="en"
              autoFocus
              value={call.typed}
              onChange={(event) => call.setTyped(event.target.value)}
              maxLength={2000}
              disabled={Boolean(busy)}
              placeholder="Nhập câu trả lời bằng tiếng Anh..."
              className="bg-muted/50 focus-visible:border-primary h-12 min-w-0 flex-1 rounded-2xl border-2 px-4 text-base font-semibold outline-none"
            />
            <button
              type="submit"
              aria-label="Gửi"
              disabled={Boolean(busy) || !call.typed.trim()}
              className="bg-primary grid size-12 shrink-0 place-items-center rounded-full text-white shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none disabled:opacity-40"
            >
              <SendHorizontal aria-hidden="true" className="size-5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-lg" aria-label="Nhập bằng bàn phím" onClick={call.toggleKeyboard}>
              <Keyboard />
            </Button>
            <button
              type="button"
              onClick={call.talk}
              disabled={!call.canTalk}
              className={cn(
                "relative flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white transition-[transform,box-shadow] active:translate-y-1 active:shadow-none disabled:opacity-40",
                call.micActive ? "bg-destructive shadow-[0_4px_0_color-mix(in_oklch,var(--destructive)_70%,black)]" : "bg-primary shadow-[0_4px_0_var(--primary-edge)]",
              )}
            >
              {call.micActive ? <Square aria-hidden="true" className="size-5 fill-current" /> : <Mic aria-hidden="true" className="size-5" />}
              {call.micActive ? "Dừng và gửi" : call.speaking ? "Ngắt lời và nói" : "Nói"}
              {call.micActive ? (
                <span aria-hidden="true" className="absolute inset-x-6 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/30">
                  <span className="block h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${Math.min(100, call.micLevel * 600)}%` }} />
                </span>
              ) : null}
            </button>
            <Button type="button" variant="outline" size="icon-lg" aria-label="Về chế độ gọi" onClick={() => call.changeView("call")}>
              <Phone />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function StartCard({ title, inLesson, scenarios, scenario, onScenario, lockScenario, disabledReason, busy, maxTurns, onCall, onChat }: {
  title: string;
  inLesson: boolean;
  scenarios: { id: string; label: string }[];
  scenario: string;
  onScenario: (id: string) => void;
  lockScenario: boolean;
  disabledReason: string | null;
  busy: boolean;
  maxTurns: number;
  onCall: () => void;
  onChat: () => void;
}) {
  const disabled = Boolean(disabledReason) || busy;
  return (
    <section className="from-sidebar-accent/70 to-card relative mx-auto flex max-w-2xl flex-col items-center gap-6 overflow-hidden rounded-[2rem] border-2 bg-gradient-to-b p-8 text-center shadow-[0_6px_0_var(--border)]">
      <CallOrb mode={busy ? "thinking" : "idle"} level={0} onTap={onCall} disabled={disabled} label="Bắt đầu cuộc gọi" />
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight">{busy ? "Đang kết nối với gia sư..." : "Gọi điện luyện nói"}</h1>
        <p className="text-muted-foreground text-lg font-semibold">
          {inLesson ? scenarios[0]?.label : <>Trò chuyện về <span className="text-foreground">{title}</span></>} · {maxTurns} lượt nói
        </p>
      </div>

      {!inLesson && scenarios.length > 1 ? (
        <div className="w-full space-y-2">
          <p id="call-scenario" className="text-sm font-extrabold">Chọn tình huống</p>
          <div role="radiogroup" aria-labelledby="call-scenario" className="flex flex-wrap justify-center gap-2">
            {scenarios.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={scenario === id}
                disabled={lockScenario}
                onClick={() => onScenario(id)}
                className={cn(
                  "rounded-2xl border-2 px-4 py-2 text-sm font-extrabold transition-colors disabled:opacity-50",
                  scenario === id ? "border-primary bg-primary/12 text-primary-edge" : "bg-card hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="grid w-full gap-2 text-left sm:grid-cols-3">
        {CALL_STEPS.map(({ icon: Icon, title: stepTitle, text }) => (
          <li key={stepTitle} className="bg-card/80 rounded-2xl border-2 p-3">
            <Icon className="text-primary size-5" aria-hidden="true" />
            <p className="mt-1.5 text-sm font-black">{stepTitle}</p>
            <p className="text-muted-foreground text-xs font-semibold">{text}</p>
          </li>
        ))}
      </ul>

      {disabledReason ? <Banner tone="info">{disabledReason}</Banner> : null}

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" className="h-14 px-8 text-base" disabled={disabled} onClick={onCall}>
          {busy ? <LogoLoader size="sm" label="" /> : <Phone />} Bắt đầu cuộc gọi
        </Button>
        <Button size="lg" variant="outline" className="h-14 px-8 text-base" disabled={disabled} onClick={onChat}>
          <Keyboard /> Nhắn tin thay vì gọi
        </Button>
      </div>
      <p className="text-muted-foreground text-xs font-semibold">Mẹo: nói xong thì dừng một chút, câu sẽ tự gửi. Nhấn Enter để nói hoặc ngắt lời.</p>
    </section>
  );
}

function SummaryCard({ summary, inLesson, onNew }: {
  summary: NonNullable<Call["summary"]>;
  inLesson: boolean;
  onNew: () => void;
}) {
  return (
    <section className="bg-card mx-auto max-w-2xl space-y-6 rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)] sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <TutorAvatar className="size-16 rounded-3xl" />
        <h2 className="text-3xl font-black tracking-tight">Tổng kết cuộc gọi</h2>
        <p className="text-muted-foreground max-w-lg text-lg">{cleanCallText(summary.note_vi)}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <SummaryStat value={`${summary.used_terms.length}/${summary.used_terms.length + summary.unused_terms.length}`} label="Từ đã dùng" />
        <SummaryStat value={summary.errors.length} label="Lỗi được sửa" />
        <SummaryStat
          value={summary.used_terms.length + summary.unused_terms.length ? `${Math.round((summary.used_terms.length / (summary.used_terms.length + summary.unused_terms.length)) * 100)}%` : "–"}
          label="Mục tiêu từ"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-primary/30 bg-primary/5 space-y-2 rounded-2xl border-2 p-4">
          <p className="text-primary-edge flex items-center gap-1.5 text-sm font-extrabold"><Check className="size-4" /> Từ đã dùng ({summary.used_terms.length})</p>
          <ChipList words={summary.used_terms} empty="Chưa dùng từ nào" tone="good" />
        </div>
        <div className="space-y-2 rounded-2xl border-2 p-4">
          <p className="text-muted-foreground text-sm font-extrabold">Lần sau thử dùng ({summary.unused_terms.length})</p>
          <ChipList words={summary.unused_terms} empty="Bạn đã dùng hết!" tone="muted" />
        </div>
      </div>

      {summary.errors.length ? (
        <div className="space-y-2">
          <p className="font-extrabold">Sửa lỗi ({summary.errors.length})</p>
          <ul className="space-y-2">
            {summary.errors.map(({ original, correction, explanation_vi }, index) => (
              <li key={index} className="space-y-1 rounded-2xl border-2 p-3">
                <p lang="en" className="text-destructive font-semibold line-through decoration-2">{cleanCallText(original)}</p>
                <p lang="en" className="text-primary-edge font-bold">{cleanCallText(correction)}</p>
                <p className="text-muted-foreground text-sm">{cleanCallText(explanation_vi)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="bg-primary/5 text-primary-edge rounded-2xl p-3 text-sm font-bold">Không có lỗi đáng kể. Tuyệt vời!</p>
      )}

      {!inLesson ? (
        <Button size="lg" onClick={onNew}><RotateCcw /> Cuộc gọi mới</Button>
      ) : null}
    </section>
  );
}

function SummaryStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-muted/60 rounded-2xl p-3">
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs font-extrabold uppercase">{label}</p>
    </div>
  );
}

function ChipList({ words, empty, tone }: { words: string[]; empty: string; tone: "good" | "muted" }) {
  if (!words.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {words.map((word) => (
        <li
          key={word}
          lang="en"
          className={cn(
            "rounded-full px-2.5 py-0.5 text-sm font-bold",
            tone === "good" ? "bg-primary/15 text-primary-edge" : "bg-muted text-muted-foreground",
          )}
        >
          {word}
        </li>
      ))}
    </ul>
  );
}

function Banner({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-bold",
        tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-secondary/30 bg-secondary/5 text-secondary-edge",
      )}
    >
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> {children}
    </p>
  );
}

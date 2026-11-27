"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { PCM_CAPTURE_WORKLET_CODE } from "./pcm-capture-worklet";
import { encodeWavPcm, WAV_SAMPLE_RATE } from "./wav-encoder";

const MAX_SECONDS = 60;
const CONSENT_KEY = "openengquiz:mic-consent-v2";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecordedAudio { audio: Blob; transcript: string }

export function AudioRecorder({ onRecording, transcribe = false, disabled = false, startLabel = "Ghi âm", recordingLabel, variant = "default" }: {
  onRecording: (recording: RecordedAudio | null) => void;
  transcribe?: boolean;
  disabled?: boolean;
  startLabel?: string;
  recordingLabel?: string;
  /** "compact": a single round mic button with timer and level ring (chat composers).
   *  "wide": one large full-width talk button; recording shows a stop label, timer and level bar inside it. */
  variant?: "default" | "compact" | "wide";
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "stopping">("idle");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [url, setUrl] = useState<string>();
  const dispose = useRef<(() => void) | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const agreed = useRef(false);

  useEffect(() => () => dispose.current?.(), []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    if (dispose.current || disabled) return;
    let context: AudioContext | undefined;
    let stream: MediaStream | undefined;
    let recognition: Recognition | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let stopped = false;
    const closeMic = () => {
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
    const cleanup = () => {
      cancelled = true;
      closeMic();
      clearTimeout(settle);
      if (recognition) {
        recognition.onend = recognition.onresult = null;
        try { recognition.abort(); } catch { /* Already closed. */ }
      }
      dispose.current = stop.current = null;
    };
    dispose.current = cleanup;
    setUrl(undefined);
    onRecording(null);
    setPhase("starting");
    setSeconds(0);
    setLevel(0);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error("Unsupported");
      try { context = new AudioContext({ sampleRate: WAV_SAMPLE_RATE }); } catch { context = new AudioContext(); }
      const resumed = context.resume();
      void resumed.catch(() => {});
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (cancelled) { closeMic(); return; }
      await resumed;
      if (cancelled) return;
      const rate = context.sampleRate;
      const samples = new Float32Array(rate * MAX_SECONDS);
      let count = 0;
      let transcript = "";
      let lastMeter = -Infinity;
      const finish = () => {
        if (cancelled) return;
        cleanup();
        setPhase("idle");
        if (!count) { setError("Chưa thu được âm thanh. Hãy thử lại."); return; }
        const input = samples.subarray(0, count);
        const ratio = rate / WAV_SAMPLE_RATE;
        // ponytail: use native-rate capture first; average fallback samples without a DSP dependency.
        const pcm = rate === WAV_SAMPLE_RATE ? input : Float32Array.from(
          { length: Math.floor(count / ratio) }, (_, i) => {
            const from = Math.floor(i * ratio);
            const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
            let sum = 0;
            for (let j = from; j < to; j++) sum += input[j];
            return sum / (to - from);
          },
        );
        if (!pcm.length) { setError("Bản ghi quá ngắn. Hãy thử lại."); return; }
        const audio = encodeWavPcm(pcm);
        setUrl(URL.createObjectURL(audio));
        onRecording({ audio, transcript: transcript.trim().slice(0, 2000) });
      };
      stop.current = () => {
        if (stopped || cancelled) return;
        stopped = true;
        closeMic();
        setPhase("stopping");
        if (!recognition) { finish(); return; }
        recognition.onend = finish;
        settle = setTimeout(finish, 500);
        try { recognition.stop(); } catch { finish(); }
      };
      const capture = (frame: Float32Array) => {
        if (cancelled || stopped) return;
        const size = Math.min(frame.length, samples.length - count);
        samples.set(frame.subarray(0, size), count);
        count += size;
        if (count - lastMeter >= rate / 10) {
          lastMeter = count;
          let peak = 0;
          for (let i = 0; i < size; i++) peak = Math.max(peak, Math.abs(frame[i]));
          setLevel(peak);
          setSeconds(Math.floor(count / rate));
        }
        if (count === samples.length) stop.current?.();
      };
      const source = context.createMediaStreamSource(stream);
      try {
        const moduleUrl = URL.createObjectURL(new Blob([PCM_CAPTURE_WORKLET_CODE], { type: "text/javascript" }));
        try { await context.audioWorklet.addModule(moduleUrl); } finally { URL.revokeObjectURL(moduleUrl); }
        if (cancelled) return;
        const node = new AudioWorkletNode(context, "pcm-capture", { numberOfOutputs: 0 });
        node.port.onmessage = (event: MessageEvent<Float32Array>) => capture(event.data);
        source.connect(node);
      } catch {
        if (cancelled) return;
        const node = context.createScriptProcessor(2048, 1, 1);
        node.onaudioprocess = (event) => capture(event.inputBuffer.getChannelData(0));
        source.connect(node).connect(context.destination);
      }
      if (transcribe) {
        const w = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
        const Recognizer = w.SpeechRecognition ?? w.webkitSpeechRecognition;
        if (Recognizer) {
          try {
            recognition = new Recognizer();
            recognition.lang = "en-US";
            recognition.continuous = recognition.interimResults = true;
            recognition.onresult = ({ results }) => {
              transcript = Array.from(results, (result) => result[0]?.transcript.trim()).filter(Boolean).join(" ");
            };
            recognition.start();
          } catch { recognition = undefined; }
        }
      }
      timer = setTimeout(() => stop.current?.(), MAX_SECONDS * 1000);
      setPhase("recording");
    } catch (cause) {
      if (cancelled) return;
      cleanup();
      setPhase("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Bạn chưa cho phép dùng mic. Hãy kiểm tra quyền trong trình duyệt."
        : "Không mở được micro. Hãy kiểm tra thiết bị hoặc thử trình duyệt khác.");
    }
  }

  function requestRecording() {
    try { agreed.current ||= localStorage.getItem(CONSENT_KEY) === "1"; } catch { /* Storage unavailable. */ }
    if (agreed.current) void start();
    else setConsent(true);
  }

  return (
    <div className="space-y-3">
      {consent && (
        <section aria-label="Đồng ý ghi âm" className="space-y-2 rounded-2xl border-2 bg-muted p-4">
          <h3 className="font-extrabold">Cho phép ghi âm?</h3>
          <p className="text-sm">Bản ghi gửi đến dịch vụ chấm phát âm. Khi luyện nói, Groq hoặc dịch vụ nhận dạng của trình duyệt có thể xử lý giọng nói để tạo bản chép. OpenEngQuiz không lưu bản ghi; lịch sử lưu văn bản và kết quả.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={disabled} onClick={() => {
              agreed.current = true;
              try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* Storage unavailable. */ }
              setConsent(false);
              void start();
            }}>Đồng ý và ghi âm</Button>
            <Button type="button" variant="outline" onClick={() => setConsent(false)}>Hủy</Button>
          </div>
        </section>
      )}
      {variant === "compact" ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={phase === "recording" ? "Dừng ghi âm" : startLabel}
            disabled={phase === "starting" || phase === "stopping" || (disabled && phase !== "recording")}
            onClick={() => phase === "recording" ? stop.current?.() : requestRecording()}
            className={`relative grid size-14 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-50 ${phase === "recording" ? "bg-destructive" : "bg-primary shadow-[0_4px_0_var(--primary-edge)]"}`}
          >
            {phase === "recording" && (
              <span aria-hidden="true" className="bg-destructive/30 absolute inset-0 rounded-full" style={{ transform: `scale(${1 + level * 0.8})` }} />
            )}
            {phase === "recording" ? <Square className="relative size-5 fill-current" /> : <Mic className="relative size-6" />}
          </button>
          <span className="text-muted-foreground text-sm font-bold tabular-nums" aria-label="Thời gian ghi">
            {phase === "recording" ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} / 1:00` : phase === "idle" ? "Bấm để nói" : ""}
          </span>
        </div>
      ) : variant === "wide" ? (
        <button
          type="button"
          aria-label={phase === "recording" ? "Dừng và gửi" : startLabel}
          disabled={phase === "starting" || phase === "stopping" || (disabled && phase !== "recording")}
          onClick={() => phase === "recording" ? stop.current?.() : requestRecording()}
          className={`relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-extrabold text-white transition-[transform,box-shadow] active:translate-y-1 active:shadow-none disabled:opacity-50 ${phase === "recording" ? "bg-destructive shadow-[0_4px_0_color-mix(in_oklch,var(--destructive)_70%,black)]" : "bg-primary shadow-[0_4px_0_var(--primary-edge)]"}`}
        >
          {phase === "recording" ? <Square aria-hidden="true" className="size-4 fill-current" /> : phase === "idle" ? <Mic aria-hidden="true" className="size-5" /> : null}
          {phase === "recording"
            ? <span className="tabular-nums">Dừng · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
            : phase === "starting" ? "Đang mở mic..." : phase === "stopping" ? "Đang xử lý..." : startLabel}
          {phase === "recording" ? (
            <span aria-hidden="true" className="absolute inset-x-6 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${Math.min(100, level * 600)}%` }} />
            </span>
          ) : null}
        </button>
      ) : (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={phase === "starting" || phase === "stopping" || (disabled && phase !== "recording")}
          onClick={() => phase === "recording" ? stop.current?.() : requestRecording()}>
          {phase === "recording" ? "Dừng" : url ? "Ghi lại" : startLabel}
        </Button>
        <span className="tabular-nums" aria-label="Thời gian ghi">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} / 1:00</span>
        {url && <Button type="button" variant="outline" disabled={disabled} onClick={() => { setUrl(undefined); setSeconds(0); onRecording(null); }}>Xóa bản ghi</Button>}
      </div>
      )}
      {variant === "default" && (phase === "starting" || phase === "stopping") && (
        <LogoLoader size="sm" label={phase === "starting" ? "Đang mở mic" : "Đang xử lý bản ghi"} />
      )}
      {variant === "default" && phase === "recording" && <meter aria-label="Mức âm" min={0} max={1} value={level} className="w-full" />}
      {variant === "default" && phase === "recording" && recordingLabel && <p role="status" className="font-bold">{recordingLabel}</p>}
      {variant === "default" && url && <audio aria-label="Nghe lại bản ghi" controls src={url} className="w-full" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

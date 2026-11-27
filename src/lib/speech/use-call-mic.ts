"use client";

/**
 * Hands-free microphone for the voice call screen.
 *
 * Captures 16 kHz mono PCM through the same AudioWorklet path as AudioRecorder,
 * but instead of a manual stop button a VAD decides when the learner finished:
 * ~1.2 s of quiet after voice sends the utterance, ~8 s with no voice reports
 * silence so the UI can offer a push-to-talk fallback.
 *
 * `stop()` ends capture and sends the utterance if any speech was heard;
 * `cancel()` discards everything and never calls `onAudio`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PCM_CAPTURE_WORKLET_CODE } from "@/components/audio/pcm-capture-worklet";
import { encodeWavPcm, WAV_SAMPLE_RATE } from "@/components/audio/wav-encoder";
import { createCallVad, type CallVad } from "./call-vad";

const MAX_SECONDS = 60;
/** Frames shorter than this are UI noise; keep the meter cheap. */
const LEVEL_INTERVAL_MS = 100;
/** Pre-voice audio kept so the first phoneme is not clipped. */
const PREROLL_SECONDS = 0.2;

export type CallMicError = "mic-denied" | "mic-unavailable";

export interface UseCallMicOptions {
  onAudio: (wav: Blob) => void;
  onSilence: () => void;
  onError: (reason: CallMicError) => void;
}

export interface UseCallMic {
  start: () => void;
  stop: () => void;
  cancel: () => void;
  /** Smoothed 0..1 input level for the listening ring. */
  level: number;
  active: boolean;
}
interface CallMicSession {
  context?: AudioContext;
  stream?: MediaStream;
  samples: Float32Array;
  count: number;
  firstVoiceIndex: number;
  vad: CallVad;
  timer?: ReturnType<typeof setTimeout>;
  peak: number;
  lastMeterAt: number;
  stopped: boolean;
  cancelled: boolean;
}

export function useCallMic({ onAudio, onSilence, onError }: UseCallMicOptions): UseCallMic {
  const [level, setLevel] = useState(0);
  const [active, setActive] = useState(false);

  const callbacks = useRef({ onAudio, onSilence, onError });
  useEffect(() => {
    callbacks.current = { onAudio, onSilence, onError };
  });

  // Mutable session state kept in refs so start/stop/cancel stay stable callbacks.
  const session = useRef<CallMicSession | null>(null);

  const teardown = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    s.stopped = true;
    clearTimeout(s.timer);
    s.stream?.getTracks().forEach((track) => track.stop());
    if (s.context && s.context.state !== "closed") void s.context.close().catch(() => {});
    session.current = null;
    setActive(false);
    setLevel(0);
  }, []);

  // Secure cleanup on unmount.
  useEffect(() => teardown, [teardown]);

  const encodeAndSend = useCallback((s: CallMicSession, send: boolean) => {
    const from = s.firstVoiceIndex > 0 ? s.firstVoiceIndex : 0;
    const pcm = s.samples.subarray(from, s.count);
    if (!send || pcm.length === 0) return;
    const ratio = s.context ? s.context.sampleRate / WAV_SAMPLE_RATE : 1;
    const resampled =
      ratio === 1
        ? pcm
        : Float32Array.from({ length: Math.floor(pcm.length / ratio) }, (_, i) => {
            const start = Math.floor(i * ratio);
            const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
            let sum = 0;
            for (let j = start; j < end && j < pcm.length; j++) sum += pcm[j];
            return sum / (end - start);
          });
    if (resampled.length === 0) return;
    callbacks.current.onAudio(encodeWavPcm(resampled));
  }, []);

  const start = useCallback(() => {
    if (session.current) return;
    let context: AudioContext | undefined;
    let stream: MediaStream | undefined;
    const s = {
      samples: new Float32Array(0),
      count: 0,
      firstVoiceIndex: -1,
      vad: createCallVad(),
      peak: 0,
      lastMeterAt: 0,
      stopped: false,
      cancelled: false,
    } as CallMicSession;
    session.current = s;
    setActive(true);
    setLevel(0);

    const finish = (send: boolean) => {
      if (s.stopped || s.cancelled) return;
      s.stopped = true;
      const heard = s.vad.heardSpeech;
      encodeAndSend(s, send && heard);
      teardown();
      // Any non-cancelled end without detected speech tells the UI to offer retry.
      if (!heard) callbacks.current.onSilence();
    };

    const capture = (frame: Float32Array) => {
      if (s.stopped || s.cancelled) return;
      const size = Math.min(frame.length, s.samples.length - s.count);
      if (size <= 0) {
        finish(true);
        return;
      }
      s.samples.set(frame.subarray(0, size), s.count);
      const frameStart = s.count;
      s.count += size;

      // Peak for this frame feeds both the VAD and the level meter.
      let peak = 0;
      for (let i = 0; i < size; i++) peak = Math.max(peak, Math.abs(frame[i]));
      s.peak = Math.max(s.peak * 0.6, peak);

      const now = performance.now();
      const event = s.vad.push(peak, now);
      if (event === "speech" && s.firstVoiceIndex < 0) {
        // Keep ~200 ms of pre-roll so the leading phoneme is not clipped.
        s.firstVoiceIndex = Math.max(0, frameStart - Math.floor((s.context?.sampleRate ?? WAV_SAMPLE_RATE) * PREROLL_SECONDS));
      } else if (event === "silence") {
        finish(true);
        return;
      } else if (event === "no-speech") {
        finish(false);
        return;
      }

      if (now - s.lastMeterAt >= LEVEL_INTERVAL_MS) {
        s.lastMeterAt = now;
        setLevel(Math.min(1, s.peak * 4));
      }
    };

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error("unsupported");
        try {
          context = new AudioContext({ sampleRate: WAV_SAMPLE_RATE });
        } catch {
          context = new AudioContext();
        }
        s.context = context;
        // Allocate at the context's native rate; encodeAndSend resamples to 16 kHz.
        s.samples = new Float32Array(context.sampleRate * MAX_SECONDS);
        const resumed = context.resume();
        void resumed.catch(() => {});
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        s.stream = stream;
        if (s.cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          void context.close().catch(() => {});
          // Only clear shared state if this session is still current; a newer
          // start() may already own session.current.
          if (session.current === s) {
            session.current = null;
            setActive(false);
          }
          return;
        }
        await resumed;
        if (s.cancelled) return;

        const source = context.createMediaStreamSource(stream);
        try {
          const moduleUrl = URL.createObjectURL(new Blob([PCM_CAPTURE_WORKLET_CODE], { type: "text/javascript" }));
          try {
            await context.audioWorklet.addModule(moduleUrl);
          } finally {
            URL.revokeObjectURL(moduleUrl);
          }
          if (s.cancelled) return;
          const node = new AudioWorkletNode(context, "pcm-capture", { numberOfOutputs: 0 });
          node.port.onmessage = (event: MessageEvent<Float32Array>) => capture(event.data);
          source.connect(node);
        } catch {
          if (s.cancelled) return;
          const node = context.createScriptProcessor(2048, 1, 1);
          node.onaudioprocess = (event) => capture(event.inputBuffer.getChannelData(0));
          source.connect(node).connect(context.destination);
        }

        s.timer = setTimeout(() => finish(true), MAX_SECONDS * 1000);
      } catch (cause) {
        if (s.cancelled) return;
        teardown();
        callbacks.current.onError(
          cause instanceof DOMException && cause.name === "NotAllowedError"
            ? "mic-denied"
            : "mic-unavailable",
        );
      }
    })();
  }, [encodeAndSend, teardown]);

  const stop = useCallback(() => {
    const s = session.current;
    if (!s || s.stopped || s.cancelled) return;
    s.stopped = true;
    const heard = s.vad.heardSpeech;
    encodeAndSend(s, heard);
    teardown();
    if (!heard) callbacks.current.onSilence();
  }, [encodeAndSend, teardown]);

  const cancel = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    teardown();
  }, [teardown]);

  return { start, stop, cancel, level, active };
}

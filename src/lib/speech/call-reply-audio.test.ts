import { describe, expect, it, vi } from "vitest";
import type { TtsOutcome, TtsPlayback } from "./play-tts";
import { createCallReplyAudio, splitCallReplyText, TTS_MAX_CHARS } from "./call-reply-audio";

describe("splitCallReplyText", () => {
  it("holds an incomplete sentence until its terminator arrives", () => {
    const first = splitCallReplyText("Hello the");
    expect(first.chunks).toEqual([]);
    expect(first.rest).toBe("Hello the");
    const second = splitCallReplyText(`${first.rest}re. How are`);
    expect(second.chunks).toEqual(["Hello there."]);
    expect(second.rest).toBe("How are");
  });

  it("does not speak a partial decimal as a sentence", () => {
    const first = splitCallReplyText("I walked 3.");
    expect(first.chunks).toEqual([]);
    expect(splitCallReplyText(`${first.rest}5 miles. How far`).chunks).toEqual(["I walked 3.5 miles."]);
  });

  it("emits multiple sentences from one delta", () => {
    const { chunks, rest } = splitCallReplyText("One. Two! Three? Tail");
    expect(chunks).toEqual(["One.", "Two!", "Three?"]);
    expect(rest).toBe("Tail");
  });

  it("flushes the trailing fragment on finish", () => {
    const { chunks, rest } = splitCallReplyText("No terminator here", true);
    expect(chunks).toEqual(["No terminator here"]);
    expect(rest).toBe("");
  });

  it("splits over-long sentences on clause boundaries", () => {
    const long = `${"word ".repeat(80)}, ${"tail ".repeat(20)}.`;
    const { chunks } = splitCallReplyText(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(TTS_MAX_CHARS);
  });

  it("hard-splits when no clause break fits", () => {
    const { chunks } = splitCallReplyText("x".repeat(TTS_MAX_CHARS + 50), true);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(TTS_MAX_CHARS);
  });
});

/** Stub playback whose `done` resolves when the test says so. */
interface PlaybackStub {
  playback: TtsPlayback;
  settle: (outcome: TtsOutcome) => void;
  stop: () => void;
}

function stubPlayback(): PlaybackStub {
  let settle!: (outcome: TtsOutcome) => void;
  const done = new Promise<TtsOutcome>((resolve) => { settle = resolve; });
  const stop = vi.fn(() => settle("stopped"));
  const playback: TtsPlayback = { done, stop, pause: vi.fn(), resume: vi.fn() };
  return { playback, settle, stop };
}

function harness() {
  const played: string[] = [];
  const stubs: PlaybackStub[] = [];
  const prefetched: string[] = [];
  const speaking: boolean[] = [];
  const errors: number[] = [];
  const play = vi.fn((text: string, onPlaying: () => void) => {
    played.push(text);
    const stub = stubPlayback();
    stubs.push(stub);
    // Mirror playTtsTrack: "playing" arrives asynchronously after play() returns.
    queueMicrotask(onPlaying);
    return stub.playback;
  });
  const audio = createCallReplyAudio({
    onSpeaking: (s) => speaking.push(s),
    onError: () => errors.push(1),
    play,
    prefetch: (t) => prefetched.push(t),
  });
  return { audio, played, stubs, prefetched, speaking, errors, play };
}

describe("createCallReplyAudio", () => {
  it("plays sentences in order, prefetches the next, resolves finish after the last", async () => {
    const { audio, played, stubs, prefetched, speaking } = harness();

    audio.push("First sentence. Second");
    expect(played).toEqual(["First sentence."]);
    expect(prefetched).toEqual([]); // nothing queued yet

    audio.push(" sentence arrives.");
    expect(played).toEqual(["First sentence."]); // still playing first
    expect(prefetched).toEqual(["Second sentence arrives."]);

    stubs[0].settle("ended");
    await Promise.resolve();
    expect(played).toEqual(["First sentence.", "Second sentence arrives."]);

    const finished = audio.finish();
    stubs[1].settle("ended");
    await finished;
    expect(speaking.at(-1)).toBe(false);
  });

  it("flushes a trailing fragment on finish and plays it", async () => {
    const { audio, played, stubs } = harness();
    audio.push("Wait for it");
    const finished = audio.finish();
    expect(played).toEqual(["Wait for it"]);
    stubs[0].settle("ended");
    await finished;
  });

  it("stop clears the queue, stops playback, and resolves finish", async () => {
    const { audio, stubs, play } = harness();
    audio.push("One. Two. Three.");
    const finished = audio.finish();
    audio.stop();
    await finished; // resolves, does not hang
    expect(stubs[0].stop).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1); // queued sentences never started
  });

  it("does not pump or flip speaking after stop during pending playback", async () => {
    const { audio, stubs, play, speaking } = harness();
    audio.push("One. Two.");
    audio.stop();
    // The queued onPlaying microtask and the late done resolution must both be ignored.
    await Promise.resolve();
    stubs[0].settle("ended");
    await Promise.resolve();
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
    expect(speaking).toEqual([false]); // onSpeaking(true) never fired
  });

  it("reports a failed utterance via onError and continues the queue", async () => {
    const { audio, stubs, errors, play } = harness();
    audio.push("One. Two.");
    const finished = audio.finish();
    stubs[0].settle("failed");
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect(play).toHaveBeenCalledTimes(2); // next sentence still played
    stubs[1].settle("ended");
    await finished;
  });

  it("ignores push after finish", async () => {
    const { audio, play } = harness();
    await audio.finish();
    audio.push("Late delta.");
    expect(play).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { CALL_VAD_DEFAULTS, createCallVad } from "./call-vad";

describe("call VAD", () => {
  it("reports speech on voiced frames and silence after the quiet window", () => {
    const vad = createCallVad();
    expect(vad.push(0.001, 0)).toBeNull();
    expect(vad.push(0.2, 100)).toBe("speech");
    expect(vad.heardSpeech).toBe(true);
    expect(vad.push(0.001, 500)).toBeNull();
    expect(vad.push(0.001, 100 + CALL_VAD_DEFAULTS.silenceMs)).toBe("silence");
    // Terminal: further frames are ignored until reset.
    expect(vad.push(0.5, 5_000)).toBeNull();
  });

  it("extends the silence window while voice keeps arriving", () => {
    const vad = createCallVad({ silenceMs: 1_000 });
    vad.push(0.2, 0);
    vad.push(0.001, 900);
    vad.push(0.2, 950); // voice again before the window closed
    expect(vad.push(0.001, 1_900)).toBeNull();
    expect(vad.push(0.001, 1_950 + 1_000)).toBe("silence");
  });

  it("fires no-speech when nothing voiced arrives inside the window", () => {
    const vad = createCallVad({ noSpeechMs: 8_000 });
    expect(vad.push(0.001, 0)).toBeNull();
    expect(vad.push(0.001, 7_999)).toBeNull();
    expect(vad.push(0.001, 8_000)).toBe("no-speech");
    expect(vad.heardSpeech).toBe(false);
  });

  it("does not count sub-threshold noise as voice", () => {
    const vad = createCallVad({ threshold: 0.02 });
    vad.push(0.019, 0);
    expect(vad.heardSpeech).toBe(false);
    expect(vad.push(0.02, 100)).toBe("speech");
  });

  it("reset clears state for the next utterance", () => {
    const vad = createCallVad();
    vad.push(0.2, 0);
    vad.push(0.001, 2_000);
    vad.reset();
    expect(vad.heardSpeech).toBe(false);
    expect(vad.push(0.001, 2_100)).toBeNull();
    expect(vad.push(0.2, 2_200)).toBe("speech");
  });
});

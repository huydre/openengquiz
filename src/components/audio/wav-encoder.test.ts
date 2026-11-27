import { describe, expect, it } from "vitest";
import { encodeWavPcm, WAV_SAMPLE_RATE } from "./wav-encoder";

async function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

describe("encodeWavPcm", () => {
  it("writes a valid 44-byte PCM WAV header", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodeWavPcm(samples, { sampleRate: WAV_SAMPLE_RATE });
    expect(blob.type).toBe("audio/wav");

    const view = new DataView(await readBlob(blob));
    expect(view.byteLength).toBe(44 + samples.length * 2);

    const ascii = (offset: number, length: number) =>
      String.fromCharCode(...new Uint8Array(view.buffer, offset, length));
    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(ascii(12, 4)).toBe("fmt ");
    expect(ascii(36, 4)).toBe("data");

    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2); // RIFF size
    expect(view.getUint32(16, true)).toBe(16); // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(WAV_SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(samples.length * 2); // data size
  });

  it("converts float samples to little-endian int16 with clamping", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 2, -2]);
    const view = new DataView(await readBlob(encodeWavPcm(samples)));

    const pcm = [
      view.getInt16(44, true),
      view.getInt16(46, true),
      view.getInt16(48, true),
      view.getInt16(50, true),
      view.getInt16(52, true),
    ];
    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(Math.round(0.5 * 0x7fff));
    expect(pcm[2]).toBe(Math.round(-0.5 * 0x8000));
    expect(pcm[3]).toBe(0x7fff); // clamped above 1
    expect(pcm[4]).toBe(-0x8000); // clamped below -1
  });

  it("handles an empty sample buffer", async () => {
    const blob = encodeWavPcm(new Float32Array(0));
    const view = new DataView(await readBlob(blob));
    expect(view.byteLength).toBe(44);
    expect(view.getUint32(40, true)).toBe(0);
  });
});

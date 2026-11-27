import { describe, expect, it } from "vitest";
import { wavDuration } from "./speaking-wav";

function recording(samples: number) {
  const buffer = new ArrayBuffer(54 + samples * 2);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646);
  view.setUint32(4, buffer.byteLength - 8, true);
  view.setUint32(8, 0x57415645);
  view.setUint32(12, 0x666d7420);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x4a554e4b);
  view.setUint32(40, 1, true);
  view.setUint32(46, 0x64617461);
  view.setUint32(50, samples * 2, true);
  return buffer;
}

describe("speaking WAV validation", () => {
  it("skips padded metadata and uses actual sample count at the 60-second boundary", () => {
    expect(wavDuration(recording(960_000))).toBe(60);
    expect(wavDuration(recording(960_001))).toBeGreaterThan(60);
  });

  it("rejects wrong sample rate and inconsistent or truncated data", () => {
    const wrongRate = recording(20);
    new DataView(wrongRate).setUint32(24, 48000, true);
    expect(wavDuration(wrongRate)).toBeNull();
    expect(wavDuration(recording(20).slice(0, -2))).toBeNull();
    const wrongSize = recording(20);
    new DataView(wrongSize).setUint32(50, 800_000, true);
    expect(wavDuration(wrongSize)).toBeNull();
  });
});

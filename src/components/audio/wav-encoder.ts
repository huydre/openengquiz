/**
 * Minimal WAV (RIFF) encoder for 16-bit PCM mono audio.
 *
 * The recorder captures Float32 samples from an AudioWorklet and this module
 * packs them into a standard 44-byte-header WAV blob that pronunciation
 * services accept directly (no transcoding step, no codec quirks like webm/opus).
 */

export const WAV_SAMPLE_RATE = 16_000;

export interface WavPcmOptions {
  sampleRate?: number;
  numChannels?: number;
}

/**
 * Encode interleaved Float32 PCM samples (values in [-1, 1]) into a WAV Blob.
 * Samples are clamped and converted with rounding to avoid wrap-around clicks.
 */
export function encodeWavPcm(samples: Float32Array, options: WavPcmOptions = {}): Blob {
  const sampleRate = options.sampleRate ?? WAV_SAMPLE_RATE;
  const numChannels = options.numChannels ?? 1;
  const numFrames = Math.floor(samples.length / numChannels);
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames * numChannels; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    // Scale to int16 with rounding; -1 maps to -32768.
    const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

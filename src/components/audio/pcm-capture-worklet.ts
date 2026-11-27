/**
 * AudioWorklet processor source code, loaded as a Blob URL at runtime.
 *
 * We inline the worklet code as a string so Turbopack doesn't try to bundle
 * it as a separate module (which would fail because AudioWorklet globals
 * aren't in the DOM lib). The string is converted to a Blob URL in the
 * recorder component.
 */

export const PCM_CAPTURE_WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      // Copy: the underlying buffer is reused by the audio thread.
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCaptureProcessor);
`;

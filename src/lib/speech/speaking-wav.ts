export const MAX_AUDIO_BYTES = 5_000_000;

export function wavDuration(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  if (view.byteLength < 44 || view.getUint32(0) !== 0x52494646 ||
      view.getUint32(8) !== 0x57415645 || view.getUint32(4, true) !== view.byteLength - 8) return null;

  let hasFormat = false;
  let dataBytes: number | undefined;
  let offset = 12;
  for (; offset + 8 <= view.byteLength;) {
    const kind = view.getUint32(offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    offset = start + size + size % 2;
    if (offset > view.byteLength) return null;
    if (kind === 0x666d7420) {
      if (hasFormat || size < 16 || view.getUint16(start, true) !== 1 ||
          view.getUint16(start + 2, true) !== 1 || view.getUint32(start + 4, true) !== 16000 ||
          view.getUint32(start + 8, true) !== 32000 || view.getUint16(start + 12, true) !== 2 ||
          view.getUint16(start + 14, true) !== 16) return null;
      hasFormat = true;
    } else if (kind === 0x64617461) {
      if (!hasFormat || dataBytes !== undefined || !size || size % 2) return null;
      dataBytes = size;
    }
  }
  return offset === view.byteLength && dataBytes !== undefined ? dataBytes / 32000 : null;
}

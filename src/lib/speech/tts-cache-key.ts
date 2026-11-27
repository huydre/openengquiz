/**
 * Canonical cache identity for synthesized TTS audio. Used as the client urlCache key
 * and as the hash preimage for the Storage path (via ttsHashPreimage), so speed is always
 * part of the key.
 */
export function ttsCacheKey(voice: string, text: string, speed: number): string {
  return `${voice}\n${String(speed)}\n${text}`;
}

/**
 * Hash preimage for the Storage path. Speed 1 keeps the legacy `${voice}\n${text}` form so
 * audio cached before speed support remains valid; other speeds get their own files.
 */
export function ttsHashPreimage(voice: string, text: string, speed: number): string {
  return speed === 1 ? `${voice}\n${text}` : ttsCacheKey(voice, text, speed);
}
